import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  Partner,
  PartnerType,
} from '@/modules/partners/entities/partner.entity';
import {
  AccountReceivable,
  ARSourceType,
  ARStatus,
} from './entities/account-receivable.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import {
  SalesContract,
  SalesContractStatus,
} from '../sales-contracts/entities/sales-contract.entity';
import {
  TradeFinanceTransaction,
  TradeFinanceType,
} from '../trade-finance/entities/trade-finance-transaction.entity';

type TradeFinanceLike = {
  _id: string;
  salesContractId?: string | null;
  amount: number;
  currency?: string;
  exchangeRate: number;
  transactionDate?: Date | null;
};

type CommercialInvoiceLike = {
  _id: string;
  buyer_id: string;
  salesContract_id: string;
  invoiceNumber: string;
  invoiceDate: Date | string;
  dueDate?: Date | string | null;
  totalAmountForeign: number;
  totalAmountVnd: number;
  currency: string;
  exchangeRate: number;
  paymentTerms?: string | null;
};

type PaymentStage = 'ADVANCE' | 'BALANCE' | 'COLLECTION' | 'MANUAL';

type TradeFinanceAllocationSnapshot = {
  _id: string;
  type: TradeFinanceType;
  status: string;
  amount: number;
  currency: string;
  bankReference: string | null;
  transactionDate: Date | null;
};

type EnrichedPaymentAllocation = PaymentAllocation & {
  paymentStage?: PaymentStage;
  tradeFinanceTransaction?: TradeFinanceAllocationSnapshot | null;
};

@Injectable()
export class AccountReceivablesService {
  constructor(
    @InjectRepository(AccountReceivable)
    private readonly arRepository: Repository<AccountReceivable>,
    @InjectRepository(PaymentAllocation)
    private readonly allocationRepository: Repository<PaymentAllocation>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(TradeFinanceTransaction)
    private readonly tradeFinanceTransactionRepository: Repository<TradeFinanceTransaction>,
  ) {}

  private getActorUsername(user?: { username?: string }) {
    return user?.username || 'system';
  }

  private async validateBuyer(buyerId: string) {
    const buyer = await this.partnerRepository.findOneBy({ _id: buyerId });
    if (!buyer) throw new BadRequestException('Buyer không tồn tại');
    if (buyer.partnerType !== PartnerType.CUSTOMER) {
      throw new BadRequestException('Đối tác không phải khách hàng nước ngoài');
    }
  }

  private deriveDueDate(
    invoiceDate: Date,
    paymentTerms?: string | null,
    fallback?: string | Date | null,
  ) {
    if (fallback) return new Date(fallback);

    const match = String(paymentTerms || '').match(/(?:net\s*)?(\d{1,3})/i);
    const days = match ? Number(match[1]) : 30;
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private normalizeStatus(ar: AccountReceivable) {
    const paid = new Decimal(ar.paidAmountForeign || 0);
    const total = new Decimal(ar.amountForeign || 0);
    if (paid.lessThan(0))
      throw new BadRequestException('Số tiền đã thu không được âm');
    if (paid.greaterThan(total))
      throw new BadRequestException(
        'Số tiền đã thu không được vượt quá công nợ',
      );

    if (paid.greaterThanOrEqualTo(total)) return ARStatus.PAID;
    const dueDate = ar.dueDate ? new Date(ar.dueDate) : null;
    if (dueDate && dueDate.getTime() < new Date().setHours(0, 0, 0, 0))
      return ARStatus.OVERDUE;
    if (paid.greaterThan(0)) return ARStatus.PARTIAL;
    return ARStatus.UNPAID;
  }

  private getPaymentStage(type?: TradeFinanceType | null): PaymentStage {
    if (type === TradeFinanceType.TT_ADVANCE) return 'ADVANCE';
    if (type === TradeFinanceType.TT_BALANCE) return 'BALANCE';
    if (type === TradeFinanceType.DP || type === TradeFinanceType.DA)
      return 'COLLECTION';
    return 'MANUAL';
  }

  private async attachTradeFinanceAllocationDetails(rows: AccountReceivable[]) {
    const transactionIds = Array.from(
      new Set(
        rows.flatMap((row) =>
          (row.allocations || [])
            .map((allocation) => allocation.tradeFinanceTransactionId)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    );

    if (transactionIds.length === 0) return rows;

    const transactions = await this.tradeFinanceTransactionRepository.find({
      where: { _id: In(transactionIds) },
    });
    const transactionById = new Map(
      transactions.map((transaction) => [transaction._id, transaction]),
    );

    rows.forEach((row) => {
      (row.allocations || []).forEach((allocation) => {
        const enriched = allocation as EnrichedPaymentAllocation;
        const transaction = allocation.tradeFinanceTransactionId
          ? transactionById.get(allocation.tradeFinanceTransactionId)
          : undefined;

        enriched.paymentStage = this.getPaymentStage(transaction?.type);
        enriched.tradeFinanceTransaction = transaction
          ? {
              _id: transaction._id,
              type: transaction.type,
              status: transaction.status,
              amount: Number(transaction.amount || 0),
              currency: transaction.currency || 'USD',
              bankReference: transaction.bankReference || null,
              transactionDate: transaction.transactionDate || null,
            }
          : null;
      });
    });

    return rows;
  }

  private buildReceivableFromContract(
    contract: SalesContract,
    revenueJournalEntryId: string | null,
    username: string,
  ) {
    const invoiceDate = new Date();
    const amountForeign = Number(contract.totalAmount || 0);
    const exchangeRate = Number(contract.exchangeRate || 1);

    return this.arRepository.create({
      buyerId: contract.buyerId,
      salesContractId: contract._id,
      commercialInvoice_id: null,
      invoiceNumber: `CI-${contract.contractNumber}`,
      sourceType: ARSourceType.COMMERCIAL_INVOICE,
      invoiceDate,
      dueDate: this.deriveDueDate(invoiceDate, contract.paymentTerms),
      amountForeign,
      paidAmountForeign: 0,
      currency: contract.currencyCode || 'USD',
      exchangeRate,
      amountVnd: Number(
        contract.totalAmountVnd || amountForeign * exchangeRate,
      ),
      paidAmountVnd: 0,
      revenueJournalEntryId,
      createdByUsername: username,
      note: `Generated from sales contract ${contract.contractNumber}`,
    });
  }

  async create(dto: CreateAccountReceivableDto, user?: { username?: string }) {
    await this.validateBuyer(dto.buyerId);

    const invoiceDate = new Date(dto.invoiceDate);
    const amountVnd = Number(dto.amountForeign) * Number(dto.exchangeRate);
    const entity = this.arRepository.create({
      ...dto,
      sourceType: dto.sourceType || ARSourceType.COMMERCIAL_INVOICE,
      invoiceDate,
      dueDate: dto.dueDate
        ? new Date(dto.dueDate)
        : this.deriveDueDate(invoiceDate),
      currency: dto.currency || 'USD',
      amountVnd,
      paidAmountForeign: 0,
      paidAmountVnd: 0,
      createdByUsername: this.getActorUsername(user),
      revenueJournalEntryId: null,
    });

    entity.status = dto.status || this.normalizeStatus(entity);
    return this.arRepository.save(entity);
  }

  async createFromSalesContract(
    contract: SalesContract,
    revenueJournalEntryId: string | null,
    manager: EntityManager,
    username = 'system',
  ) {
    const repository = manager.getRepository(AccountReceivable);
    let receivable = await repository.findOne({
      where: { salesContractId: contract._id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!receivable) {
      receivable = this.buildReceivableFromContract(
        contract,
        revenueJournalEntryId,
        username,
      );
    } else if (receivable.status === ARStatus.PAID) {
      return receivable;
    } else {
      receivable.amountForeign = Number(contract.totalAmount || 0);
      receivable.amountVnd = Number(contract.totalAmountVnd || 0);
      receivable.currency = contract.currencyCode || receivable.currency;
      receivable.exchangeRate = Number(
        contract.exchangeRate || receivable.exchangeRate || 1,
      );
      receivable.dueDate = this.deriveDueDate(
        new Date(receivable.invoiceDate),
        contract.paymentTerms,
      );
      receivable.revenueJournalEntryId =
        receivable.revenueJournalEntryId || revenueJournalEntryId;
    }

    receivable.status = this.normalizeStatus(receivable);
    return repository.save(receivable);
  }

  async createFromCommercialInvoice(
    invoice: CommercialInvoiceLike,
    revenueJournalEntryId: string | null,
    manager: EntityManager,
    username = 'system',
  ) {
    const repository = manager.getRepository(AccountReceivable);
    let receivable = await repository.findOne({
      where: { commercialInvoice_id: invoice._id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!receivable && invoice.salesContract_id) {
      receivable = await repository.findOne({
        where: { salesContractId: invoice.salesContract_id },
        lock: { mode: 'pessimistic_write' },
      });
    }

    if (!receivable) {
      receivable = await repository.findOne({
        where: { invoiceNumber: invoice.invoiceNumber },
        lock: { mode: 'pessimistic_write' },
      });
    }

    const invoiceDate = new Date(invoice.invoiceDate);
    const dueDate = this.deriveDueDate(
      invoiceDate,
      invoice.paymentTerms,
      invoice.dueDate || null,
    );
    const amountForeign = Number(invoice.totalAmountForeign || 0);
    const exchangeRate = Number(invoice.exchangeRate || 1);
    const amountVnd = Number(
      invoice.totalAmountVnd || amountForeign * exchangeRate,
    );

    if (!receivable) {
      receivable = repository.create({
        buyerId: invoice.buyer_id,
        salesContractId: invoice.salesContract_id,
        commercialInvoice_id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        sourceType: ARSourceType.COMMERCIAL_INVOICE,
        invoiceDate,
        dueDate,
        amountForeign,
        paidAmountForeign: 0,
        currency: invoice.currency || 'USD',
        exchangeRate,
        amountVnd,
        paidAmountVnd: 0,
        revenueJournalEntryId,
        createdByUsername: username,
        note: `Generated from Commercial Invoice ${invoice.invoiceNumber}`,
      });
    } else if (receivable.status === ARStatus.PAID) {
      return receivable;
    } else {
      receivable.buyerId = invoice.buyer_id;
      receivable.salesContractId = invoice.salesContract_id;
      receivable.commercialInvoice_id = invoice._id;
      receivable.invoiceNumber = invoice.invoiceNumber;
      receivable.sourceType = ARSourceType.COMMERCIAL_INVOICE;
      receivable.invoiceDate = invoiceDate;
      receivable.dueDate = dueDate;
      receivable.amountForeign = amountForeign;
      receivable.amountVnd = amountVnd;
      receivable.currency = invoice.currency || receivable.currency || 'USD';
      receivable.exchangeRate = exchangeRate;
      receivable.revenueJournalEntryId =
        receivable.revenueJournalEntryId || revenueJournalEntryId;
      receivable.note = `Generated from Commercial Invoice ${invoice.invoiceNumber}`;
    }

    receivable.status = this.normalizeStatus(receivable);
    return repository.save(receivable);
  }

  async syncShippedContracts(user?: { username?: string }) {
    void user;
    return {
      syncedCount: 0,
      results: [],
      message:
        'AR sync from shipped Sales Contract is disabled. Issue Commercial Invoice to create AR.',
    };
  }

  async findAll(query: any = {}) {
    const qb = this.arRepository
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.buyer', 'buyer')
      .leftJoinAndSelect('ar.salesContract', 'salesContract')
      .leftJoinAndSelect('ar.allocations', 'allocations')
      .orderBy('ar.updatedAt', 'DESC');

    if (query.buyerId)
      qb.andWhere('ar.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.status)
      qb.andWhere('ar.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere(
        '(ar.invoiceNumber ILIKE :search OR buyer.name ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    const rows = await qb.getMany();
    rows.forEach((row) => {
      if (![ARStatus.PAID, ARStatus.CANCELLED].includes(row.status)) {
        row.status = this.normalizeStatus(row);
      }
    });

    return this.attachTradeFinanceAllocationDetails(rows);
  }

  async findOne(recordId: string) {
    const receivable = await this.arRepository.findOne({
      where: { _id: recordId },
      relations: ['buyer', 'salesContract', 'allocations'],
    });
    if (!receivable)
      throw new NotFoundException('Không tìm thấy công nợ phải thu');
    const [row] = await this.attachTradeFinanceAllocationDetails([receivable]);
    return row;
  }

  async update(recordId: string, dto: UpdateAccountReceivableDto) {
    const receivable = await this.findOne(recordId);
    const payload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (payload.buyerId) await this.validateBuyer(payload.buyerId as string);
    if (payload.invoiceDate)
      payload.invoiceDate = new Date(payload.invoiceDate as any) as any;
    if (payload.dueDate)
      payload.dueDate = new Date(payload.dueDate as any) as any;
    if (payload.amountForeign || payload.exchangeRate) {
      const amountForeign = Number(
        payload.amountForeign ?? receivable.amountForeign,
      );
      const exchangeRate = Number(
        payload.exchangeRate ?? receivable.exchangeRate,
      );
      payload.amountVnd = amountForeign * exchangeRate;
    }

    const merged = { ...receivable, ...payload } as AccountReceivable;
    payload.status = this.normalizeStatus(merged);

    await this.arRepository.update({ _id: recordId }, payload);
    return this.findOne(recordId);
  }

  async allocatePayment(
    recordId: string,
    dto: AllocatePaymentDto,
    user?: { username?: string },
  ) {
    return this.arRepository.manager.transaction(async (manager) => {
      const receivable = await manager.findOne(AccountReceivable, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!receivable)
        throw new NotFoundException('Không tìm thấy công nợ phải thu');

      const openAmount = new Decimal(receivable.amountForeign).minus(
        receivable.paidAmountForeign || 0,
      );
      const allocationAmount = new Decimal(dto.amountForeign);
      if (
        allocationAmount.lessThanOrEqualTo(0) ||
        allocationAmount.greaterThan(openAmount)
      ) {
        throw new BadRequestException('Số tiền phân bổ không hợp lệ');
      }

      const allocation = manager.create(PaymentAllocation, {
        accountReceivableId: receivable._id,
        tradeFinanceTransactionId: dto.tradeFinanceTransactionId || null,
        allocatedAmountForeign: allocationAmount.toNumber(),
        allocatedAmountVnd: allocationAmount.mul(dto.exchangeRate).toNumber(),
        exchangeRate: dto.exchangeRate,
        allocatedAt: dto.allocatedAt ? new Date(dto.allocatedAt) : new Date(),
        allocatedByUsername: this.getActorUsername(user),
        note: dto.note || null,
      });

      await manager.save(allocation);

      receivable.paidAmountForeign = new Decimal(
        receivable.paidAmountForeign || 0,
      )
        .plus(allocation.allocatedAmountForeign)
        .toNumber();
      receivable.paidAmountVnd = new Decimal(receivable.paidAmountVnd || 0)
        .plus(allocation.allocatedAmountVnd)
        .toNumber();
      receivable.status = this.normalizeStatus(receivable);
      await manager.save(receivable);

      return manager.findOne(AccountReceivable, {
        where: { _id: receivable._id },
        relations: ['buyer', 'salesContract', 'allocations'],
      });
    });
  }

  async allocateFromTradeFinanceTransaction(
    tx: TradeFinanceLike,
    manager: EntityManager,
    username = 'system',
  ) {
    if (!tx.salesContractId) return [];

    let receivables = await manager.find(AccountReceivable, {
      where: { salesContractId: tx.salesContractId },
      order: { dueDate: 'ASC', invoiceDate: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    if (!receivables.length) {
      return [];
    }

    let remaining = new Decimal(tx.amount || 0);
    const exchangeRate = Number(tx.exchangeRate || 1);
    const allocations: PaymentAllocation[] = [];

    for (const receivable of receivables) {
      if (remaining.lessThanOrEqualTo(0)) break;
      if ([ARStatus.PAID, ARStatus.CANCELLED].includes(receivable.status))
        continue;

      const openAmount = new Decimal(receivable.amountForeign).minus(
        receivable.paidAmountForeign || 0,
      );
      if (openAmount.lessThanOrEqualTo(0)) continue;

      const allocatedForeign = Decimal.min(openAmount, remaining);
      const allocation = manager.create(PaymentAllocation, {
        accountReceivableId: receivable._id,
        tradeFinanceTransactionId: tx._id,
        allocatedAmountForeign: allocatedForeign.toNumber(),
        allocatedAmountVnd: allocatedForeign.mul(exchangeRate).toNumber(),
        exchangeRate,
        allocatedAt: tx.transactionDate
          ? new Date(tx.transactionDate)
          : new Date(),
        allocatedByUsername: username,
        note: `Allocated from trade finance transaction ${tx._id}`,
      });

      await manager.save(allocation);
      allocations.push(allocation);

      receivable.paidAmountForeign = new Decimal(
        receivable.paidAmountForeign || 0,
      )
        .plus(allocation.allocatedAmountForeign)
        .toNumber();
      receivable.paidAmountVnd = new Decimal(receivable.paidAmountVnd || 0)
        .plus(allocation.allocatedAmountVnd)
        .toNumber();
      receivable.status = this.normalizeStatus(receivable);
      await manager.save(receivable);

      remaining = remaining.minus(allocatedForeign);
    }

    const openCount = await manager.count(AccountReceivable, {
      where: {
        salesContractId: tx.salesContractId,
        status: In([ARStatus.UNPAID, ARStatus.PARTIAL, ARStatus.OVERDUE]),
      },
    });

    if (openCount === 0) {
      await manager.update(
        SalesContract,
        { _id: tx.salesContractId },
        { status: SalesContractStatus.PAID },
      );
    }

    return allocations;
  }

  async getAging() {
    const rows = await this.arRepository.find({
      where: {
        status: In([ARStatus.UNPAID, ARStatus.PARTIAL, ARStatus.OVERDUE]),
      },
      relations: ['buyer'],
    });

    const today = new Date();
    const aging = {
      current: 0,
      days_30: 0,
      days_60: 0,
      days_90: 0,
      over_90: 0,
    };

    for (const row of rows) {
      const amount = new Decimal(row.amountVnd || 0)
        .minus(row.paidAmountVnd || 0)
        .toNumber();
      if (amount <= 0) continue;

      const dueDate = row.dueDate
        ? new Date(row.dueDate)
        : new Date(row.invoiceDate);
      const diffDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24),
      );

      if (diffDays <= 0) aging.current += amount;
      else if (diffDays <= 30) aging.days_30 += amount;
      else if (diffDays <= 60) aging.days_60 += amount;
      else if (diffDays <= 90) aging.days_90 += amount;
      else aging.over_90 += amount;
    }

    return aging;
  }

  async getDso(days = 90) {
    const windowDays =
      Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 365) : 90;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - windowDays);

    const invoices = await this.arRepository
      .createQueryBuilder('ar')
      .where('ar.invoiceDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('ar.status != :cancelled', { cancelled: ARStatus.CANCELLED })
      .getMany();

    const totalCreditSales = invoices.reduce(
      (sum, row) => sum + Number(row.amountVnd || 0),
      0,
    );
    const openAr = invoices.reduce(
      (sum, row) =>
        sum +
        Math.max(
          Number(row.amountVnd || 0) - Number(row.paidAmountVnd || 0),
          0,
        ),
      0,
    );

    return {
      days: windowDays,
      totalCreditSales,
      openAr,
      dso:
        totalCreditSales > 0
          ? Math.round((openAr / totalCreditSales) * windowDays)
          : 0,
    };
  }
}
