import { createHash } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { JournalEntry, JournalStatus } from './entities/journal-entry.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { AccountingPeriod, AccountingPeriodStatus } from './entities/accounting-period.entity';
import {
  FxRevaluation,
  FxRevaluationSourceType,
  FxRevaluationStatus,
} from './entities/fx-revaluation.entity';
import { VatRefundDossier, VatRefundStatus } from './entities/vat-refund-dossier.entity';
import { AccountingAuditEvent } from './entities/accounting-audit-event.entity';
import { AccountingClosePolicyService } from './accounting-close-policy.service';
import { Partner } from '../partners/entities/partner.entity';
import { AccountPayable, APStatus } from '../account-payables/entities/account-payable.entity';
import { AccountReceivable, ARStatus } from '../account-receivables/entities/account-receivable.entity';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { RunFxRevaluationDto } from './dto/run-fx-revaluation.dto';
import { CreateVatRefundDossierDto } from './dto/create-vat-refund-dossier.dto';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import type { AuthenticatedUser, QueryParams } from '@/common/types/authenticated-user.type';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import { DocumentType, ExportDocument } from '../export-documents/entities/export-document.entity';
import { AccountingPeriodGuardService } from './accounting-period-guard.service';

type JournalItemInput = {
  accountCode: string;
  debit: number;
  credit: number;
  partnerId?: string;
};

type AccountingAuditPayload = Record<string, unknown>;

type AccountingAuditInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  referenceType?: string | null;
  referenceId?: string | null;
  username?: string | null;
  payload?: AccountingAuditPayload | null;
};

type TaxDocumentTraceItem = {
  _id: string;
  documentType: DocumentType;
  documentNumber: string | null;
  shipmentId: string;
  shipmentNumber: string | null;
  salesContract_id: string | null;
  contractNumber: string | null;
  traceDate: string | null;
  checklistStatus: string;
  customsDeclarationNumber?: string | null;
  businessData?: Record<string, unknown> | null;
};

type VatRefundTraceItem = {
  _id: string;
  dossierNumber: string;
  status: VatRefundStatus;
  refundAmount: number;
  periodStart: string;
  periodEnd: string;
  taxReportHash: string | null;
  receivableJournalEntryId: string | null;
  paymentJournalEntryId: string | null;
};

type TaxDocumentTrace = {
  customsDeclarations: TaxDocumentTraceItem[];
  certificatesOfOrigin: TaxDocumentTraceItem[];
  vatRefundDossiers: VatRefundTraceItem[];
};

type TaxReconciliation = {
  customsDeclarationCount: number;
  certificateOfOriginCount: number;
  vatRefundDossierCount: number;
  tracedVatJournalLineCount: number;
  untracedVatJournalLineCount: number;
  refundableVatCoveredByDossier: boolean;
};


@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(JournalEntry)
    private journalRepository: Repository<JournalEntry>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
    @InjectRepository(AccountingPeriod)
    private accountingPeriodRepository: Repository<AccountingPeriod>,
    @InjectRepository(FxRevaluation)
    private fxRevaluationRepository: Repository<FxRevaluation>,
    @InjectRepository(VatRefundDossier)
    private vatRefundRepository: Repository<VatRefundDossier>,
    @InjectRepository(AccountingAuditEvent)
    private accountingAuditRepository: Repository<AccountingAuditEvent>,
    private dataSource: DataSource,
    private approvalMatrixService: ApprovalMatrixService,
    private accountingClosePolicyService: AccountingClosePolicyService,
    private accountingPeriodGuardService: AccountingPeriodGuardService,
  ) {}

  private getUsername(user?: AuthenticatedUser) {
    return user?.username || 'system';
  }

  private createDocumentNumber(prefix: string, date = new Date()) {
    const suffix = createOpaqueCode(prefix.toLowerCase()).split('_').pop()?.toUpperCase();
    return `${prefix}-${dayjs(date).format('YYYYMMDD-HHmmss')}-${suffix}`;
  }

  private hashPayload(payload: unknown) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private toDateOnly(value: Date | string) {
    return dayjs(value).format('YYYY-MM-DD');
  }

  private toTraceDate(value: unknown): dayjs.Dayjs | null {
    if (value instanceof Date) {
      const parsed = dayjs(value);
      return parsed.isValid() ? parsed : null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = dayjs(value);
      return parsed.isValid() ? parsed : null;
    }

    return null;
  }

  private pickBusinessDate(data: Record<string, unknown> | null | undefined, keys: string[]) {
    for (const key of keys) {
      const parsed = this.toTraceDate(data?.[key]);
      if (parsed) return parsed;
    }

    return null;
  }

  private isDateInsideRange(value: dayjs.Dayjs | null, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    if (!value) return false;
    return !value.isBefore(start, 'day') && !value.isAfter(end, 'day');
  }

  private resolveExportDocumentTraceDate(document: ExportDocument) {
    return (
      this.toTraceDate(document.customsClearedAt) ||
      this.toTraceDate(document.issueDate) ||
      this.pickBusinessDate(document.businessData, [
        'clearanceDate',
        'declarationDate',
        'issueDate',
        'fumigationDate',
        'inspectionDate',
        'departureDate',
        'onBoardDate',
      ]) ||
      this.toTraceDate(document.createdAt)
    );
  }

  private mapExportDocumentTrace(document: ExportDocument, traceDate: dayjs.Dayjs | null): TaxDocumentTraceItem {
    return {
      _id: document._id,
      documentType: document.documentType,
      documentNumber: document.documentNumber || null,
      shipmentId: document.shipmentId,
      shipmentNumber: document.shipment?.shipmentNumber || null,
      salesContract_id: document.shipment?.salesContract?._id || null,
      contractNumber: document.shipment?.salesContract?.contractNumber || null,
      traceDate: traceDate ? traceDate.format('YYYY-MM-DD') : null,
      checklistStatus: document.checklistStatus,
      customsDeclarationNumber: document.customsDeclarationNumber || null,
      businessData: document.businessData || null,
    };
  }

  private async buildTaxDocumentTrace(start: dayjs.Dayjs, end: dayjs.Dayjs): Promise<TaxDocumentTrace> {
    const documentRepository = this.dataSource.getRepository(ExportDocument);
    const documents = await documentRepository.find({
      where: {
        isCurrentVersion: true,
        documentType: In([
          DocumentType.CUSTOMS_DECLARATION,
          DocumentType.CERTIFICATE_OF_ORIGIN,
        ]),
      },
      relations: ['shipment', 'shipment.salesContract'],
      order: { createdAt: 'DESC' },
    });

    const customsDeclarations: TaxDocumentTraceItem[] = [];
    const certificatesOfOrigin: TaxDocumentTraceItem[] = [];

    for (const document of documents) {
      const traceDate = this.resolveExportDocumentTraceDate(document);
      if (!this.isDateInsideRange(traceDate, start, end)) continue;

      const traceItem = this.mapExportDocumentTrace(document, traceDate);
      if (document.documentType === DocumentType.CUSTOMS_DECLARATION) {
        customsDeclarations.push(traceItem);
      }
      if (document.documentType === DocumentType.CERTIFICATE_OF_ORIGIN) {
        certificatesOfOrigin.push(traceItem);
      }
    }

    const vatRefunds = await this.vatRefundRepository
      .createQueryBuilder('vat')
      .where('vat.periodStart <= :endDate', { endDate: end.format('YYYY-MM-DD') })
      .andWhere('vat.periodEnd >= :startDate', { startDate: start.format('YYYY-MM-DD') })
      .orderBy('vat.periodEnd', 'DESC')
      .addOrderBy('vat.createdAt', 'DESC')
      .getMany();

    return {
      customsDeclarations,
      certificatesOfOrigin,
      vatRefundDossiers: vatRefunds.map((record) => ({
        _id: record._id,
        dossierNumber: record.dossierNumber,
        status: record.status,
        refundAmount: Number(record.refundAmount || 0),
        periodStart: this.toDateOnly(record.periodStart),
        periodEnd: this.toDateOnly(record.periodEnd),
        taxReportHash: record.taxReportHash || null,
        receivableJournalEntryId: record.receivableJournalEntryId || null,
        paymentJournalEntryId: record.paymentJournalEntryId || null,
      })),
    };
  }

  private buildTaxReconciliation(params: {
    documentTrace: TaxDocumentTrace;
    journalLines: Record<string, unknown>[];
    refundableVat: Decimal;
  }): TaxReconciliation {
    const tracedVatJournalLineCount = params.journalLines.filter((line) => Boolean(line.referenceId)).length;
    const untracedVatJournalLineCount = params.journalLines.length - tracedVatJournalLineCount;

    return {
      customsDeclarationCount: params.documentTrace.customsDeclarations.length,
      certificateOfOriginCount: params.documentTrace.certificatesOfOrigin.length,
      vatRefundDossierCount: params.documentTrace.vatRefundDossiers.length,
      tracedVatJournalLineCount,
      untracedVatJournalLineCount,
      refundableVatCoveredByDossier:
        params.refundableVat.lessThanOrEqualTo(0) ||
        params.documentTrace.vatRefundDossiers.some((record) =>
          [VatRefundStatus.SUBMITTED, VatRefundStatus.APPROVED, VatRefundStatus.PAID].includes(record.status),
        ),
    };
  }

  private escapeCsvValue(value: unknown) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  private formatAuditTimestamp(value: Date) {
    return dayjs(value).format('YYYY-MM-DDTHH:mm:ss.SSS');
  }

  private buildPeriodHash(period: AccountingPeriod, extra: AccountingAuditPayload = {}) {
    return this.hashPayload({
      periodId: period._id,
      startDate: this.toDateOnly(period.startDate),
      endDate: this.toDateOnly(period.endDate),
      status: period.status,
      closingJournalEntryId: period.closingJournalEntryId,
      reopenCount: period.reopenCount || 0,
      ...extra,
    });
  }

  private async appendAccountingAuditEvent(
    data: AccountingAuditInput,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(AccountingAuditEvent)
      : this.accountingAuditRepository;
    const latest =
      (
        await repository.find({
          order: { createdAt: 'DESC', _id: 'DESC' },
          take: 1,
        })
      )[0] || null;
    const eventAt = new Date();
    const eventAtFingerprint = this.formatAuditTimestamp(eventAt);
    const previousHash = latest?.eventHash || null;
    const payload = data.payload || null;
    const eventHash = this.hashPayload({
      eventType: data.eventType,
      entityType: data.entityType,
      entityId: data.entityId,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      username: data.username || null,
      eventAt: eventAtFingerprint,
      payload,
      previousHash,
    });

    const event = repository.create({
      eventType: data.eventType,
      entityType: data.entityType,
      entityId: data.entityId,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      username: data.username || null,
      eventAt,
      payload,
      previousHash,
      eventHash,
    });

    return repository.save(event);
  }

  private async findExactPeriod(
    startDate: dayjs.Dayjs,
    endDate: dayjs.Dayjs,
    manager: EntityManager,
  ) {
    return manager.getRepository(AccountingPeriod)
      .createQueryBuilder('period')
      .where('period.startDate = :startDate', { startDate: startDate.format('YYYY-MM-DD') })
      .andWhere('period.endDate = :endDate', { endDate: endDate.format('YYYY-MM-DD') })
      .getOne();
  }

  private async assertNoPreviousOpenPeriods(period: AccountingPeriod, manager: EntityManager) {
    const previousOpen = await manager.getRepository(AccountingPeriod)
      .createQueryBuilder('candidate')
      .where('candidate.status = :status', { status: AccountingPeriodStatus.OPEN })
      .andWhere('candidate.endDate < :startDate', { startDate: this.toDateOnly(period.startDate) })
      .andWhere('candidate._id != :recordId', { recordId: period._id })
      .orderBy('candidate.endDate', 'ASC')
      .getOne();

    if (previousOpen) {
      throw new BadRequestException('Close earlier open accounting periods before closing this period.');
    }
  }

  private async assertNoLaterClosedOrLockedPeriods(period: AccountingPeriod, manager: EntityManager) {
    const laterPeriod = await manager.getRepository(AccountingPeriod)
      .createQueryBuilder('candidate')
      .where('candidate.status IN (:...statuses)', {
        statuses: [AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.LOCKED],
      })
      .andWhere('candidate.startDate > :endDate', { endDate: this.toDateOnly(period.endDate) })
      .orderBy('candidate.startDate', 'ASC')
      .getOne();

    if (laterPeriod) {
      throw new BadRequestException('Cannot reopen a period while later periods are closed or locked.');
    }
  }

  private normalizeMoney(value: unknown, fieldName: string) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException(`${fieldName} must be a non-negative finite number`);
    }

    return new Decimal(amount).toDecimalPlaces(2);
  }

  private validateJournalItems(items: JournalItemInput[]) {
    if (!Array.isArray(items) || items.length < 2) {
      throw new BadRequestException('Journal entry must contain at least two lines');
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const normalizedItems = items.map((item, index) => {
      if (!item.accountCode || !/^[0-9]{3,4}$/.test(String(item.accountCode))) {
        throw new BadRequestException(`Invalid account code at line ${index + 1}`);
      }

      const debit = this.normalizeMoney(item.debit, `Line ${index + 1} debit`);
      const credit = this.normalizeMoney(item.credit, `Line ${index + 1} credit`);

      if (debit.greaterThan(0) && credit.greaterThan(0)) {
        throw new BadRequestException(`Line ${index + 1} cannot have both debit and credit`);
      }
      if (debit.equals(0) && credit.equals(0)) {
        throw new BadRequestException(`Line ${index + 1} must have either debit or credit`);
      }

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      return {
        accountCode: String(item.accountCode),
        debit: debit.toNumber(),
        credit: credit.toNumber(),
        partnerId: item.partnerId,
      };
    });

    if (!totalDebit.equals(totalCredit) || totalDebit.equals(0)) {
      throw new BadRequestException(
        `Journal entry must balance. Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}`,
      );
    }

    return normalizedItems;
  }

  async createJournalEntry(data: {
    description: string;
    entryDate?: Date;
    referenceType?: string;
    referenceId?: string;
    createdByUsername?: string;
    items: JournalItemInput[];
  }, manager?: EntityManager) {
    const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
    const normalizedItems = this.validateJournalItems(data.items);
    const postingPeriod = await this.accountingPeriodGuardService.assertPostingAllowed({
      entryDate,
      referenceType: data.referenceType || null,
      reference_id: data.referenceId || null,
      description: data.description,
    }, manager);
    const execute = async (mgr: EntityManager) => {
      const entryNumber = `JE-${dayjs().format('YYYYMMDD-HHmmss')}-${createOpaqueCode('je_no').split('_').pop()?.toUpperCase()}`;
      
      const journal = mgr.create(JournalEntry, {
        entryNumber,
        entryDate: entryDate,
        description: data.description,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        createdByUsername: data.createdByUsername || 'system',
        status: JournalStatus.POSTED, // Auto-post for now
      });

      const savedJournal = await mgr.save(journal);

      const ledgerEntries = normalizedItems.map(item => mgr.create(LedgerEntry, {
        ...item,
        journalEntryId: savedJournal._id,
      }));

      for (const entry of ledgerEntries) {
        await mgr.save(entry);
      }

      // TECH LEAD FIX: Sync partner balance sequentially using deterministic calculation
      const partnerIds = [...new Set(ledgerEntries.map(e => e.partnerId).filter(Boolean))];
      for (const pid of partnerIds) {
        await this.syncPartnerBalance(pid as string, mgr);
      }

      await this.appendAccountingAuditEvent({
        eventType: 'JOURNAL_POSTED',
        entityType: 'journal_entries',
        entityId: savedJournal._id,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        username: data.createdByUsername || 'system',
        payload: {
          entryNumber,
          entryDate: entryDate.toISOString(),
          description: data.description,
          totalDebit: normalizedItems.reduce((sum, item) => sum + Number(item.debit || 0), 0),
          lineCount: normalizedItems.length,
          accountingPeriod_id: postingPeriod._id,
          periodStatus: postingPeriod.status,
          periodStartDate: this.toDateOnly(postingPeriod.startDate),
          periodEndDate: this.toDateOnly(postingPeriod.endDate),
        },
      }, mgr);

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
        const existingReversal = await queryRunner.manager.getRepository(JournalEntry).findOne({
          where: {
            referenceType: 'ACCOUNTING_REVERSAL',
            referenceId: entry._id,
            status: JournalStatus.POSTED,
          },
        });
        if (existingReversal) continue;

        await this.createJournalEntry({
          description: `Reversal for ${entry.entryNumber}: ${entry.description}`,
          entryDate: new Date(),
          referenceType: 'ACCOUNTING_REVERSAL',
          referenceId: entry._id,
          createdByUsername: 'system',
          items: (entry.items || []).map((item) => ({
            accountCode: item.accountCode,
            debit: Number(item.credit || 0),
            credit: Number(item.debit || 0),
            partnerId: item.partnerId,
          })),
        }, queryRunner.manager);

        await this.appendAccountingAuditEvent({
          eventType: 'JOURNAL_REVERSED',
          entityType: 'journal_entries',
          entityId: entry._id,
          referenceType: refType,
          referenceId: refId,
          username: 'system',
          payload: {
            entryNumber: entry.entryNumber,
            descriptionPattern: descriptionPattern || null,
            reason: 'Immutable reversal generated instead of deleting posted accounting records',
          },
        }, queryRunner.manager);
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
    const partner = await manager.findOne(Partner, { where: { _id: partnerId } });
    if (!partner) return;

    // Calculate AR (131)
    const arResult = await manager.createQueryBuilder(LedgerEntry, 'ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('ledger.accountCode = :code', { code: '131' })
      .andWhere('ledger.partnerId = :partnerId', { partnerId })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .getRawOne();
    
    // TECH LEAD FIX: Handle both alias styles (debit vs ledger_debit) and ensure numeric conversion
    const arDebit = new Decimal(arResult?.debit || arResult?.ledger_debit || 0);
    const arCredit = new Decimal(arResult?.credit || arResult?.ledger_credit || 0);
    let arBalance = arDebit.minus(arCredit);

    // Calculate AP (331)
    const apResult = await manager.createQueryBuilder(LedgerEntry, 'ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('ledger.accountCode = :code', { code: '331' })
      .andWhere('ledger.partnerId = :partnerId', { partnerId })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
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

    await manager.update(Partner, { _id: partnerId }, {
      currentDebt: arBalance.toNumber(),
      apBalance: apBalance.toNumber()
    });
  }

  async findAllJournal(query: any) {
    const { current: currentRaw, pageSize: pageSizeRaw, startDate, endDate, ...filters } = query ?? {};
    const requestedCurrent = Number(currentRaw);
    const requestedPageSize = Number(pageSizeRaw);
    const current = Number.isFinite(requestedCurrent) && requestedCurrent > 0 ? requestedCurrent : 1;
    const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? requestedPageSize : 20;
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
      .innerJoin('ledger.journalEntry', 'je')
      .select('SUM(ledger.debit)', 'totalDebit')
      .addSelect('SUM(ledger.credit)', 'totalCredit')
      .where('ledger.accountCode = :accountCode', { accountCode })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .getRawOne();
      
    const debit = new Decimal(result?.totalDebit || 0);
    const credit = new Decimal(result?.totalCredit || 0);
    return debit.minus(credit).toNumber();
  }

  async getAccountBalanceForPartner(accountCode: string, partnerId: string) {
    const result = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('SUM(ledger.debit)', 'totalDebit')
      .addSelect('SUM(ledger.credit)', 'totalCredit')
      .where('ledger.accountCode = :accountCode', { accountCode })
      .andWhere('ledger.partnerId = :partnerId', { partnerId })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .getRawOne();

    const debit = new Decimal(result?.totalDebit || 0);
    const credit = new Decimal(result?.totalCredit || 0);

    if (accountCode === '131') return debit.minus(credit).toNumber();
    if (accountCode === '331') return credit.minus(debit).toNumber();

    return debit.minus(credit).toNumber();
  }

  async getSummaryReport(query?: any) {
    const current = await this.calculateSummary(query?.startDate, query?.endDate);

    // Calculate previous period
    if (query?.startDate && query?.endDate) {
      const start = dayjs(query.startDate);
      const end = dayjs(query.endDate);
      const diff = end.diff(start, 'day');
      const prevStart = start.subtract(diff + 1, 'day').toISOString();
      const prevEnd = start.subtract(1, 'day').toISOString();
      const previous = await this.calculateSummary(prevStart, prevEnd);
      return { current, previous };
    }

    return { current, previous: current };
  }

  private async calculateSummary(startDate?: string, endDate?: string) {
    const qb = this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('je.status = :status', { status: JournalStatus.POSTED });

    if (startDate && endDate) {
      qb.andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
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
        revenue = revenue.plus(credit.minus(debit));
      } else if (code === '632') {
        cogs = cogs.plus(debit.minus(credit));
      } else if (code.startsWith('6')) {
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

  async getTrendReport(query?: any) {
    const startDate = query?.startDate ? new Date(query.startDate) : dayjs().subtract(6, 'month').startOf('month').toDate();
    const endDate = query?.endDate ? new Date(query.endDate) : new Date();

    const results = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select("TO_CHAR(je.entryDate, 'YYYY-MM')", 'month')
      .addSelect('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('je.entryDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .groupBy("TO_CHAR(je.entryDate, 'YYYY-MM')")
      .addGroupBy('ledger.accountCode')
      .orderBy("TO_CHAR(je.entryDate, 'YYYY-MM')", 'ASC')
      .getRawMany();

    const monthlyData: Record<string, any> = {};

    results.forEach(row => {
      const month = row.month;
      if (!monthlyData[month]) {
        monthlyData[month] = { month, revenue: 0, cogs: 0, expenses: 0, netProfit: 0 };
      }

      const code = row.code;
      const debit = new Decimal(row.debit || 0);
      const credit = new Decimal(row.credit || 0);

      if (code.startsWith('5')) {
        monthlyData[month].revenue += credit.minus(debit).toNumber();
      } else if (code === '632') {
        monthlyData[month].cogs += debit.minus(credit).toNumber();
      } else if (code.startsWith('6')) {
        monthlyData[month].expenses += debit.minus(credit).toNumber();
      }
    });

    Object.values(monthlyData).forEach((data: any) => {
      data.netProfit = data.revenue - data.cogs - data.expenses;
    });

    return Object.values(monthlyData);
  }


  async getOverdueAging() {
    const today = new Date();

    const payables = await this.dataSource.getRepository(AccountPayable)
      .createQueryBuilder('ap')
      .where('ap.status != :status', { status: APStatus.PAID })
      .getMany();

    const aging = {
      current: 0,
      days_30: 0,
      days_60: 0,
      days_90: 0,
      over_90: 0,
    };

    payables.forEach((ap) => {
      const dueDate = new Date(ap.dueDate || ap.createdAt);
      const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
      const amount = Math.max(Number(ap.amount || 0) - Number(ap.paidAmount || 0), 0);
      if (amount <= 0) return;

      if (diffDays <= 0) aging.current += amount;
      else if (diffDays <= 30) aging.days_30 += amount;
      else if (diffDays <= 60) aging.days_60 += amount;
      else if (diffDays <= 90) aging.days_90 += amount;
      else aging.over_90 += amount;
    });

    return aging;
  }

  async getARAging() {
    const receivableRepository = this.dataSource.getRepository(AccountReceivable);
    const receivables = await receivableRepository.find({
      where: { status: In([ARStatus.UNPAID, ARStatus.PARTIAL, ARStatus.OVERDUE]) },
    });

    if (receivables.length > 0) {
      const today = new Date();
      const aging = { current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0 };

      for (const receivable of receivables) {
        const amount = new Decimal(receivable.amountVnd || 0)
          .minus(receivable.paidAmountVnd || 0)
          .toNumber();
        if (amount <= 0) continue;

        const dueDate = receivable.dueDate
          ? new Date(receivable.dueDate)
          : new Date(receivable.invoiceDate);
        const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays <= 0) aging.current += amount;
        else if (diffDays <= 30) aging.days_30 += amount;
        else if (diffDays <= 60) aging.days_60 += amount;
        else if (diffDays <= 90) aging.days_90 += amount;
        else aging.over_90 += amount;
      }

      return aging;
    }

    const today = new Date();

    const entries = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoinAndSelect('ledger.journalEntry', 'journalEntry')
      .where('ledger.accountCode = :accountCode', { accountCode: '131' })
      .andWhere('journalEntry.status = :status', { status: JournalStatus.POSTED })
      .orderBy('journalEntry.entryDate', 'ASC')
      .addOrderBy('ledger.createdAt', 'ASC')
      .getMany();

    const aging = { current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0 };
    const openDebitsByPartner = new Map<string, Array<{ entryDate: Date; remaining: Decimal }>>();

    for (const entry of entries) {
      const partnerKey = entry.partnerId || '_unassigned';
      if (!openDebitsByPartner.has(partnerKey)) {
        openDebitsByPartner.set(partnerKey, []);
      }

      const openDebits = openDebitsByPartner.get(partnerKey)!;
      const debit = new Decimal(entry.debit || 0);
      const credit = new Decimal(entry.credit || 0);

      if (debit.greaterThan(0)) {
        openDebits.push({
          entryDate: entry.journalEntry?.entryDate || entry.createdAt,
          remaining: debit,
        });
        continue;
      }

      let unappliedCredit = credit;
      for (const debitLine of openDebits) {
        if (unappliedCredit.lessThanOrEqualTo(0)) break;
        if (debitLine.remaining.lessThanOrEqualTo(0)) continue;

        const applied = Decimal.min(debitLine.remaining, unappliedCredit);
        debitLine.remaining = debitLine.remaining.minus(applied);
        unappliedCredit = unappliedCredit.minus(applied);
      }
    }

    for (const openDebits of openDebitsByPartner.values()) {
      for (const debitLine of openDebits) {
        if (debitLine.remaining.lessThanOrEqualTo(0)) continue;

        const diffDays = Math.floor((today.getTime() - new Date(debitLine.entryDate).getTime()) / (1000 * 3600 * 24));
        const amount = debitLine.remaining.toNumber();

        if (diffDays <= 0) aging.current += amount;
      else if (diffDays <= 30) aging.days_30 += amount;
      else if (diffDays <= 60) aging.days_60 += amount;
      else if (diffDays <= 90) aging.days_90 += amount;
      else aging.over_90 += amount;
      }
    }

    return aging;
  }

  async getCashFlowReport(query: any) {
    const startDate = query?.startDate ? new Date(query.startDate) : dayjs().startOf('month').toDate();
    const endDate = query?.endDate ? new Date(query.endDate) : new Date();

    const results = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('je.entryDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('(ledger.accountCode LIKE :cash1 OR ledger.accountCode LIKE :cash2)', { cash1: '111%', cash2: '112%' })
      .groupBy('ledger.accountCode')
      .getRawMany();

    let inflows = 0;
    let outflows = 0;

    results.forEach(row => {
      inflows += Number(row.debit || 0);
      outflows += Number(row.credit || 0);
    });

    return {
      operatingInflow: inflows,
      operatingOutflow: outflows,
      netCashFlow: inflows - outflows,
    };
  }

  async getFinancialRatios(query: any) {
    const balance = await this.getBalanceSheet(query);
    const summary = await this.getSummaryReport(query);

    const currentAssets = balance.assets.filter(a => ['111', '112', '131', '152', '156'].includes(a.code)).reduce((s, i) => s + i.balance, 0);
    const currentLiabilities = balance.liabilities.filter(l => ['331', '333'].includes(l.code)).reduce((s, i) => s + i.balance, 0);

    return {
      currentRatio: currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 0,
      grossMargin: summary.current.revenue > 0 ? ((summary.current.revenue - summary.current.cogs) / summary.current.revenue) : 0,
      netMargin: summary.current.revenue > 0 ? (summary.current.netProfit / summary.current.revenue) : 0,
      inventoryTurnover: summary.current.cogs > 0 ? (summary.current.cogs / (currentAssets * 0.5 || 1)) : 0,
    };
  }

  async getBalanceSheet(query?: any) {
    const qb = this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('je.status = :status', { status: JournalStatus.POSTED });

    if (query?.startDate && query?.endDate) {
      qb.andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
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
    equity.push({ code: '421', name: this.getAccountName('421'), balance: summary.current.netProfit });

    return { assets, liabilities, equity };
  }

  async getVatReport(query?: any) {
    const start = query?.startDate ? dayjs(query.startDate).startOf('day') : dayjs().startOf('month');
    const end = query?.endDate ? dayjs(query.endDate).endOf('day') : dayjs().endOf('month');
    if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
      throw new BadRequestException('Tax report period is invalid');
    }

    const taxAccounts = ['133', '1331', '3331', '511', '3387'];
    const qb = this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('ledger.accountCode IN (:...codes)', { codes: taxAccounts })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
        startDate: start.toDate(),
        endDate: end.toDate(),
      });

    const results = await qb.groupBy('ledger.accountCode').orderBy('ledger.accountCode', 'ASC').getRawMany();
    const journalLines = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger._id', '_id')
      .addSelect('ledger.accountCode', 'accountCode')
      .addSelect('ledger.debit', 'debit')
      .addSelect('ledger.credit', 'credit')
      .addSelect('ledger.partnerId', 'partnerId')
      .addSelect('je._id', 'journalEntryId')
      .addSelect('je.entryNumber', 'entryNumber')
      .addSelect('je.entryDate', 'entryDate')
      .addSelect('je.description', 'description')
      .addSelect('je.referenceType', 'referenceType')
      .addSelect('je.referenceId', 'referenceId')
      .where('ledger.accountCode IN (:...codes)', { codes: taxAccounts })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
        startDate: start.toDate(),
        endDate: end.toDate(),
      })
      .orderBy('je.entryDate', 'ASC')
      .addOrderBy('je.entryNumber', 'ASC')
      .getRawMany();

    const inputVat = results.filter(r => ['133', '1331'].includes(r.code))
      .reduce((sum, row) => sum.plus(new Decimal(row.debit || 0).minus(row.credit || 0)), new Decimal(0));
    const outputVat = results.find(r => r.code === '3331');
    const outputVatAmount = new Decimal(outputVat?.credit || 0).minus(outputVat?.debit || 0);
    const netVatPayable = outputVatAmount.minus(inputVat);
    const exportRevenueVnd = results
      .filter(r => ['511', '3387'].includes(r.code))
      .reduce((sum, row) => sum.plus(new Decimal(row.credit || 0).minus(row.debit || 0)), new Decimal(0));
    const refundableVat = Decimal.max(inputVat.minus(outputVatAmount), 0);
    const documentTrace = await this.buildTaxDocumentTrace(start, end);
    const reconciliation = this.buildTaxReconciliation({
      documentTrace,
      journalLines,
      refundableVat,
    });
    const taxPeriod = await this.accountingPeriodRepository
      .createQueryBuilder('period')
      .where('period.startDate <= :endDate', { endDate: end.format('YYYY-MM-DD') })
      .andWhere('period.endDate >= :startDate', { startDate: start.format('YYYY-MM-DD') })
      .orderBy('period.startDate', 'DESC')
      .getOne();
    const warnings = [
      ...(!taxPeriod ? ['No accounting period is configured for this tax report range.'] : []),
      ...(exportRevenueVnd.greaterThan(0) && reconciliation.customsDeclarationCount === 0
        ? ['Export revenue exists but no customs declaration was traced for this tax period.']
        : []),
      ...(exportRevenueVnd.greaterThan(0) && reconciliation.certificateOfOriginCount === 0
        ? ['Export revenue exists but no C/O document was traced for this tax period.']
        : []),
      ...(refundableVat.greaterThan(0) && !reconciliation.refundableVatCoveredByDossier
        ? ['Refundable VAT exists but no submitted/approved/paid VAT refund dossier overlaps this period.']
        : []),
      ...journalLines
        .filter(line => ['133', '1331', '3331'].includes(String(line.accountCode)) && !line.referenceId)
        .map(line => `VAT line ${line.entryNumber || line.journalEntryId} is missing referenceId.`),
    ];
    const accountBreakdown = results.map(r => ({
      code: r.code,
      name: this.getAccountName(r.code),
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
      net: ['3331', '511', '3387'].includes(String(r.code))
        ? new Decimal(r.credit || 0).minus(r.debit || 0).toNumber()
        : new Decimal(r.debit || 0).minus(r.credit || 0).toNumber(),
    }));
    const summary = {
      inputVat: inputVat.toNumber(),
      outputVat: outputVatAmount.toNumber(),
      netVatPayable: netVatPayable.toNumber(),
      refundableVat: refundableVat.toNumber(),
      exportRevenueVnd: exportRevenueVnd.toNumber(),
      taxableRevenueVnd: outputVatAmount.greaterThan(0) ? outputVatAmount.dividedBy(0.1).toDecimalPlaces(2).toNumber() : 0,
    };
    const reportHash = this.hashPayload({
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      summary,
      accountBreakdown,
      journalLineIds: journalLines.map(line => line._id),
      documentTrace,
      reconciliation,
      warnings,
    });

    return {
      ...summary,
      generatedAt: new Date().toISOString(),
      reportHash,
      period: {
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        accountingPeriodId: taxPeriod?._id || null,
        accountingPeriodStatus: taxPeriod?.status || null,
      },
      summary,
      accountBreakdown,
      details: accountBreakdown,
      documentTrace,
      reconciliation,
      journalLines: journalLines.map(line => ({
        _id: line._id,
        journalEntryId: line.journalEntryId,
        entryNumber: line.entryNumber,
        entryDate: line.entryDate,
        description: line.description,
        referenceType: line.referenceType,
        referenceId: line.referenceId,
        accountCode: line.accountCode,
        accountName: this.getAccountName(String(line.accountCode)),
        partnerId: line.partnerId || null,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
      })),
      warnings,
    };
  }

  /**
   * Xử lý chênh lệch tỷ giá (Mục 10 PRD)
   * Realized Gain/Loss khi thu/thanh toán ngoại tệ
   */
  async exportTaxReportCsv(query?: { startDate?: string; endDate?: string }) {
    const report = await this.getVatReport(query);
    const rows: unknown[][] = [
      ['section', 'field_1', 'field_2', 'field_3', 'field_4', 'field_5', 'field_6'],
      ['period', report.period.startDate, report.period.endDate, report.period.accountingPeriodId, report.period.accountingPeriodStatus],
      ['summary', 'inputVat', report.summary.inputVat],
      ['summary', 'outputVat', report.summary.outputVat],
      ['summary', 'netVatPayable', report.summary.netVatPayable],
      ['summary', 'refundableVat', report.summary.refundableVat],
      ['summary', 'exportRevenueVnd', report.summary.exportRevenueVnd],
      ['hash', 'reportHash', report.reportHash],
    ];

    for (const warning of report.warnings) {
      rows.push(['warning', warning]);
    }

    rows.push(['journal_lines', 'entryNumber', 'entryDate', 'accountCode', 'debit', 'credit', 'reference']);
    for (const line of report.journalLines) {
      rows.push([
        'journal_line',
        line.entryNumber,
        line.entryDate,
        line.accountCode,
        line.debit,
        line.credit,
        `${line.referenceType || ''}:${line.referenceId || ''}`,
      ]);
    }

    rows.push(['customs_declarations', 'documentNumber', 'shipmentNumber', 'contractNumber', 'traceDate', 'status']);
    for (const document of report.documentTrace.customsDeclarations) {
      rows.push([
        'customs_declaration',
        document.documentNumber,
        document.shipmentNumber,
        document.contractNumber,
        document.traceDate,
        document.checklistStatus,
      ]);
    }

    rows.push(['certificates_of_origin', 'documentNumber', 'shipmentNumber', 'contractNumber', 'traceDate', 'status']);
    for (const document of report.documentTrace.certificatesOfOrigin) {
      rows.push([
        'certificate_of_origin',
        document.documentNumber,
        document.shipmentNumber,
        document.contractNumber,
        document.traceDate,
        document.checklistStatus,
      ]);
    }

    rows.push(['vat_refund_dossiers', 'dossierNumber', 'status', 'refundAmount', 'periodStart', 'periodEnd', 'taxReportHash']);
    for (const dossier of report.documentTrace.vatRefundDossiers) {
      rows.push([
        'vat_refund_dossier',
        dossier.dossierNumber,
        dossier.status,
        dossier.refundAmount,
        dossier.periodStart,
        dossier.periodEnd,
        dossier.taxReportHash,
      ]);
    }

    rows.push(['reconciliation', 'customsDeclarationCount', report.reconciliation.customsDeclarationCount]);
    rows.push(['reconciliation', 'certificateOfOriginCount', report.reconciliation.certificateOfOriginCount]);
    rows.push(['reconciliation', 'vatRefundDossierCount', report.reconciliation.vatRefundDossierCount]);
    rows.push(['reconciliation', 'untracedVatJournalLineCount', report.reconciliation.untracedVatJournalLineCount]);

    const csv = rows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\r\n');

    return Buffer.from(`\uFEFF${csv}`, 'utf8');
  }

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

  private async buildClosingItems(startDate: Date, endDate: Date, manager: EntityManager) {
    const rows = await manager
      .getRepository(LedgerEntry)
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('je.entryDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('(ledger.accountCode LIKE :revenuePrefix OR ledger.accountCode LIKE :expensePrefix)', {
        revenuePrefix: '5%',
        expensePrefix: '6%',
      })
      .groupBy('ledger.accountCode')
      .getRawMany();

    const items: JournalItemInput[] = [];
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const row of rows) {
      const code = String(row.code);
      const debit = new Decimal(row.debit || 0);
      const credit = new Decimal(row.credit || 0);

      if (code.startsWith('5')) {
        const balance = credit.minus(debit);
        if (balance.greaterThan(0)) {
          items.push({ accountCode: code, debit: balance.toNumber(), credit: 0 });
          totalDebit = totalDebit.plus(balance);
        } else if (balance.lessThan(0)) {
          items.push({ accountCode: code, debit: 0, credit: balance.abs().toNumber() });
          totalCredit = totalCredit.plus(balance.abs());
        }
      } else if (code.startsWith('6')) {
        const balance = debit.minus(credit);
        if (balance.greaterThan(0)) {
          items.push({ accountCode: code, debit: 0, credit: balance.toNumber() });
          totalCredit = totalCredit.plus(balance);
        } else if (balance.lessThan(0)) {
          items.push({ accountCode: code, debit: balance.abs().toNumber(), credit: 0 });
          totalDebit = totalDebit.plus(balance.abs());
        }
      }
    }

    const difference = totalDebit.minus(totalCredit);
    if (difference.greaterThan(0)) {
      items.push({ accountCode: '421', debit: 0, credit: difference.toNumber() });
    } else if (difference.lessThan(0)) {
      items.push({ accountCode: '421', debit: difference.abs().toNumber(), credit: 0 });
    }

    return items;
  }

  async findPeriods(query: any = {}) {
    const { current = 1, pageSize = 20, status } = query;
    const where: any = {};
    if (status) where.status = status;

    const [results, total] = await this.accountingPeriodRepository.findAndCount({
      where,
      order: { startDate: 'DESC' },
      take: Number(pageSize),
      skip: (Number(current) - 1) * Number(pageSize),
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / Number(pageSize)),
        total,
      },
    };
  }

  async openPeriod(data: { startDate: string; endDate: string }, user?: AuthenticatedUser) {
    const start = dayjs(data?.startDate).startOf('day');
    const end = dayjs(data?.endDate).endOf('day');

    if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
      throw new BadRequestException('startDate/endDate khong hop le');
    }

    const overlappingPeriod = await this.accountingPeriodRepository
      .createQueryBuilder('period')
      .where('period.startDate <= :endDate', { endDate: end.format('YYYY-MM-DD') })
      .andWhere('period.endDate >= :startDate', { startDate: start.format('YYYY-MM-DD') })
      .getOne();

    if (overlappingPeriod) {
      throw new BadRequestException('Ky ke toan bi trung/chong len ky da ton tai');
    }

    const period = this.accountingPeriodRepository.create({
      startDate: start.toDate(),
      endDate: end.toDate(),
      status: AccountingPeriodStatus.OPEN,
      reopenCount: 0,
      periodHash: this.hashPayload({
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        status: AccountingPeriodStatus.OPEN,
      }),
    });
    const saved = await this.accountingPeriodRepository.save(period);
    await this.appendAccountingAuditEvent({
      eventType: 'PERIOD_OPENED',
      entityType: 'accounting_periods',
      entityId: saved._id,
      username: this.getUsername(user),
      payload: {
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        periodHash: saved.periodHash,
      },
    });

    return saved;
  }

  async getPeriodClosePolicy(recordId: string) {
    const period = await this.accountingPeriodRepository.findOne({ where: { _id: recordId } });
    if (!period) throw new BadRequestException('Accounting period not found');

    const closingItems = await this.buildClosingItems(
      dayjs(period.startDate).startOf('day').toDate(),
      dayjs(period.endDate).endOf('day').toDate(),
      this.dataSource.manager,
    );
    const taxReport = await this.getVatReport({
      startDate: dayjs(period.startDate).startOf('day').toISOString(),
      endDate: dayjs(period.endDate).endOf('day').toISOString(),
    });

    return this.accountingClosePolicyService.buildClosePolicy(
      period,
      taxReport,
      closingItems,
    );
  }

  async findTaxReportRuns(query: {
    current?: number | string;
    pageSize?: number | string;
    accountingPeriod_id?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    return this.accountingClosePolicyService.findTaxReportRuns(query);
  }

  async findClosePackets(query: {
    current?: number | string;
    pageSize?: number | string;
    period_id?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    return this.accountingClosePolicyService.findClosePackets(query);
  }

  async findPeriodClosePackets(recordId: string, query: {
    current?: number | string;
    pageSize?: number | string;
  } = {}) {
    return this.accountingClosePolicyService.findPeriodClosePackets(recordId, query);
  }

  async closePeriod(query: { startDate?: string | Date; endDate?: string | Date; reason?: string }, user?: AuthenticatedUser) {
    const start = query?.startDate ? dayjs(query.startDate).startOf('day') : null;
    const end = query?.endDate ? dayjs(query.endDate).endOf('day') : null;

    if (!start?.isValid() || !end?.isValid() || start.isAfter(end)) {
      throw new BadRequestException('startDate/endDate khong hop le');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const username = this.getUsername(user);
      const periodRepository = queryRunner.manager.getRepository(AccountingPeriod);
      const period = await this.findExactPeriod(start, end, queryRunner.manager);
      if (!period) throw new BadRequestException('Open the accounting period before closing it.');
      if (period.status !== AccountingPeriodStatus.OPEN) {
        throw new BadRequestException(`Only OPEN periods can be closed. Current status: ${period.status}`);
      }
      await this.assertNoPreviousOpenPeriods(period, queryRunner.manager);

      const items = await this.buildClosingItems(start.toDate(), end.toDate(), queryRunner.manager);
      const taxReport = await this.getVatReport({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const closePolicy = await this.accountingClosePolicyService.buildClosePolicy(
        period,
        taxReport,
        items,
        queryRunner.manager,
      );
      if (!closePolicy.canClose) {
        const failedLabels = closePolicy.checklist
          .filter((item) => item.status === 'FAILED')
          .map((item) => item.label)
          .join(', ');
        throw new BadRequestException(`Accounting close policy failed: ${failedLabels}`);
      }

      const taxReportRun = await this.accountingClosePolicyService.createTaxReportRun(
        period,
        taxReport,
        username,
        queryRunner.manager,
      );
      await this.appendAccountingAuditEvent({
        eventType: 'TAX_REPORT_RUN_FROZEN',
        entityType: 'tax_report_runs',
        entityId: taxReportRun._id,
        referenceType: 'accounting_periods',
        referenceId: period._id,
        username,
        payload: {
          runNumber: taxReportRun.runNumber,
          reportHash: taxReportRun.reportHash,
          runHash: taxReportRun.runHash,
          warningCount: taxReportRun.warnings.length,
        },
      }, queryRunner.manager);

      let closingEntry: JournalEntry | null = null;
      if (items.length >= 2) {
        closingEntry = await this.createJournalEntry({
          description: `Ket chuyen cuoi ky ${start.format('YYYY-MM-DD')} - ${end.format('YYYY-MM-DD')}`,
          referenceType: 'ACCOUNTING_PERIOD_CLOSE',
          referenceId: period._id,
          entryDate: end.toDate(),
          createdByUsername: username,
          items,
        }, queryRunner.manager);
      }

      period.status = AccountingPeriodStatus.CLOSED;
      period.closedByUsername = username;
      period.closedAt = new Date();
      period.closeReason = query.reason?.trim() || null;
      period.closingJournalEntryId = closingEntry?._id || null;
      period.periodHash = this.buildPeriodHash(period, {
        closedByUsername: username,
        closingJournalEntryId: period.closingJournalEntryId,
        closePolicyHash: closePolicy.policyHash,
        taxReportRun_id: taxReportRun._id,
        taxReportHash: taxReportRun.reportHash,
      });
      const savedPeriod = await periodRepository.save(period);

      await this.appendAccountingAuditEvent({
        eventType: 'PERIOD_CLOSED',
        entityType: 'accounting_periods',
        entityId: savedPeriod._id,
        referenceType: closingEntry ? 'journal_entries' : null,
        referenceId: closingEntry?._id || null,
        username,
        payload: {
          startDate: start.format('YYYY-MM-DD'),
          endDate: end.format('YYYY-MM-DD'),
          closingJournalEntryId: closingEntry?._id || null,
          taxReportRun_id: taxReportRun._id,
          closePolicyHash: closePolicy.policyHash,
          periodHash: savedPeriod.periodHash,
          reason: period.closeReason,
        },
      }, queryRunner.manager);

      const closePacket = await this.accountingClosePolicyService.createClosePacket(
        savedPeriod,
        taxReportRun,
        closingEntry,
        closePolicy,
        username,
        queryRunner.manager,
      );
      await this.appendAccountingAuditEvent({
        eventType: 'PERIOD_CLOSE_PACKET_CREATED',
        entityType: 'accounting_period_close_packets',
        entityId: closePacket._id,
        referenceType: 'accounting_periods',
        referenceId: savedPeriod._id,
        username,
        payload: {
          packetNumber: closePacket.packetNumber,
          packetHash: closePacket.packetHash,
          taxReportRun_id: taxReportRun._id,
          closingJournalEntry_id: closingEntry?._id || null,
          warningCount: closePacket.warningCount,
          failedCheckCount: closePacket.failedCheckCount,
        },
      }, queryRunner.manager);

      await queryRunner.commitTransaction();
      return { period: savedPeriod, closingEntry, closePolicy, taxReportRun, closePacket };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async closePeriodById(recordId: string, data: { note?: string } = {}, user?: AuthenticatedUser) {
    const period = await this.accountingPeriodRepository.findOne({ where: { _id: recordId } });
    if (!period) throw new BadRequestException('Accounting period not found');
    if (period.status !== AccountingPeriodStatus.OPEN) throw new BadRequestException('Only OPEN periods can be closed');

    return this.closePeriod({
      startDate: period.startDate,
      endDate: period.endDate,
      reason: data.note,
    }, user);
  }

  async reopenPeriod(recordId: string, data: { reason: string }, user?: AuthenticatedUser) {
    const reason = data?.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Can co ly do mo lai ky ke toan toi thieu 10 ky tu');
    }

    return this.dataSource.transaction(async (manager) => {
      const periodRepository = manager.getRepository(AccountingPeriod);
      const period = await periodRepository.findOne({ where: { _id: recordId } });
      if (!period) throw new BadRequestException('Accounting period not found');
      if (period.status === AccountingPeriodStatus.LOCKED) throw new BadRequestException('Ky da lock vinh vien, khong duoc mo lai');
      if (period.status !== AccountingPeriodStatus.CLOSED) throw new BadRequestException('Chi ky da dong moi can mo lai');
      if (Number(period.reopenCount || 0) >= 3) throw new BadRequestException('Ky ke toan da vuot qua so lan mo lai toi da');
      if (period.reopenApprovalWorkflowRequest_id) {
        throw new BadRequestException('Ky ke toan da co yeu cau mo lai dang cho duyet');
      }
      await this.assertNoLaterClosedOrLockedPeriods(period, manager);

      const closePacket = await this.accountingClosePolicyService.findLatestClosePacket(recordId);
      if (!closePacket) {
        throw new BadRequestException('Can co close packet bat bien truoc khi gui yeu cau mo lai ky');
      }
      const auditVerification = await this.verifyAuditChain();
      if (!auditVerification.valid) {
        throw new BadRequestException('Accounting audit hash chain khong hop le; khong duoc mo lai ky');
      }

      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.ACCOUNTING_PERIOD_REOPEN,
        0,
        'VND',
      );
      if (!matchingRule) {
        throw new BadRequestException('Chua cau hinh approval matrix cho mo lai ky ke toan');
      }

      const periodNumber = `PERIOD-${dayjs(period.startDate).format('YYYYMMDD')}-${dayjs(period.endDate).format('YYYYMMDD')}`;
      const approvalRequest = await this.approvalMatrixService.createRequestInTransaction(
        manager,
        {
          ruleId: matchingRule._id,
          documentType: ApprovalDocumentType.ACCOUNTING_PERIOD_REOPEN,
          documentId: period._id,
          documentNumber: periodNumber,
          title: `Reopen accounting period ${periodNumber}`,
          currency: 'VND',
          amount: 0,
          amountVnd: 0,
          metadata: {
            source: 'accounting.period_reopen',
            period_id: period._id,
            startDate: this.toDateOnly(period.startDate),
            endDate: this.toDateOnly(period.endDate),
            reason,
            closePacket_id: closePacket._id,
            closePacketHash: closePacket.packetHash,
          },
        },
        user,
      );

      period.reopenApprovalWorkflowRequest_id = approvalRequest?._id || null;
      period.periodHash = this.buildPeriodHash(period, {
        reopenRequest_id: period.reopenApprovalWorkflowRequest_id,
        reopenReason: reason,
      });
      const savedPeriod = await periodRepository.save(period);

      await this.appendAccountingAuditEvent({
        eventType: 'PERIOD_REOPEN_REQUESTED',
        entityType: 'accounting_periods',
        entityId: savedPeriod._id,
        referenceType: 'approval_workflow_requests',
        referenceId: approvalRequest?._id || null,
        username: this.getUsername(user),
        payload: {
          reason,
          closePacket_id: closePacket._id,
          closePacketHash: closePacket.packetHash,
          periodHash: savedPeriod.periodHash,
        },
      }, manager);

      return { period: savedPeriod, approvalRequest };
    });
  }

  async completePeriodReopenWorkflowApproval(
    recordId: string,
    approvalWorkflowRequest_id: string,
    actorUsername: string,
    reason?: string | null,
  ) {
    const approvedReason = reason?.trim() || 'Approved accounting period reopen';

    return this.dataSource.transaction(async (manager) => {
      const periodRepository = manager.getRepository(AccountingPeriod);
      const period = await periodRepository.findOne({ where: { _id: recordId } });
      if (!period) throw new BadRequestException('Accounting period not found');
      if (period.reopenApprovalWorkflowRequest_id && period.reopenApprovalWorkflowRequest_id !== approvalWorkflowRequest_id) {
        throw new BadRequestException('Approval request does not match accounting period reopen request');
      }
      if (period.status === AccountingPeriodStatus.LOCKED) throw new BadRequestException('Ky da lock vinh vien, khong duoc mo lai');
      if (period.status !== AccountingPeriodStatus.CLOSED) throw new BadRequestException('Chi ky da dong moi can mo lai');
      if (Number(period.reopenCount || 0) >= 3) throw new BadRequestException('Ky ke toan da vuot qua so lan mo lai toi da');
      await this.assertNoLaterClosedOrLockedPeriods(period, manager);

      period.status = AccountingPeriodStatus.OPEN;
      period.reopenCount = Number(period.reopenCount || 0) + 1;
      period.reopenedByUsername = actorUsername;
      period.reopenedAt = new Date();
      period.reopenReason = approvedReason;
      period.periodHash = this.buildPeriodHash(period, { reopenReason: approvedReason, reopenStage: 'OPEN_FOR_REVERSAL' });
      await periodRepository.save(period);

      let reversalEntry: JournalEntry | null = null;
      if (period.closingJournalEntryId) {
        const closingEntry = await manager.getRepository(JournalEntry).findOne({
          where: { _id: period.closingJournalEntryId },
          relations: ['items'],
        });

        if (closingEntry?.items?.length) {
          reversalEntry = await this.createJournalEntry({
            description: `Dao but toan ket chuyen ky ${dayjs(period.startDate).format('YYYY-MM-DD')} - ${dayjs(period.endDate).format('YYYY-MM-DD')}`,
            entryDate: dayjs(period.endDate).toDate(),
            referenceType: 'ACCOUNTING_PERIOD_REOPEN',
            referenceId: recordId,
            createdByUsername: actorUsername,
            items: closingEntry.items.map((item) => ({
              accountCode: item.accountCode,
              debit: Number(item.credit || 0),
              credit: Number(item.debit || 0),
              partnerId: item.partnerId,
            })),
          }, manager);
        }
      }

      period.closingJournalEntryId = null;
      period.closedAt = null;
      period.closedByUsername = null;
      period.closeReason = null;
      period.reopenApprovalWorkflowRequest_id = null;
      period.periodHash = this.buildPeriodHash(period, {
        reopenReason: approvedReason,
        approvalWorkflowRequest_id,
      });
      const savedPeriod = await periodRepository.save(period);

      await this.appendAccountingAuditEvent({
        eventType: 'PERIOD_REOPENED',
        entityType: 'accounting_periods',
        entityId: savedPeriod._id,
        referenceType: reversalEntry ? 'journal_entries' : 'approval_workflow_requests',
        referenceId: reversalEntry?._id || approvalWorkflowRequest_id,
        username: actorUsername,
        payload: {
          reason: approvedReason,
          approvalWorkflowRequest_id,
          reopenCount: savedPeriod.reopenCount,
          reversalJournalEntryId: reversalEntry?._id || null,
          periodHash: savedPeriod.periodHash,
        },
      }, manager);

      return { period: savedPeriod, reversalEntry };
    });
  }

  async rejectPeriodReopenWorkflow(
    recordId: string,
    approvalWorkflowRequest_id: string,
    actorUsername: string,
    reason?: string | null,
  ) {
    const period = await this.accountingPeriodRepository.findOne({ where: { _id: recordId } });
    if (!period) throw new BadRequestException('Accounting period not found');
    if (period.reopenApprovalWorkflowRequest_id === approvalWorkflowRequest_id) {
      period.reopenApprovalWorkflowRequest_id = null;
      period.periodHash = this.buildPeriodHash(period, {
        rejectedReopenRequest_id: approvalWorkflowRequest_id,
        rejectionReason: reason || null,
      });
      await this.accountingPeriodRepository.save(period);
    }

    await this.appendAccountingAuditEvent({
      eventType: 'PERIOD_REOPEN_REJECTED',
      entityType: 'accounting_periods',
      entityId: period._id,
      referenceType: 'approval_workflow_requests',
      referenceId: approvalWorkflowRequest_id,
      username: actorUsername,
      payload: {
        reason: reason || null,
        periodHash: period.periodHash,
      },
    });

    return period;
  }

  async lockPeriod(recordId: string, data: { reason: string }, user?: AuthenticatedUser) {
    const reason = data?.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Can co ly do lock ky ke toan toi thieu 10 ky tu');
    }

    return this.dataSource.transaction(async (manager) => {
      const periodRepository = manager.getRepository(AccountingPeriod);
      const period = await periodRepository.findOne({ where: { _id: recordId } });
      if (!period) throw new BadRequestException('Accounting period not found');
      if (period.status !== AccountingPeriodStatus.CLOSED) {
        throw new BadRequestException('Only CLOSED periods can be locked permanently.');
      }
      if (period.lockApprovalWorkflowRequest_id) {
        throw new BadRequestException('Ky ke toan da co yeu cau lock dang cho duyet');
      }

      const closePacket = await this.accountingClosePolicyService.findLatestClosePacket(recordId);
      if (!closePacket) {
        throw new BadRequestException('A frozen close packet is required before permanently locking an accounting period.');
      }
      const auditVerification = await this.verifyAuditChain();
      if (!auditVerification.valid) {
        throw new BadRequestException('Accounting audit hash chain must be valid before locking the period.');
      }

      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.ACCOUNTING_PERIOD_LOCK,
        0,
        'VND',
      );
      if (!matchingRule) {
        throw new BadRequestException('Chua cau hinh approval matrix cho lock ky ke toan');
      }

      const periodNumber = `PERIOD-${dayjs(period.startDate).format('YYYYMMDD')}-${dayjs(period.endDate).format('YYYYMMDD')}`;
      const approvalRequest = await this.approvalMatrixService.createRequestInTransaction(
        manager,
        {
          ruleId: matchingRule._id,
          documentType: ApprovalDocumentType.ACCOUNTING_PERIOD_LOCK,
          documentId: period._id,
          documentNumber: periodNumber,
          title: `Lock accounting period ${periodNumber}`,
          currency: 'VND',
          amount: 0,
          amountVnd: 0,
          metadata: {
            source: 'accounting.period_lock',
            period_id: period._id,
            startDate: this.toDateOnly(period.startDate),
            endDate: this.toDateOnly(period.endDate),
            reason,
            closePacket_id: closePacket._id,
            closePacketHash: closePacket.packetHash,
          },
        },
        user,
      );

      period.lockApprovalWorkflowRequest_id = approvalRequest?._id || null;
      period.periodHash = this.buildPeriodHash(period, {
        lockRequest_id: period.lockApprovalWorkflowRequest_id,
        lockReason: reason,
        closePacketHash: closePacket.packetHash,
      });
      const saved = await periodRepository.save(period);

      await this.appendAccountingAuditEvent({
        eventType: 'PERIOD_LOCK_REQUESTED',
        entityType: 'accounting_periods',
        entityId: saved._id,
        referenceType: 'approval_workflow_requests',
        referenceId: approvalRequest?._id || null,
        username: this.getUsername(user),
        payload: {
          reason,
          closePacket_id: closePacket._id,
          closePacketHash: closePacket.packetHash,
          periodHash: saved.periodHash,
        },
      }, manager);

      return { period: saved, approvalRequest };
    });
  }

  async completePeriodLockWorkflowApproval(
    recordId: string,
    approvalWorkflowRequest_id: string,
    actorUsername: string,
    reason?: string | null,
  ) {
    const approvedReason = reason?.trim() || 'Approved permanent accounting period lock';

    const period = await this.accountingPeriodRepository.findOne({ where: { _id: recordId } });
    if (!period) throw new BadRequestException('Accounting period not found');
    if (period.lockApprovalWorkflowRequest_id && period.lockApprovalWorkflowRequest_id !== approvalWorkflowRequest_id) {
      throw new BadRequestException('Approval request does not match accounting period lock request');
    }
    if (period.status !== AccountingPeriodStatus.CLOSED) {
      throw new BadRequestException('Only CLOSED periods can be locked permanently.');
    }

    const closePacket = await this.accountingClosePolicyService.findLatestClosePacket(recordId);
    if (!closePacket) {
      throw new BadRequestException('A frozen close packet is required before permanently locking an accounting period.');
    }
    const auditVerification = await this.verifyAuditChain();
    if (!auditVerification.valid) {
      throw new BadRequestException('Accounting audit hash chain must be valid before locking the period.');
    }

    period.status = AccountingPeriodStatus.LOCKED;
    period.lockedByUsername = actorUsername;
    period.lockedAt = new Date();
    period.lockReason = approvedReason;
    period.lockApprovalWorkflowRequest_id = null;
    period.periodHash = this.buildPeriodHash(period, {
      lockReason: approvedReason,
      approvalWorkflowRequest_id,
      closePacket_id: closePacket._id,
      closePacketHash: closePacket.packetHash,
    });
    const saved = await this.accountingPeriodRepository.save(period);

    await this.appendAccountingAuditEvent({
      eventType: 'PERIOD_LOCKED',
      entityType: 'accounting_periods',
      entityId: saved._id,
      referenceType: 'approval_workflow_requests',
      referenceId: approvalWorkflowRequest_id,
      username: actorUsername,
      payload: {
        reason: approvedReason,
        approvalWorkflowRequest_id,
        closePacket_id: closePacket._id,
        closePacketHash: closePacket.packetHash,
        periodHash: saved.periodHash,
      },
    });

    return saved;
  }

  async rejectPeriodLockWorkflow(
    recordId: string,
    approvalWorkflowRequest_id: string,
    actorUsername: string,
    reason?: string | null,
  ) {
    const period = await this.accountingPeriodRepository.findOne({ where: { _id: recordId } });
    if (!period) throw new BadRequestException('Accounting period not found');
    if (period.lockApprovalWorkflowRequest_id === approvalWorkflowRequest_id) {
      period.lockApprovalWorkflowRequest_id = null;
      period.periodHash = this.buildPeriodHash(period, {
        rejectedLockRequest_id: approvalWorkflowRequest_id,
        rejectionReason: reason || null,
      });
      await this.accountingPeriodRepository.save(period);
    }

    await this.appendAccountingAuditEvent({
      eventType: 'PERIOD_LOCK_REJECTED',
      entityType: 'accounting_periods',
      entityId: period._id,
      referenceType: 'approval_workflow_requests',
      referenceId: approvalWorkflowRequest_id,
      username: actorUsername,
      payload: {
        reason: reason || null,
        periodHash: period.periodHash,
      },
    });

    return period;
  }

  async findFxRevaluations(query: any = {}) {
    const { current = 1, pageSize = 20, periodId, currency, status } = query;
    const where: any = {};
    if (periodId) where.periodId = periodId;
    if (currency) where.currency = String(currency).toUpperCase();
    if (status) where.status = status;

    const [results, total] = await this.fxRevaluationRepository.findAndCount({
      where,
      order: { revaluationDate: 'DESC', createdAt: 'DESC' },
      take: Number(pageSize),
      skip: (Number(current) - 1) * Number(pageSize),
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / Number(pageSize)),
        total,
      },
    };
  }

  async runUnrealizedFxRevaluation(dto: RunFxRevaluationDto, user?: any) {
    const currency = (dto.currency || 'USD').toUpperCase();
    const closingRate = new Decimal(dto.closingRate || 0);
    const revaluationDate = dayjs(dto.revaluationDate).endOf('day');

    if (!revaluationDate.isValid()) throw new BadRequestException('Ngay danh gia lai khong hop le');
    if (closingRate.lessThanOrEqualTo(0)) throw new BadRequestException('Ty gia cuoi ky phai lon hon 0');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fxRepository = queryRunner.manager.getRepository(FxRevaluation);
      const runNumber = this.createDocumentNumber('FXR', revaluationDate.toDate());
      const sourceType = dto.sourceType || FxRevaluationSourceType.AR;
      const records: FxRevaluation[] = [];
      let journalEntry: JournalEntry | null = null;

      if (sourceType === FxRevaluationSourceType.AR) {
        const receivables = await queryRunner.manager.getRepository(AccountReceivable).find({
          where: {
            currency,
            status: In([ARStatus.UNPAID, ARStatus.PARTIAL, ARStatus.OVERDUE]),
          },
        });

        for (const receivable of receivables) {
          const openForeign = new Decimal(receivable.amountForeign || 0).minus(receivable.paidAmountForeign || 0);
          if (openForeign.lessThanOrEqualTo(0)) continue;

          const bookValue = new Decimal(receivable.amountVnd || 0).minus(receivable.paidAmountVnd || 0);
          const revaluedValue = openForeign.mul(closingRate);
          const gainLoss = revaluedValue.minus(bookValue).toDecimalPlaces(2);
          if (gainLoss.equals(0)) continue;

          records.push(fxRepository.create({
            runNumber: `${runNumber}-${records.length + 1}`,
            periodId: dto.periodId || null,
            sourceType: FxRevaluationSourceType.AR,
            sourceId: receivable._id,
            partnerId: receivable.buyerId,
            currency,
            revaluationDate: revaluationDate.toDate(),
            openAmountForeign: openForeign.toNumber(),
            bookRate: Number(receivable.exchangeRate || 1),
            closingRate: closingRate.toNumber(),
            bookValueVnd: bookValue.toNumber(),
            revaluedValueVnd: revaluedValue.toDecimalPlaces(2).toNumber(),
            gainLossVnd: gainLoss.toNumber(),
            status: dto.postJournal ? FxRevaluationStatus.POSTED : FxRevaluationStatus.DRAFT,
            createdByUsername: this.getUsername(user),
            postedByUsername: dto.postJournal ? this.getUsername(user) : null,
            postedAt: dto.postJournal ? new Date() : null,
            note: dto.note || null,
          }));
        }
      }

      const savedRecords = records.length ? await fxRepository.save(records) : [];
      const netGainLoss = savedRecords.reduce((sum, item) => sum.plus(item.gainLossVnd || 0), new Decimal(0));

      if (dto.postJournal && !netGainLoss.equals(0)) {
        const absAmount = netGainLoss.abs().toNumber();
        // Unrealized FX is parked in account 413. Realized gain/loss remains handled by 515/635 in payment flows.
        const items: JournalItemInput[] = netGainLoss.greaterThan(0)
          ? [
              { accountCode: '131', debit: absAmount, credit: 0 },
              { accountCode: '413', debit: 0, credit: absAmount },
            ]
          : [
              { accountCode: '413', debit: absAmount, credit: 0 },
              { accountCode: '131', debit: 0, credit: absAmount },
            ];

        journalEntry = await this.createJournalEntry({
          description: `Danh gia lai chenhlech ty gia chua thuc hien ${currency} ngay ${revaluationDate.format('YYYY-MM-DD')}`,
          entryDate: revaluationDate.toDate(),
          referenceType: 'UNREALIZED_FX_REVALUATION',
          referenceId: runNumber,
          createdByUsername: this.getUsername(user),
          items,
        }, queryRunner.manager);

        await fxRepository.update(
          { runNumber: In(savedRecords.map((item) => item.runNumber)) },
          { journalEntryId: journalEntry._id },
        );
      }

      await this.appendAccountingAuditEvent({
        eventType: dto.postJournal ? 'FX_REVALUATION_POSTED' : 'FX_REVALUATION_DRAFTED',
        entityType: 'fx_revaluations',
        entityId: runNumber,
        referenceType: journalEntry ? 'journal_entries' : null,
        referenceId: journalEntry?._id || null,
        username: this.getUsername(user),
        payload: {
          runNumber,
          currency,
          sourceType,
          count: savedRecords.length,
          netGainLossVnd: netGainLoss.toNumber(),
          closingRate: closingRate.toNumber(),
          revaluationDate: revaluationDate.format('YYYY-MM-DD'),
        },
      }, queryRunner.manager);

      await queryRunner.commitTransaction();
      return {
        runNumber,
        currency,
        closingRate: closingRate.toNumber(),
        sourceType,
        count: savedRecords.length,
        netGainLossVnd: netGainLoss.toNumber(),
        journalEntry,
        results: savedRecords,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findVatRefundDossiers(query: any = {}) {
    const { current = 1, pageSize = 20, status } = query;
    const where: any = {};
    if (status) where.status = status;

    const [results, total] = await this.vatRefundRepository.findAndCount({
      where,
      order: { periodEnd: 'DESC', createdAt: 'DESC' },
      take: Number(pageSize),
      skip: (Number(current) - 1) * Number(pageSize),
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / Number(pageSize)),
        total,
      },
    };
  }

  async createVatRefundDossier(dto: CreateVatRefundDossierDto, user?: any) {
    const start = dayjs(dto.periodStart).startOf('day');
    const end = dayjs(dto.periodEnd).endOf('day');
    if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
      throw new BadRequestException('Ky hoan thue khong hop le');
    }

    const vatReport = await this.getVatReport({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    const inputVat = new Decimal(dto.inputVatAmount ?? vatReport.inputVat ?? 0);
    const outputVat = new Decimal(dto.outputVatAmount ?? vatReport.outputVat ?? 0);
    const defaultRefund = Decimal.max(inputVat.minus(outputVat), 0);
    const refundAmount = new Decimal(dto.refundAmount ?? defaultRefund.toNumber());

    if (refundAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('So tien hoan thue phai lon hon 0');
    }

    const dossier = this.vatRefundRepository.create({
      dossierNumber: this.createDocumentNumber('VATREF', end.toDate()),
      periodStart: start.toDate(),
      periodEnd: end.toDate(),
      exportRevenueVnd: Number(dto.exportRevenueVnd ?? vatReport.exportRevenueVnd ?? 0),
      inputVatAmount: inputVat.toNumber(),
      outputVatAmount: outputVat.toNumber(),
      refundAmount: refundAmount.toNumber(),
      taxReportHash: vatReport.reportHash || null,
      taxReportSnapshot: {
        period: vatReport.period,
        summary: vatReport.summary,
        warnings: vatReport.warnings,
        reportHash: vatReport.reportHash,
      },
      status: VatRefundStatus.DRAFT,
      createdByUsername: this.getUsername(user),
      note: dto.note || null,
    });

    const saved = await this.vatRefundRepository.save(dossier);
    await this.appendAccountingAuditEvent({
      eventType: 'VAT_REFUND_CREATED',
      entityType: 'vat_refund_dossiers',
      entityId: saved._id,
      username: this.getUsername(user),
      payload: {
        dossierNumber: saved.dossierNumber,
        refundAmount: saved.refundAmount,
        taxReportHash: saved.taxReportHash,
      },
    });

    return saved;
  }

  async submitVatRefund(recordId: string, user?: any) {
    const dossier = await this.vatRefundRepository.findOne({ where: { _id: recordId } });
    if (!dossier) throw new BadRequestException('VAT refund dossier not found');
    if (![VatRefundStatus.DRAFT, VatRefundStatus.REJECTED].includes(dossier.status)) {
      throw new BadRequestException('Chi ho so nhap/bi tu choi moi duoc nop');
    }

    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.VAT_REFUND,
      Number(dossier.refundAmount || 0),
      'VND',
    );
    if (!matchingRule) {
      throw new BadRequestException(
        'Chua co approval rule cho VAT refund; khong duoc duyet hoan thue truc tiep',
      );
    }

    const approvalRequest = await this.approvalMatrixService.createRequest(
      {
        ruleId: matchingRule._id,
        documentType: ApprovalDocumentType.VAT_REFUND,
        documentId: dossier._id,
        documentNumber: dossier.dossierNumber,
        title: `Approve VAT refund ${dossier.dossierNumber}`,
        currency: 'VND',
        amount: Number(dossier.refundAmount || 0),
        amountVnd: Number(dossier.refundAmount || 0),
        metadata: {
          source: 'accounting.vat_refunds.submit',
          periodStart: this.toDateOnly(dossier.periodStart),
          periodEnd: this.toDateOnly(dossier.periodEnd),
          taxReportHash: dossier.taxReportHash,
        },
      },
      user,
    );

    dossier.status = VatRefundStatus.SUBMITTED;
    dossier.submittedByUsername = this.getUsername(user);
    dossier.submittedAt = new Date();
    dossier.approvalWorkflowRequestId = approvalRequest?._id || null;
    dossier.rejectionReason = null;
    const saved = await this.vatRefundRepository.save(dossier);
    await this.appendAccountingAuditEvent({
      eventType: 'VAT_REFUND_SUBMITTED',
      entityType: 'vat_refund_dossiers',
      entityId: saved._id,
      username: this.getUsername(user),
      payload: {
        dossierNumber: saved.dossierNumber,
        refundAmount: saved.refundAmount,
        approvalWorkflowRequestId: saved.approvalWorkflowRequestId,
      },
    });
    return { ...saved, approvalRequest };
  }

  async approveVatRefund(recordId: string, data: { approvalNote?: string }, user?: any) {
    void recordId;
    void data;
    void user;
    throw new BadRequestException(
      'VAT refund phai duoc duyet qua approval-matrix request',
    );
  }

  private async applyVatRefundApprovalInTransaction(
    manager: EntityManager,
    dossier: VatRefundDossier,
    username: string,
    approvalNote?: string | null,
    approvalWorkflowRequestId?: string | null,
  ) {
    if (dossier.status !== VatRefundStatus.SUBMITTED) {
      throw new BadRequestException('Chi ho so da nop moi duoc duyet');
    }

    const entry = await this.createJournalEntry({
      description: `Ghi nhan khoan phai thu hoan thue GTGT ${dossier.dossierNumber}`,
      entryDate: new Date(),
      referenceType: 'VAT_REFUND_APPROVAL',
      referenceId: dossier._id,
      createdByUsername: username,
      items: [
        { accountCode: '1388', debit: Number(dossier.refundAmount || 0), credit: 0 },
        { accountCode: '1331', debit: 0, credit: Number(dossier.refundAmount || 0) },
      ],
    }, manager);

    dossier.status = VatRefundStatus.APPROVED;
    dossier.approvedByUsername = username;
    dossier.approvedAt = new Date();
    dossier.approvalWorkflowRequestId =
      approvalWorkflowRequestId || dossier.approvalWorkflowRequestId || null;
    dossier.approvalNote = approvalNote || null;
    dossier.receivableJournalEntryId = entry._id;
    const saved = await manager.save(dossier);
    await this.appendAccountingAuditEvent({
      eventType: 'VAT_REFUND_APPROVED',
      entityType: 'vat_refund_dossiers',
      entityId: saved._id,
      referenceType: 'journal_entries',
      referenceId: entry._id,
      username,
      payload: {
        dossierNumber: saved.dossierNumber,
        refundAmount: saved.refundAmount,
        approvalNote: saved.approvalNote,
        approvalWorkflowRequestId: saved.approvalWorkflowRequestId,
      },
    }, manager);

    return { dossier: saved, journalEntry: entry };
  }

  async completeVatRefundWorkflowApproval(
    recordId: string,
    requestId: string,
    username: string,
    note?: string | null,
  ) {
    const dossier = await this.vatRefundRepository.findOne({ where: { _id: recordId } });
    if (!dossier) throw new BadRequestException('VAT refund dossier not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.applyVatRefundApprovalInTransaction(
        queryRunner.manager,
        dossier,
        username,
        note,
        requestId,
      );

      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async payVatRefund(recordId: string, data: { paymentReference?: string }, user?: any) {
    const dossier = await this.vatRefundRepository.findOne({ where: { _id: recordId } });
    if (!dossier) throw new BadRequestException('VAT refund dossier not found');
    if (dossier.status !== VatRefundStatus.APPROVED) {
      throw new BadRequestException('Chi ho so da duyet moi duoc ghi nhan nhan tien');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entry = await this.createJournalEntry({
        description: `Nhan tien hoan thue GTGT ${dossier.dossierNumber}`,
        entryDate: new Date(),
        referenceType: 'VAT_REFUND_PAYMENT',
        referenceId: dossier._id,
        createdByUsername: this.getUsername(user),
        items: [
          { accountCode: '112', debit: Number(dossier.refundAmount || 0), credit: 0 },
          { accountCode: '1388', debit: 0, credit: Number(dossier.refundAmount || 0) },
        ],
      }, queryRunner.manager);

      dossier.status = VatRefundStatus.PAID;
      dossier.paidByUsername = this.getUsername(user);
      dossier.paidAt = new Date();
      dossier.paymentReference = data?.paymentReference || null;
      dossier.paymentJournalEntryId = entry._id;
      const saved = await queryRunner.manager.save(dossier);
      await this.appendAccountingAuditEvent({
        eventType: 'VAT_REFUND_PAID',
        entityType: 'vat_refund_dossiers',
        entityId: saved._id,
        referenceType: 'journal_entries',
        referenceId: entry._id,
        username: this.getUsername(user),
        payload: {
          dossierNumber: saved.dossierNumber,
          refundAmount: saved.refundAmount,
          paymentReference: saved.paymentReference,
        },
      }, queryRunner.manager);

      await queryRunner.commitTransaction();
      return { dossier: saved, journalEntry: entry };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async rejectVatRefund(recordId: string, data: { reason: string }, user?: any) {
    void recordId;
    void data;
    void user;
    throw new BadRequestException(
      'VAT refund phai duoc reject qua approval-matrix request',
    );
  }

  async rejectVatRefundWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    reason?: string | null,
  ) {
    const dossier = await this.vatRefundRepository.findOne({ where: { _id: recordId } });
    if (!dossier) throw new BadRequestException('VAT refund dossier not found');
    if (dossier.status !== VatRefundStatus.SUBMITTED) {
      throw new BadRequestException('Chi ho so da nop moi duoc tu choi');
    }
    const rejectionReason = reason?.trim() || 'Rejected by approval matrix';

    dossier.status = VatRefundStatus.REJECTED;
    dossier.rejectedByUsername = username;
    dossier.rejectedAt = new Date();
    dossier.approvalWorkflowRequestId = requestId;
    dossier.rejectionReason = rejectionReason;
    const saved = await this.vatRefundRepository.save(dossier);
    await this.appendAccountingAuditEvent({
      eventType: 'VAT_REFUND_REJECTED',
      entityType: 'vat_refund_dossiers',
      entityId: saved._id,
      username,
      payload: {
        dossierNumber: saved.dossierNumber,
        reason: saved.rejectionReason,
        approvalWorkflowRequestId: saved.approvalWorkflowRequestId,
      },
    });
    return saved;
  }

  async findAuditEvents(query: any = {}) {
    const { current = 1, pageSize = 50, entityType, entityId, eventType, referenceType, referenceId } = query;
    const where: Record<string, string> = {};
    if (entityType) where.entityType = String(entityType);
    if (entityId) where.entityId = String(entityId);
    if (eventType) where.eventType = String(eventType);
    if (referenceType) where.referenceType = String(referenceType);
    if (referenceId) where.referenceId = String(referenceId);

    const [results, total] = await this.accountingAuditRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', _id: 'DESC' },
      take: Number(pageSize),
      skip: (Number(current) - 1) * Number(pageSize),
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / Number(pageSize)),
        total,
      },
    };
  }

  async verifyAuditChain() {
    const events = await this.accountingAuditRepository.find({
      order: { createdAt: 'ASC', _id: 'ASC' },
    });
    let previousHash: string | null = null;

    for (const event of events) {
      const expectedHash = this.hashPayload({
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        referenceType: event.referenceType || null,
        referenceId: event.referenceId || null,
        username: event.username || null,
        eventAt: this.formatAuditTimestamp(new Date(event.eventAt)),
        payload: event.payload || null,
        previousHash,
      });

      if (event.previousHash !== previousHash || event.eventHash !== expectedHash) {
        return {
          valid: false,
          failedEvent_id: event._id,
          expectedPreviousHash: previousHash,
          actualPreviousHash: event.previousHash,
          expectedHash,
          actualHash: event.eventHash,
          checkedEvents: events.length,
        };
      }

      previousHash = event.eventHash;
    }

    return {
      valid: true,
      checkedEvents: events.length,
      latestHash: previousHash,
    };
  }

  private getAccountName(code: string): string {
    const map: Record<string, string> = {
      '111': 'Tiền mặt',
      '112': 'Tiền gửi ngân hàng',
      '131': 'Phải thu khách hàng (AR)',
      '133': 'Thuế GTGT được khấu trừ (Đầu vào)',
      '1331': 'Thuế GTGT được khấu trừ hàng hóa dịch vụ',
      '1388': 'Phải thu khác',
      '156': 'Hàng hóa tồn kho',
      '331': 'Phải trả người bán (AP)',
      '333': 'Thuế và các khoản phải nộp',
      '3331': 'Thuế GTGT phải nộp (Đầu ra)',
      '3387': 'Doanh thu chưa thực hiện (In-Transit)',
      '3388': 'Phải trả, phải nộp khác',
      '413': 'Chênh lệch tỷ giá hối đoái',
      '411': 'Vốn góp chủ sở hữu',
      '421': 'Lợi nhuận sau thuế chưa phân phối',
      '511': 'Doanh thu bán hàng',
      '515': 'Doanh thu hoạt động tài chính',
      '632': 'Giá vốn hàng bán',
      '635': 'Chi phí tài chính',
      '642': 'Chi phí quản lý doanh nghiệp',
    };
    return map[code] || `Tài khoản ${code}`;
  }
}
