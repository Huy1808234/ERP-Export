import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { LetterOfCredit, LCStatus } from './entities/letter-of-credit.entity';
import { TradeFinanceTransaction, TradeFinanceStatus, TradeFinanceType } from './entities/trade-finance-transaction.entity';
import { CreateLCDto } from '@/modules/trade-finance/dto/create-lc.dto';
import { UpdateLCDto } from '@/modules/trade-finance/dto/update-lc.dto';
import { User } from '@/modules/users/entities/user.entity';
import { BaseService } from '@/common/base/base.service';
import { AccountingService } from '../accounting/accounting.service';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';

@Injectable()
export class TradeFinanceService extends BaseService<LetterOfCredit> {
  @InjectRepository(SalesContract)
  private scRepository: Repository<SalesContract>;

  constructor(
    @InjectRepository(LetterOfCredit)
    private lcRepository: Repository<LetterOfCredit>,
    @InjectRepository(TradeFinanceTransaction)
    private transactionRepository: Repository<TradeFinanceTransaction>,
    private accountingService: AccountingService,
    private dataSource: DataSource,
  ) {
    super(lcRepository);
  }

  async createLC(createLCDto: CreateLCDto, user: User) {
    return this.create({
      ...createLCDto,
      createdById: user.id,
      status: LCStatus.DRAFT,
    });
  }

  async findAllLC(query: any) {
    const relations = ['salesContract', 'salesContract.buyer', 'createdBy'];
    return this.findAll(query, relations);
  }

  async findOneLC(id: string) {
    const relations = ['salesContract', 'salesContract.buyer', 'createdBy'];
    return this.findOne(id, relations);
  }

  async updateLC(id: string, updateLCDto: UpdateLCDto) {
    return this.update(id, updateLCDto);
  }

  async updateLCStatus(id: string, status: LCStatus) {
    const lc = await this.findOneLC(id);
    this.validateLCStatusTransition(lc.status, status);
    return this.update(id, { status } as any);
  }

  private validateLCStatusTransition(currentStatus: LCStatus, nextStatus: LCStatus) {
    const allowedTransitions: Record<LCStatus, LCStatus[]> = {
      [LCStatus.DRAFT]: [LCStatus.RECEIVED, LCStatus.CANCELLED],
      [LCStatus.RECEIVED]: [LCStatus.DOCUMENTS_PRESENTED, LCStatus.CANCELLED],
      [LCStatus.DOCUMENTS_PRESENTED]: [LCStatus.ACCEPTED, LCStatus.CANCELLED],
      [LCStatus.ACCEPTED]: [LCStatus.PAID, LCStatus.CANCELLED],
      [LCStatus.PAID]: [], 
      [LCStatus.EXPIRED]: [LCStatus.CANCELLED],
      [LCStatus.CANCELLED]: [], 
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái LC từ ${currentStatus} sang ${nextStatus}`,
      );
    }
  }

  /**
   * Tạo giao dịch thanh toán mới
   */
  async createTransaction(data: any, user: User) {
    const transaction = this.transactionRepository.create({
      ...data,
      createdById: user.id,
      status: TradeFinanceStatus.PENDING,
    });
    return this.transactionRepository.save(transaction);
  }

  /**
   * Cập nhật trạng thái giao dịch thanh toán (Senior Refactor: Atomic Transaction)
   */
  async updateTransactionStatus(id: string, status: TradeFinanceStatus, user: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Senior Fix: Lock root first
      const transaction = await queryRunner.manager.findOne(TradeFinanceTransaction, {
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!transaction) throw new BadRequestException('Transaction not found');

      // Load relations separately
      transaction.salesContract = await queryRunner.manager.findOne(SalesContract, { 
        where: { id: transaction.salesContractId },
        relations: ['buyer']
      }) as any;

      this.validateTransactionStatusTransition(transaction.status, status);
      
      transaction.status = status;
      const saved = await queryRunner.manager.save(transaction);

      // Nếu chuyển sang trạng thái đã nhận tiền/đã trả tiền -> Kích hoạt hạch toán
      if (status === TradeFinanceStatus.RECEIVED || status === TradeFinanceStatus.PAID) {
        await this.postAccountingForTransaction(saved, queryRunner.manager);
      }

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  private validateTransactionStatusTransition(current: TradeFinanceStatus, next: TradeFinanceStatus) {
    const transitions: Record<TradeFinanceStatus, TradeFinanceStatus[]> = {
      [TradeFinanceStatus.PENDING]: [TradeFinanceStatus.RECEIVED, TradeFinanceStatus.PAID, TradeFinanceStatus.REJECTED, TradeFinanceStatus.CANCELLED],
      [TradeFinanceStatus.RECEIVED]: [],
      [TradeFinanceStatus.ACCEPTED]: [TradeFinanceStatus.PAID, TradeFinanceStatus.REJECTED],
      [TradeFinanceStatus.PAID]: [],
      [TradeFinanceStatus.REJECTED]: [TradeFinanceStatus.PENDING],
      [TradeFinanceStatus.CANCELLED]: [],
    };
    if (!transitions[current].includes(next)) {
      throw new BadRequestException(`Giao dịch đã ${current}, không thể chuyển sang ${next}`);
    }
  }

  private async postAccountingForTransaction(tx: TradeFinanceTransaction, manager: EntityManager) {
    const vndAmount = Number(tx.amount) * Number(tx.exchangeRate);
    
    // Luồng xuất khẩu: Nợ 112 (Bank), Có 131 (AR - Phải thu khách hàng)
    const journalItems = [
      { 
        accountCode: '112', 
        debit: vndAmount, 
        credit: 0 
      },
      { 
        accountCode: '131', 
        debit: 0, 
        credit: vndAmount, 
        partnerId: tx.salesContract.buyerId 
      }
    ];

    const journal = await this.accountingService.createJournalEntry({
      description: `Ghi nhận thanh toán (${tx.type}): ${tx.salesContract.contractNumber}`,
      referenceType: 'TRADE_FINANCE',
      referenceId: tx.id,
      entryDate: tx.transactionDate || new Date(),
      items: journalItems,
    }, manager);

    tx.journalEntryId = journal.id;
    await manager.save(tx);

    // Xử lý chênh lệch tỷ giá (So với tỷ giá hợp đồng)
    const contractVndValue = Number(tx.amount) * Number(tx.salesContract.exchangeRate);
    if (Math.abs(vndAmount - contractVndValue) > 1) {
      await this.accountingService.processExchangeGainLoss({
        originalVndValue: contractVndValue,
        actualVndValue: vndAmount,
        description: `Chênh lệch tỷ giá (${tx.type}): ${tx.salesContract.contractNumber}`,
        referenceType: 'TRADE_FINANCE',
        referenceId: tx.id,
        partnerId: tx.salesContract.buyerId
      }, manager);
    }
  }

  async findAllTransactions(query: any) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort, population } = aqp(query);
    return this.transactionRepository.find({
        where: filter,
        relations: ['salesContract', 'salesContract.buyer', 'createdBy'],
        order: sort || { createdAt: 'DESC' }
    });
  }
}
