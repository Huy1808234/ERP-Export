import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { JournalEntry, JournalStatus } from './entities/journal-entry.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Partner } from '../partners/entities/partner.entity';
import Decimal from 'decimal.js';

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(JournalEntry)
    private journalRepository: Repository<JournalEntry>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
    private dataSource: DataSource,
  ) {}

  async createJournalEntry(data: {
    description: string;
    entryDate?: Date;
    referenceType?: string;
    referenceId?: string;
    items: { accountCode: string; debit: number; credit: number; partnerId?: string }[];
  }, manager?: EntityManager) {
    // 1. Validate Double Entry (Sum Debit == Sum Credit)
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    
    data.items.forEach(item => {
      totalDebit = totalDebit.plus(item.debit || 0);
      totalCredit = totalCredit.plus(item.credit || 0);
    });

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(`Journal entry must balance. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`);
    }

    const execute = async (mgr: EntityManager) => {
      const entryNumber = `JE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const journal = mgr.create(JournalEntry, {
        entryNumber,
        entryDate: data.entryDate || new Date(),
        description: data.description,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        status: JournalStatus.POSTED, // Auto-post for now
      });

      const savedJournal = await mgr.save(journal);

      const ledgerEntries = data.items.map(item => mgr.create(LedgerEntry, {
        ...item,
        journalEntryId: savedJournal.id,
      }));

      for (const entry of ledgerEntries) {
        await mgr.save(entry);
      }

      // TECH LEAD FIX: Sync partner balance sequentially using deterministic calculation
      const partnerIds = [...new Set(ledgerEntries.map(e => e.partnerId).filter(Boolean))];
      for (const pid of partnerIds) {
        await this.syncPartnerBalance(pid as string, mgr);
      }

      return savedJournal;
    };

    if (manager) {
      return execute(manager);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await execute(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteJournalEntriesByReference(refType: string, refId: string, descriptionPattern?: string) {
    const qb = this.journalRepository.createQueryBuilder('je')
      .where('je.referenceType = :refType', { refType })
      .andWhere('je.referenceId = :refId', { refId });
    
    if (descriptionPattern) {
      qb.andWhere('je.description LIKE :pattern', { pattern: `%${descriptionPattern}%` });
    }

    const entries = await qb.leftJoinAndSelect('je.items', 'items').getMany();
    if (entries.length === 0) return;

    // Track which partners need re-sync
    const affectedPartnerIds = new Set<string>();
    entries.forEach(je => {
        je.items?.forEach(le => {
            if (le.partnerId) affectedPartnerIds.add(le.partnerId);
        });
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const entry of entries) {
        await queryRunner.manager.delete(LedgerEntry, { journalEntryId: entry.id });
        await queryRunner.manager.delete(JournalEntry, { id: entry.id });
      }

      // Re-sync only affected partners
      for (const pid of affectedPartnerIds) {
          await this.syncPartnerBalance(pid, queryRunner.manager);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * TECH LEAD CORE LOGIC: Deterministic Balance Sync
   * Recalculates partner balances directly from the General Ledger (LedgerEntry)
   */
  private async syncPartnerBalance(partnerId: string, manager: EntityManager) {
    const partner = await manager.findOne(Partner, { where: { id: partnerId } });
    if (!partner) return;

    // Calculate AR (131)
    const arResult = await manager.createQueryBuilder(LedgerEntry, 'ledger')
      .select('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('ledger.accountCode = :code', { code: '131' })
      .andWhere('ledger.partnerId = :partnerId', { partnerId })
      .getRawOne();
    
    // TECH LEAD FIX: Handle both alias styles (debit vs ledger_debit) and ensure numeric conversion
    const arDebit = new Decimal(arResult?.debit || arResult?.ledger_debit || 0);
    const arCredit = new Decimal(arResult?.credit || arResult?.ledger_credit || 0);
    let arBalance = arDebit.minus(arCredit);

    // Calculate AP (331)
    const apResult = await manager.createQueryBuilder(LedgerEntry, 'ledger')
      .select('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('ledger.accountCode = :code', { code: '331' })
      .andWhere('ledger.partnerId = :partnerId', { partnerId })
      .getRawOne();
    
    const apDebit = new Decimal(apResult?.debit || apResult?.ledger_debit || 0);
    const apCredit = new Decimal(apResult?.credit || apResult?.ledger_credit || 0);
    let apBalance = apCredit.minus(apDebit);

    // Currency Conversion if partner uses USD
    if (partner.defaultCurrency === 'USD') {
      const exRate = 25000; 
      arBalance = arBalance.dividedBy(exRate);
      apBalance = apBalance.dividedBy(exRate);
    }

    await manager.update(Partner, partnerId, {
      currentDebt: arBalance.toNumber(),
      apBalance: apBalance.toNumber()
    });
  }

  async findAllJournal(query: any) {
    const { current, pageSize, startDate, endDate, ...filters } = query;
    const skip = (current - 1) * pageSize;

    const where: any = { ...filters };
    if (startDate && endDate) {
      where.entryDate = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.entryDate = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.entryDate = LessThanOrEqual(new Date(endDate));
    }

    const [results, total] = await this.journalRepository.findAndCount({
      where,
      relations: ['items'],
      order: { entryDate: 'DESC' },
      take: pageSize,
      skip: skip,
    });

    return {
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
    };
  }
  
  async getAccountBalance(accountCode: string) {
    const result = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('SUM(ledger.debit)', 'totalDebit')
      .select('SUM(ledger.credit)', 'totalCredit')
      .where('ledger.accountCode = :accountCode', { accountCode })
      .getRawOne();
      
    const debit = new Decimal(result?.totalDebit || 0);
    const credit = new Decimal(result?.totalCredit || 0);
    return debit.minus(credit).toNumber();
  }

  async getSummaryReport(query?: any) {
    const qb = this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit');

    if (query?.startDate && query?.endDate) {
      qb.innerJoin('ledger.journalEntry', 'je')
        .where('je.entryDate BETWEEN :startDate AND :endDate', {
          startDate: query.startDate,
          endDate: query.endDate,
        });
    }

    const results = await qb.groupBy('ledger.accountCode').getRawMany();

    let revenue = new Decimal(0);
    let cogs = new Decimal(0);
    let expenses = new Decimal(0);

    results.forEach(row => {
      const code = row.code;
      const debit = new Decimal(row.debit || 0);
      const credit = new Decimal(row.credit || 0);

      if (code.startsWith('5')) {
        // Revenue: Credit - Debit
        revenue = revenue.plus(credit.minus(debit));
      } else if (code === '632') {
        // COGS: Debit - Credit
        cogs = cogs.plus(debit.minus(credit));
      } else if (code.startsWith('6')) {
        // Other expenses
        expenses = expenses.plus(debit.minus(credit));
      }
    });

    return {
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      expenses: expenses.toNumber(),
      netProfit: revenue.minus(cogs).minus(expenses).toNumber(),
    };
  }

  async getOverdueAging() {
    const today = new Date();
    
    // Fetch all unpaid vendor invoices
    // Note: In a real app, use a dedicated Invoice Repository
    const invoices = await this.dataSource.getRepository('vendor_invoices')
      .createQueryBuilder('vi')
      .leftJoinAndSelect('vi.vendor', 'vendor')
      .where('vi.status = :status', { status: 'PENDING' })
      .getMany();

    const aging = {
      current: 0,
      days_30: 0,
      days_60: 0,
      days_90: 0,
      over_90: 0,
    };

    invoices.forEach((inv: any) => {
      const dueDate = new Date(inv.dueDate || inv.createdAt);
      const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

      const amount = Number(inv.totalAmount || 0);

      if (diffDays <= 0) aging.current += amount;
      else if (diffDays <= 30) aging.days_30 += amount;
      else if (diffDays <= 60) aging.days_60 += amount;
      else if (diffDays <= 90) aging.days_90 += amount;
      else aging.over_90 += amount;
    });

    return aging;
  }

  async getBalanceSheet(query?: any) {
    const qb = this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit');

    if (query?.startDate && query?.endDate) {
      qb.innerJoin('ledger.journalEntry', 'je')
        .where('je.entryDate BETWEEN :startDate AND :endDate', {
          startDate: query.startDate,
          endDate: query.endDate,
        });
    }

    const results = await qb.groupBy('ledger.accountCode').getRawMany();

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    results.forEach(row => {
      const code = row.code;
      const debit = new Decimal(row.debit || 0);
      const credit = new Decimal(row.credit || 0);
      const balance = debit.minus(credit);

      const item = { code, name: this.getAccountName(code), balance: balance.toNumber() };

      if (code.startsWith('1')) {
        assets.push(item);
      } else if (code.startsWith('3')) {
        // Liabilities balances are usually Credit - Debit
        item.balance = credit.minus(debit).toNumber();
        liabilities.push(item);
      } else if (code.startsWith('4')) {
        item.balance = credit.minus(debit).toNumber();
        equity.push(item);
      }
    });

    // Add current P&L to Equity (simplified)
    const summary = await this.getSummaryReport();
    equity.push({ code: '333', name: 'Lợi nhuận chưa phân phối (P&L)', balance: summary.netProfit });

    return { assets, liabilities, equity };
  }

  async getVatReport() {
    const results = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('ledger.accountCode IN (:...codes)', { codes: ['133', '3331'] })
      .groupBy('ledger.accountCode')
      .getRawMany();

    const inputVat = results.find(r => r.code === '133');
    const outputVat = results.find(r => r.code === '3331');

    return {
      inputVat: new Decimal(inputVat?.debit || 0).minus(inputVat?.credit || 0).toNumber(),
      outputVat: new Decimal(outputVat?.credit || 0).minus(outputVat?.debit || 0).toNumber(),
      netVatPayable: new Decimal(outputVat?.credit || 0).minus(inputVat?.debit || 0).toNumber(),
      details: results.map(r => ({
          code: r.code,
          name: this.getAccountName(r.code),
          debit: Number(r.debit),
          credit: Number(r.credit)
      }))
    };
  }

  /**
   * Xử lý chênh lệch tỷ giá (Mục 10 PRD)
   * Realized Gain/Loss khi thu/thanh toán ngoại tệ
   */
  async processExchangeGainLoss(data: {
    originalVndValue: number;
    actualVndValue: number;
    description: string;
    referenceType: string;
    referenceId: string;
    partnerId?: string;
  }, manager?: EntityManager) {
    const diff = new Decimal(data.actualVndValue).minus(data.originalVndValue);
    if (diff.equals(0)) return null;

    const items: { accountCode: string; debit: number; credit: number; partnerId?: string }[] = [];
    if (diff.greaterThan(0)) {
      // Lãi tỷ giá (Gain): Nợ 131/112, Có 515
      items.push({ accountCode: '515', debit: 0, credit: diff.abs().toNumber() });
      items.push({ accountCode: '131', debit: diff.abs().toNumber(), credit: 0, partnerId: data.partnerId });
    } else {
      // Lỗ tỷ giá (Loss): Nợ 635, Có 131/112
      items.push({ accountCode: '635', debit: diff.abs().toNumber(), credit: 0 });
      items.push({ accountCode: '131', debit: 0, credit: diff.abs().toNumber(), partnerId: data.partnerId });
    }

    return this.createJournalEntry({
      description: `${data.description} (Exchange Rate Diff)`,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      items,
    }, manager);
  }

  private getAccountName(code: string): string {
    const map: Record<string, string> = {
      '111': 'Tiền mặt',
      '112': 'Tiền gửi ngân hàng',
      '131': 'Phải thu khách hàng (AR)',
      '133': 'Thuế GTGT được khấu trừ (Đầu vào)',
      '156': 'Hàng hóa tồn kho',
      '331': 'Phải trả người bán (AP)',
      '333': 'Thuế và các khoản phải nộp',
      '3331': 'Thuế GTGT phải nộp (Đầu ra)',
      '411': 'Vốn góp chủ sở hữu',
      '511': 'Doanh thu bán hàng',
      '632': 'Giá vốn hàng bán',
    };
    return map[code] || `Tài khoản ${code}`;
  }
}
