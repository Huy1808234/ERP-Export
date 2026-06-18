import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { AccountingAuditEvent } from './entities/accounting-audit-event.entity';
import {
  AccountingPeriod,
  AccountingPeriodStatus,
} from './entities/accounting-period.entity';
import { AccountingPeriodClosePacket } from './entities/accounting-period-close-packet.entity';
import { FxRevaluation } from './entities/fx-revaluation.entity';
import { JournalEntry, JournalStatus } from './entities/journal-entry.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import {
  TaxReportRun,
  TaxReportRunStatus,
} from './entities/tax-report-run.entity';
import { VatRefundDossier } from './entities/vat-refund-dossier.entity';

export type AccountingCloseChecklistStatus = 'PASSED' | 'WARNING' | 'FAILED';

export type AccountingCloseLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  partnerId?: string;
};

export type AccountingCloseChecklistItem = {
  key: string;
  label: string;
  status: AccountingCloseChecklistStatus;
  details: string;
  evidence?: Record<string, unknown>;
};

export type AccountingTrialBalanceLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  netDebit: number;
  netCredit: number;
};

export type AccountingTrialBalanceSnapshot = {
  startDate: string;
  endDate: string;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  lines: AccountingTrialBalanceLine[];
  hash: string;
};

export type AccountingTaxReportSnapshot = {
  period?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  accountBreakdown?: Record<string, unknown>[];
  journalLines?: Record<string, unknown>[];
  warnings?: string[];
  documentTrace?: Record<string, unknown> | null;
  reconciliation?: Record<string, unknown> | null;
  reportHash?: string | null;
};

export type AccountingClosePolicyResult = {
  period_id: string;
  startDate: string;
  endDate: string;
  periodStatus: AccountingPeriodStatus;
  canClose: boolean;
  failedCheckCount: number;
  warningCount: number;
  closingItemCount: number;
  checklist: AccountingCloseChecklistItem[];
  trialBalanceSnapshot: AccountingTrialBalanceSnapshot;
  policyHash: string;
};

type AccountingPaginationQuery = {
  current?: number | string;
  pageSize?: number | string;
  period_id?: string;
  accountingPeriod_id?: string;
  startDate?: string;
  endDate?: string;
};

type LedgerAggregateRow = {
  code: string;
  debit: string | number | null;
  credit: string | number | null;
};

type JournalSummaryRow = {
  journalCount: string | number | null;
  firstEntryDate: Date | string | null;
  lastEntryDate: Date | string | null;
};

type JournalReferenceRow = {
  referenceType: string | null;
  count: string | number | null;
};

type AuditVerificationResult = {
  valid: boolean;
  checkedEvents: number;
  latestHash?: string | null;
  failedEvent_id?: string;
};

@Injectable()
export class AccountingClosePolicyService {
  constructor(private readonly dataSource: DataSource) {}

  private getManager(manager?: EntityManager) {
    return manager || this.dataSource.manager;
  }

  private hashPayload(payload: unknown) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private toDateOnly(value: Date | string) {
    return dayjs(value).format('YYYY-MM-DD');
  }

  private createDocumentNumber(prefix: string, date = new Date()) {
    const suffix = createOpaqueCode(prefix.toLowerCase())
      .split('_')
      .pop()
      ?.toUpperCase();
    return `${prefix}-${dayjs(date).format('YYYYMMDD-HHmmss')}-${suffix}`;
  }

  private getAccountName(code: string) {
    const map: Record<string, string> = {
      '111': 'Tien mat',
      '112': 'Tien gui ngan hang',
      '131': 'Phai thu khach hang (AR)',
      '133': 'Thue GTGT duoc khau tru',
      '1331': 'Thue GTGT dau vao',
      '156': 'Hang hoa ton kho',
      '331': 'Phai tra nguoi ban (AP)',
      '3331': 'Thue GTGT dau ra',
      '3387': 'Doanh thu chua thuc hien',
      '413': 'Chenh lech ty gia',
      '421': 'Loi nhuan sau thue chua phan phoi',
      '511': 'Doanh thu ban hang',
      '515': 'Doanh thu hoat dong tai chinh',
      '632': 'Gia von hang ban',
      '635': 'Chi phi tai chinh',
      '642': 'Chi phi quan ly doanh nghiep',
    };

    return map[code] || `Tai khoan ${code}`;
  }

  private normalizePagination(query: AccountingPaginationQuery = {}) {
    const current = Math.max(Number(query.current || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    return { current, pageSize };
  }

  private async verifyAuditChain(
    manager: EntityManager,
  ): Promise<AuditVerificationResult> {
    const events = await manager.getRepository(AccountingAuditEvent).find({
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
        eventAt: dayjs(event.eventAt).format('YYYY-MM-DDTHH:mm:ss.SSS'),
        payload: event.payload || null,
        previousHash,
      });

      if (
        event.previousHash !== previousHash ||
        event.eventHash !== expectedHash
      ) {
        return {
          valid: false,
          checkedEvents: events.length,
          failedEvent_id: event._id,
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

  private async buildTrialBalanceSnapshot(
    period: AccountingPeriod,
    manager: EntityManager,
  ): Promise<AccountingTrialBalanceSnapshot> {
    const rows = await manager
      .getRepository(LedgerEntry)
      .createQueryBuilder('ledger')
      .innerJoin('ledger.journalEntry', 'je')
      .select('ledger.accountCode', 'code')
      .addSelect('SUM(ledger.debit)', 'debit')
      .addSelect('SUM(ledger.credit)', 'credit')
      .where('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
        startDate: dayjs(period.startDate).startOf('day').toDate(),
        endDate: dayjs(period.endDate).endOf('day').toDate(),
      })
      .groupBy('ledger.accountCode')
      .orderBy('ledger.accountCode', 'ASC')
      .getRawMany<LedgerAggregateRow>();

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const lines = rows.map((row) => {
      const debit = new Decimal(row.debit || 0).toDecimalPlaces(2);
      const credit = new Decimal(row.credit || 0).toDecimalPlaces(2);
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      const net = debit.minus(credit);

      return {
        accountCode: String(row.code),
        accountName: this.getAccountName(String(row.code)),
        debit: debit.toNumber(),
        credit: credit.toNumber(),
        netDebit: net.greaterThan(0) ? net.toNumber() : 0,
        netCredit: net.lessThan(0) ? net.abs().toNumber() : 0,
      };
    });
    const difference = totalDebit.minus(totalCredit).toDecimalPlaces(2);
    const snapshot = {
      startDate: this.toDateOnly(period.startDate),
      endDate: this.toDateOnly(period.endDate),
      totalDebit: totalDebit.toDecimalPlaces(2).toNumber(),
      totalCredit: totalCredit.toDecimalPlaces(2).toNumber(),
      difference: difference.toNumber(),
      lines,
      hash: '',
    };

    snapshot.hash = this.hashPayload({
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
      totalDebit: snapshot.totalDebit,
      totalCredit: snapshot.totalCredit,
      difference: snapshot.difference,
      lines: snapshot.lines,
    });

    return snapshot;
  }

  private async buildJournalSummary(
    period: AccountingPeriod,
    manager: EntityManager,
  ) {
    const summary = await manager
      .getRepository(JournalEntry)
      .createQueryBuilder('je')
      .select('COUNT(je._id)', 'journalCount')
      .addSelect('MIN(je.entryDate)', 'firstEntryDate')
      .addSelect('MAX(je.entryDate)', 'lastEntryDate')
      .where('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
        startDate: dayjs(period.startDate).startOf('day').toDate(),
        endDate: dayjs(period.endDate).endOf('day').toDate(),
      })
      .getRawOne<JournalSummaryRow>();

    const references = await manager
      .getRepository(JournalEntry)
      .createQueryBuilder('je')
      .select('COALESCE(je.referenceType, :manual)', 'referenceType')
      .addSelect('COUNT(je._id)', 'count')
      .where('je.status = :status', { status: JournalStatus.POSTED })
      .andWhere('je.entryDate BETWEEN :startDate AND :endDate', {
        startDate: dayjs(period.startDate).startOf('day').toDate(),
        endDate: dayjs(period.endDate).endOf('day').toDate(),
      })
      .groupBy('COALESCE(je.referenceType, :manual)')
      .setParameter('manual', 'MANUAL')
      .getRawMany<JournalReferenceRow>();

    return {
      journalCount: Number(summary?.journalCount || 0),
      firstEntryDate: summary?.firstEntryDate || null,
      lastEntryDate: summary?.lastEntryDate || null,
      referenceTypeCounts: references.reduce<Record<string, number>>(
        (acc, row) => {
          acc[String(row.referenceType || 'MANUAL')] = Number(row.count || 0);
          return acc;
        },
        {},
      ),
    };
  }

  private async countPostedFxRevaluations(
    period: AccountingPeriod,
    manager: EntityManager,
  ) {
    return manager.getRepository(FxRevaluation).count({
      where: {
        periodId: period._id,
        status: In(['POSTED']),
      },
    });
  }

  private async findVatRefundsForPeriod(
    period: AccountingPeriod,
    manager: EntityManager,
  ) {
    return manager
      .getRepository(VatRefundDossier)
      .createQueryBuilder('vat')
      .where('vat.periodStart <= :endDate', {
        endDate: this.toDateOnly(period.endDate),
      })
      .andWhere('vat.periodEnd >= :startDate', {
        startDate: this.toDateOnly(period.startDate),
      })
      .orderBy('vat.createdAt', 'DESC')
      .getMany();
  }

  async buildClosePolicy(
    period: AccountingPeriod,
    taxReport: AccountingTaxReportSnapshot,
    closingItems: AccountingCloseLineInput[],
    manager?: EntityManager,
  ): Promise<AccountingClosePolicyResult> {
    const mgr = this.getManager(manager);
    const trialBalanceSnapshot = await this.buildTrialBalanceSnapshot(
      period,
      mgr,
    );
    const auditChain = await this.verifyAuditChain(mgr);
    const fxPostedCount = await this.countPostedFxRevaluations(period, mgr);
    const vatRefunds = await this.findVatRefundsForPeriod(period, mgr);
    const taxWarnings = Array.isArray(taxReport.warnings)
      ? taxReport.warnings
      : [];
    const refundableVat = Number(taxReport.summary?.refundableVat || 0);
    const checklist: AccountingCloseChecklistItem[] = [];

    const balanceDifference = new Decimal(
      trialBalanceSnapshot.difference || 0,
    ).abs();
    checklist.push({
      key: 'TRIAL_BALANCE_BALANCED',
      label: 'Trial balance balanced',
      status: balanceDifference.lessThanOrEqualTo(0.01) ? 'PASSED' : 'FAILED',
      details: balanceDifference.lessThanOrEqualTo(0.01)
        ? 'Total debit equals total credit for posted ledger lines.'
        : `Trial balance difference is ${balanceDifference.toFixed(2)} VND.`,
      evidence: {
        totalDebit: trialBalanceSnapshot.totalDebit,
        totalCredit: trialBalanceSnapshot.totalCredit,
        difference: trialBalanceSnapshot.difference,
      },
    });

    checklist.push({
      key: 'ACCOUNTING_PERIOD_OPEN',
      label: 'Accounting period is open',
      status:
        period.status === AccountingPeriodStatus.OPEN ? 'PASSED' : 'FAILED',
      details:
        period.status === AccountingPeriodStatus.OPEN
          ? 'Period is open and can still accept the closing journal.'
          : `Period status is ${period.status}.`,
    });

    checklist.push({
      key: 'CLOSING_JOURNAL_READY',
      label: 'Closing journal ready',
      status:
        closingItems.length === 0 || closingItems.length >= 2
          ? 'PASSED'
          : 'FAILED',
      details:
        closingItems.length === 0
          ? 'No revenue/expense balances require closing.'
          : `${closingItems.length} closing lines are ready for posting.`,
      evidence: { closingItemCount: closingItems.length },
    });

    checklist.push({
      key: 'TAX_REPORT_REVIEWED',
      label: 'VAT/tax report reviewed',
      status: taxWarnings.length ? 'WARNING' : 'PASSED',
      details: taxWarnings.length
        ? `${taxWarnings.length} VAT report warnings should be reviewed before final lock.`
        : 'No VAT report warnings detected for this period.',
      evidence: {
        reportHash: taxReport.reportHash || null,
        warningCount: taxWarnings.length,
      },
    });

    checklist.push({
      key: 'FX_REVALUATION_POSTED',
      label: 'FX revaluation posted',
      status: fxPostedCount > 0 ? 'PASSED' : 'WARNING',
      details:
        fxPostedCount > 0
          ? `${fxPostedCount} posted FX revaluation records are linked to this period.`
          : 'No posted FX revaluation is linked to this period.',
      evidence: { postedFxRevaluationCount: fxPostedCount },
    });

    checklist.push({
      key: 'VAT_REFUND_DOSSIER_READY',
      label: 'VAT refund dossier reviewed',
      status:
        refundableVat > 0 && vatRefunds.length === 0 ? 'WARNING' : 'PASSED',
      details:
        refundableVat > 0 && vatRefunds.length === 0
          ? 'Refundable VAT exists but no VAT refund dossier overlaps this period.'
          : `${vatRefunds.length} VAT refund dossier(s) overlap this period.`,
      evidence: {
        refundableVat,
        vatRefundDossierCount: vatRefunds.length,
      },
    });

    checklist.push({
      key: 'ACCOUNTING_AUDIT_CHAIN_VALID',
      label: 'Accounting audit chain valid',
      status: auditChain.valid ? 'PASSED' : 'FAILED',
      details: auditChain.valid
        ? `${auditChain.checkedEvents} audit events verified.`
        : `Audit chain failed at ${auditChain.failedEvent_id}.`,
      evidence: {
        checkedEvents: auditChain.checkedEvents,
        latestHash: auditChain.latestHash || null,
        failedEvent_id: auditChain.failedEvent_id || null,
      },
    });

    const failedCheckCount = checklist.filter(
      (item) => item.status === 'FAILED',
    ).length;
    const warningCount = checklist.filter(
      (item) => item.status === 'WARNING',
    ).length;
    const policyHash = this.hashPayload({
      period_id: period._id,
      trialBalanceHash: trialBalanceSnapshot.hash,
      checklist,
      taxReportHash: taxReport.reportHash || null,
    });

    return {
      period_id: period._id,
      startDate: this.toDateOnly(period.startDate),
      endDate: this.toDateOnly(period.endDate),
      periodStatus: period.status,
      canClose: failedCheckCount === 0,
      failedCheckCount,
      warningCount,
      closingItemCount: closingItems.length,
      checklist,
      trialBalanceSnapshot,
      policyHash,
    };
  }

  async createTaxReportRun(
    period: AccountingPeriod,
    taxReport: AccountingTaxReportSnapshot,
    username: string,
    manager?: EntityManager,
  ) {
    const mgr = this.getManager(manager);
    const summary = taxReport.summary || {};
    const accountBreakdown = Array.isArray(taxReport.accountBreakdown)
      ? taxReport.accountBreakdown
      : [];
    const journalLines = Array.isArray(taxReport.journalLines)
      ? taxReport.journalLines
      : [];
    const warnings = Array.isArray(taxReport.warnings)
      ? taxReport.warnings
      : [];
    const documentTrace = taxReport.documentTrace || null;
    const reconciliation = taxReport.reconciliation || null;
    const reportHash =
      taxReport.reportHash ||
      this.hashPayload({
        period: taxReport.period || null,
        summary,
        accountBreakdown,
        journalLineIds: journalLines.map(
          (line) => line._id || line.journalEntryId || null,
        ),
        documentTrace,
        reconciliation,
        warnings,
      });
    const runNumber = this.createDocumentNumber(
      'TAXRUN',
      dayjs(period.endDate).toDate(),
    );
    const runHash = this.hashPayload({
      runNumber,
      period_id: period._id,
      periodStart: this.toDateOnly(period.startDate),
      periodEnd: this.toDateOnly(period.endDate),
      reportHash,
      summary,
      accountBreakdown,
      journalLineIds: journalLines.map(
        (line) => line._id || line.journalEntryId || null,
      ),
      warningCount: warnings.length,
      documentTrace,
      reconciliation,
    });

    const entity = mgr.getRepository(TaxReportRun).create({
      runNumber,
      periodStart: dayjs(period.startDate).toDate(),
      periodEnd: dayjs(period.endDate).toDate(),
      accountingPeriod_id: period._id,
      status: TaxReportRunStatus.FROZEN,
      generatedByUsername: username,
      generatedAt: new Date(),
      reportHash,
      runHash,
      summary,
      accountBreakdown,
      journalLines,
      warnings,
      documentTrace,
      reconciliation,
    });

    return mgr.getRepository(TaxReportRun).save(entity);
  }

  async createClosePacket(
    period: AccountingPeriod,
    taxReportRun: TaxReportRun,
    closingEntry: JournalEntry | null,
    closePolicy: AccountingClosePolicyResult,
    username: string,
    manager?: EntityManager,
  ) {
    const mgr = this.getManager(manager);
    const finalTrialBalance = await this.buildTrialBalanceSnapshot(period, mgr);
    const journalSummary = await this.buildJournalSummary(period, mgr);
    const auditHead = await mgr.getRepository(AccountingAuditEvent).findOne({
      order: { createdAt: 'DESC', _id: 'DESC' },
    });
    const fxRecords = await mgr.getRepository(FxRevaluation).find({
      where: { periodId: period._id },
      order: { revaluationDate: 'DESC', createdAt: 'DESC' },
    });
    const vatRefunds = await this.findVatRefundsForPeriod(period, mgr);
    const fxRevaluationSnapshot = fxRecords.map((record) => ({
      _id: record._id,
      runNumber: record.runNumber,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      currency: record.currency,
      revaluationDate: this.toDateOnly(record.revaluationDate),
      gainLossVnd: record.gainLossVnd,
      status: record.status,
      journalEntryId: record.journalEntryId,
    }));
    const vatRefundSnapshot = vatRefunds.map((record) => ({
      _id: record._id,
      dossierNumber: record.dossierNumber,
      refundAmount: record.refundAmount,
      status: record.status,
      taxReportHash: record.taxReportHash,
      approvalWorkflowRequestId: record.approvalWorkflowRequestId,
    }));
    const packetNumber = this.createDocumentNumber(
      'CLOSEPKT',
      dayjs(period.endDate).toDate(),
    );
    const packetHash = this.hashPayload({
      packetNumber,
      period_id: period._id,
      periodHash: period.periodHash || null,
      taxReportRun_id: taxReportRun._id,
      taxReportRunHash: taxReportRun.runHash,
      closingJournalEntry_id: closingEntry?._id || null,
      preCloseTrialBalanceHash: closePolicy.trialBalanceSnapshot.hash,
      finalTrialBalanceHash: finalTrialBalance.hash,
      auditChainHeadHash: auditHead?.eventHash || null,
      checklist: closePolicy.checklist,
      journalSummary,
      fxRevaluationSnapshot,
      vatRefundSnapshot,
    });

    const entity = mgr.getRepository(AccountingPeriodClosePacket).create({
      packetNumber,
      period_id: period._id,
      taxReportRun_id: taxReportRun._id,
      closingJournalEntry_id: closingEntry?._id || null,
      periodStart: dayjs(period.startDate).toDate(),
      periodEnd: dayjs(period.endDate).toDate(),
      generatedByUsername: username,
      generatedAt: new Date(),
      periodHash: period.periodHash || null,
      preCloseTrialBalanceHash: closePolicy.trialBalanceSnapshot.hash,
      finalTrialBalanceHash: finalTrialBalance.hash,
      taxReportHash: taxReportRun.reportHash,
      auditChainHeadHash: auditHead?.eventHash || null,
      packetHash,
      journalCount: Number(journalSummary.journalCount || 0),
      warningCount: closePolicy.warningCount,
      failedCheckCount: closePolicy.failedCheckCount,
      closeChecklist: closePolicy.checklist,
      preCloseTrialBalanceSnapshot: closePolicy.trialBalanceSnapshot,
      finalTrialBalanceSnapshot: finalTrialBalance,
      taxReportSnapshot: {
        taxReportRun_id: taxReportRun._id,
        reportHash: taxReportRun.reportHash,
        runHash: taxReportRun.runHash,
        summary: taxReportRun.summary,
        warnings: taxReportRun.warnings,
        documentTrace: taxReportRun.documentTrace,
        reconciliation: taxReportRun.reconciliation,
      },
      fxRevaluationSnapshot,
      vatRefundSnapshot,
      journalSummary,
    });

    return mgr.getRepository(AccountingPeriodClosePacket).save(entity);
  }

  async findTaxReportRuns(query: AccountingPaginationQuery = {}) {
    const { current, pageSize } = this.normalizePagination(query);
    const qb = this.dataSource
      .getRepository(TaxReportRun)
      .createQueryBuilder('run')
      .orderBy('run.periodEnd', 'DESC')
      .addOrderBy('run.createdAt', 'DESC');

    if (query.accountingPeriod_id) {
      qb.andWhere('run.accountingPeriod_id = :accountingPeriod_id', {
        accountingPeriod_id: query.accountingPeriod_id,
      });
    }
    if (query.startDate) {
      qb.andWhere('run.periodEnd >= :startDate', {
        startDate: dayjs(query.startDate).format('YYYY-MM-DD'),
      });
    }
    if (query.endDate) {
      qb.andWhere('run.periodStart <= :endDate', {
        endDate: dayjs(query.endDate).format('YYYY-MM-DD'),
      });
    }

    const [results, total] = await qb
      .take(pageSize)
      .skip((current - 1) * pageSize)
      .getManyAndCount();
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

  async findClosePackets(query: AccountingPaginationQuery = {}) {
    const { current, pageSize } = this.normalizePagination(query);
    const qb = this.dataSource
      .getRepository(AccountingPeriodClosePacket)
      .createQueryBuilder('packet')
      .orderBy('packet.periodEnd', 'DESC')
      .addOrderBy('packet.createdAt', 'DESC');

    if (query.period_id) {
      qb.andWhere('packet.period_id = :period_id', {
        period_id: query.period_id,
      });
    }
    if (query.startDate) {
      qb.andWhere('packet.periodEnd >= :startDate', {
        startDate: dayjs(query.startDate).format('YYYY-MM-DD'),
      });
    }
    if (query.endDate) {
      qb.andWhere('packet.periodStart <= :endDate', {
        endDate: dayjs(query.endDate).format('YYYY-MM-DD'),
      });
    }

    const [results, total] = await qb
      .take(pageSize)
      .skip((current - 1) * pageSize)
      .getManyAndCount();
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

  async findPeriodClosePackets(
    period_id: string,
    query: AccountingPaginationQuery = {},
  ) {
    return this.findClosePackets({ ...query, period_id });
  }

  async findLatestClosePacket(period_id: string, manager?: EntityManager) {
    return this.getManager(manager)
      .getRepository(AccountingPeriodClosePacket)
      .findOne({
        where: { period_id },
        order: { createdAt: 'DESC', _id: 'DESC' },
      });
  }
}
