import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, In } from 'typeorm';
import { LetterOfCredit, LCStatus } from './entities/letter-of-credit.entity';
import {
  CollectionOrder,
  CollectionOrderStatus,
  CollectionOrderType,
} from './entities/collection-order.entity';
import {
  ReconciliationStatus,
  TradeFinanceTransaction,
  TradeFinanceStatus,
  TradeFinanceType,
} from './entities/trade-finance-transaction.entity';
import {
  LCDiscrepancy,
  LCDiscrepancySeverity,
  LCDiscrepancyStatus,
} from './entities/lc-discrepancy.entity';
import { CreateLCDto } from '@/modules/trade-finance/dto/create-lc.dto';
import { UpdateLCDto } from '@/modules/trade-finance/dto/update-lc.dto';
import { CreateLCDiscrepancyDto } from './dto/create-lc-discrepancy.dto';
import { ResolveLCDiscrepancyDto } from './dto/resolve-lc-discrepancy.dto';
import type { QueryParams } from '@/common/types/authenticated-user.type';
import {
  VendorInvoice,
  VendorInvoiceStatus,
} from '../vendor-invoices/entities/vendor-invoice.entity';
import { User } from '@/modules/users/entities/user.entity';
import { BaseService } from '@/common/base/base.service';
import { AccountingService } from '../accounting/accounting.service';
import { SalesContract } from '../sales-contracts/entities/sales-contract.entity';
import {
  AccountPayable,
  APStatus,
} from '../account-payables/entities/account-payable.entity';
import { AccountReceivablesService } from '../account-receivables/account-receivables.service';
import {
  AccountReceivable,
  ARStatus,
} from '../account-receivables/entities/account-receivable.entity';
import Decimal from 'decimal.js';
import { EventEmitter2 } from '@nestjs/event-emitter';

type LCDeadlineType =
  | 'EXPIRY'
  | 'LATEST_SHIPMENT'
  | 'PRESENTATION'
  | 'DISCREPANCY'
  | 'INVOICE_DUE';
type LCDeadlineSeverity =
  | 'OVERDUE'
  | 'TODAY'
  | 'CRITICAL'
  | 'WARNING'
  | 'UPCOMING';
type PaymentStage = 'ADVANCE' | 'BALANCE' | 'COLLECTION' | 'MANUAL';
type CreateCollectionInput = Partial<CollectionOrder>;
type CreateTradeFinanceTransactionInput = Partial<TradeFinanceTransaction> & {
  vendorInvoiceIds?: string[];
};

interface LCDeadlineItem {
  _id: string;
  lcId: string;
  lcNumber: string;
  salesContractId: string;
  contractNumber: string | null;
  buyerName: string | null;
  type: LCDeadlineType;
  label: string;
  dueDate: string | null;
  daysRemaining: number | null;
  severity: LCDeadlineSeverity;
  status: LCStatus | LCDiscrepancyStatus | ARStatus;
  amount: number;
  currency: string;
  action: string;
  discrepancyId?: string;
  discrepancySeverity?: LCDiscrepancySeverity;
  description?: string;
  accountReceivableId?: string;
  commercialInvoice_id?: string | null;
  invoiceNumber?: string;
  invoiceDueDate?: string | null;
  openAmountForeign?: number;
  invoices?: LCDeadlineInvoiceSnapshot[];
  notificationChannels?: LCDeadlineNotificationChannel[];
}

type LCDeadlineNotificationChannel = 'DASHBOARD' | 'SOCKET' | 'EMAIL_DIGEST';

interface LCDeadlineInvoiceSnapshot {
  accountReceivableId: string;
  commercialInvoice_id: string | null;
  invoiceNumber: string;
  dueDate: string | null;
  amountForeign: number;
  paidAmountForeign: number;
  openAmountForeign: number;
  currency: string;
  status: ARStatus;
}

interface LCDeadlineNotification {
  _id: string;
  title: string;
  body: string;
  severity: LCDeadlineSeverity;
  channels: LCDeadlineNotificationChannel[];
  lcId: string;
  lcNumber: string;
  salesContractId: string;
  contractNumber: string | null;
  invoiceNumber?: string;
  dueDate: string | null;
  daysRemaining: number | null;
  action: string;
}

interface LCDeadlineGroup {
  key: string;
  label: string;
  salesContractId?: string;
  contractNumber?: string | null;
  buyerName?: string | null;
  lcNumbers: string[];
  nextDeadline: string | null;
  severity: LCDeadlineSeverity;
  amountExposure: number;
  counts: {
    total: number;
    overdue: number;
    dueToday: number;
    critical: number;
    warning: number;
    upcoming: number;
  };
  typeBuckets: Record<LCDeadlineType, number>;
  deadlineItems: LCDeadlineItem[];
}

interface ProformaPaymentSnapshot {
  depositAmount?: number | string | null;
  depositPercent?: number | string | null;
}

@Injectable()
export class TradeFinanceService extends BaseService<LetterOfCredit> {
  @InjectRepository(SalesContract)
  private scRepository: Repository<SalesContract>;

  @InjectRepository(CollectionOrder)
  private collectionRepository: Repository<CollectionOrder>;

  @InjectRepository(LCDiscrepancy)
  private discrepancyRepository: Repository<LCDiscrepancy>;

  @InjectRepository(AccountReceivable)
  private arRepository: Repository<AccountReceivable>;

  constructor(
    @InjectRepository(LetterOfCredit)
    private lcRepository: Repository<LetterOfCredit>,
    @InjectRepository(TradeFinanceTransaction)
    private transactionRepository: Repository<TradeFinanceTransaction>,
    private accountingService: AccountingService,
    private accountReceivablesService: AccountReceivablesService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {
    super(lcRepository);
  }

  async createLC(createLCDto: CreateLCDto, user: User) {
    await this.assertSalesContractExists(createLCDto.salesContractId);
    this.validateLCPayload(createLCDto);

    return this.create({
      ...createLCDto,
      createdByUsername: user.username,
      status: LCStatus.DRAFT,
    });
  }

  async findAllLC(query: QueryParams) {
    const current = this.getPositiveNumberQuery(query.current, 1);
    const pageSize = Math.min(
      this.getPositiveNumberQuery(query.pageSize, 10),
      100,
    );
    const search = this.getStringQuery(
      query.search || query.keyword || query.q,
    )?.trim();
    const status = this.getStringQuery(query.status);

    const queryBuilder = this.lcRepository
      .createQueryBuilder('lc')
      .leftJoinAndSelect('lc.salesContract', 'salesContract')
      .leftJoinAndSelect('salesContract.buyer', 'buyer')
      .leftJoinAndSelect('lc.createdBy', 'createdBy')
      .orderBy('lc.createdAt', 'DESC')
      .skip((current - 1) * pageSize)
      .take(pageSize);

    if (search) {
      queryBuilder.andWhere(
        `(
          "lc"."lcNumber" ILIKE :search ESCAPE '\\'
          OR "lc"."issuingBank" ILIKE :search ESCAPE '\\'
          OR "lc"."advisingBank" ILIKE :search ESCAPE '\\'
          OR "salesContract"."contractNumber" ILIKE :search ESCAPE '\\'
          OR "buyer"."name" ILIKE :search ESCAPE '\\'
        )`,
        { search: `%${this.escapeLike(search)}%` },
      );
    }

    if (status && Object.values(LCStatus).includes(status as LCStatus)) {
      queryBuilder.andWhere('"lc"."status" = :status', { status });
    }

    const [results, total] = await queryBuilder.getManyAndCount();

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

  async findOneLC(id: string) {
    const relations = ['salesContract', 'salesContract.buyer', 'createdBy'];
    return this.findOne(id, relations);
  }

  async updateLC(id: string, updateLCDto: UpdateLCDto) {
    const lc = await this.findOneLC(id);
    if (
      updateLCDto.salesContractId &&
      updateLCDto.salesContractId !== lc.salesContractId
    ) {
      await this.assertSalesContractExists(updateLCDto.salesContractId);
    }
    this.validateLCPayload(updateLCDto, lc);

    const updated = this.lcRepository.merge(lc, updateLCDto);
    return this.lcRepository.save(updated);
  }

  async updateLCStatus(id: string, status: LCStatus) {
    const lc = await this.findOneLC(id);
    this.validateLCStatusTransition(lc.status, status);
    if (status === LCStatus.ACCEPTED) {
      await this.assertNoBlockingLCDiscrepancy(id);
    }
    return this.update(id, { status });
  }

  async createLCDiscrepancy(
    id: string,
    dto: CreateLCDiscrepancyDto,
    user: User,
  ) {
    const lc = await this.findOneLC(id);
    if (
      ![
        LCStatus.DOCUMENTS_PRESENTED,
        LCStatus.RECEIVED,
        LCStatus.ACCEPTED,
      ].includes(lc.status)
    ) {
      throw new BadRequestException(
        'Chi ghi nhan discrepancy sau khi L/C da nhan hoac da xuat trinh chung tu',
      );
    }

    const discrepancy = this.discrepancyRepository.create({
      lcId: id,
      exportDocumentId: dto.exportDocumentId || undefined,
      documentType: dto.documentType || undefined,
      severity: dto.severity || LCDiscrepancySeverity.MEDIUM,
      status: LCDiscrepancyStatus.OPEN,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      reportedByUsername: user.username,
    });

    return this.discrepancyRepository.save(discrepancy);
  }

  async findLCDiscrepancies(id: string) {
    await this.findOneLC(id);
    return this.discrepancyRepository.find({
      where: { lcId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async resolveLCDiscrepancy(
    id: string,
    discrepancyId: string,
    dto: ResolveLCDiscrepancyDto,
    user: User,
  ) {
    await this.findOneLC(id);
    const discrepancy = await this.discrepancyRepository.findOne({
      where: { _id: discrepancyId, lcId: id },
    });
    if (!discrepancy) throw new BadRequestException('LC discrepancy not found');
    if (
      ![
        LCDiscrepancyStatus.AMENDED,
        LCDiscrepancyStatus.WAIVED,
        LCDiscrepancyStatus.ACCEPTED_BY_BUYER,
        LCDiscrepancyStatus.RESOLVED,
        LCDiscrepancyStatus.CANCELLED,
      ].includes(dto.status)
    ) {
      throw new BadRequestException(
        'Trang thai xu ly discrepancy khong hop le',
      );
    }

    discrepancy.status = dto.status;
    discrepancy.resolutionNote =
      dto.resolutionNote || discrepancy.resolutionNote;
    discrepancy.resolvedByUsername = user.username;
    discrepancy.resolvedAt = new Date();
    return this.discrepancyRepository.save(discrepancy);
  }

  async getLCAlerts(days = 14): Promise<Record<string, unknown>> {
    const normalizedDays = this.normalizeDeadlineWindow(days);
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + normalizedDays);

    const lcs = await this.lcRepository.find({
      relations: ['salesContract', 'salesContract.buyer'],
      order: { expiryDate: 'ASC' },
    });

    const active = lcs.filter((lc) =>
      [
        LCStatus.RECEIVED,
        LCStatus.DOCUMENTS_PRESENTED,
        LCStatus.ACCEPTED,
      ].includes(lc.status),
    );
    const expiring = active.filter((lc) => new Date(lc.expiryDate) <= horizon);
    const shipmentDeadline = active.filter(
      (lc) =>
        lc.latestShipmentDate && new Date(lc.latestShipmentDate) <= horizon,
    );
    const presentationDeadline = active.filter(
      (lc) =>
        lc.presentationDeadline && new Date(lc.presentationDeadline) <= horizon,
    );
    const openDiscrepancies = await this.discrepancyRepository.find({
      where: { status: LCDiscrepancyStatus.OPEN },
      relations: [
        'letterOfCredit',
        'letterOfCredit.salesContract',
        'letterOfCredit.salesContract.buyer',
      ],
      order: { dueDate: 'ASC', createdAt: 'DESC' },
    });

    const receivables = await this.findReceivablesForLCs(active);
    const invoiceSnapshotsByContract =
      this.groupInvoiceSnapshotsByContract(receivables);
    const contractSnapshotById = new Map(
      active.map((lc) => [lc.salesContractId, lc]),
    );
    const timeline = [
      ...this.enrichLCDeadlineItemsWithInvoices(
        this.buildLCDeadlineItems(active, horizon, now),
        invoiceSnapshotsByContract,
      ),
      ...this.buildLCDiscrepancyDeadlineItems(openDiscrepancies, horizon, now),
      ...this.buildInvoiceDeadlineItems(
        receivables,
        contractSnapshotById,
        horizon,
        now,
      ),
    ].sort((left, right) => {
      if (!left.dueDate && !right.dueDate) return 0;
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return (
        new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
      );
    });

    const severityBuckets = this.countBySeverity(timeline);
    const typeBuckets = this.countByDeadlineType(timeline);
    const byContract = this.buildLCDeadlineGroups(timeline, 'CONTRACT');
    const byBuyer = this.buildLCDeadlineGroups(timeline, 'BUYER');
    const nextActions = timeline
      .filter((item) =>
        ['OVERDUE', 'TODAY', 'CRITICAL', 'WARNING'].includes(item.severity),
      )
      .slice(0, 12);
    const notifications = this.buildDeadlineNotifications(nextActions);

    return {
      days: normalizedDays,
      expiring,
      shipmentDeadline,
      presentationDeadline,
      openDiscrepancies,
      timeline,
      byContract,
      byBuyer,
      nextActions,
      notifications,
      notificationChannels: [
        {
          channel: 'DASHBOARD',
          enabled: true,
          description: 'Visible in deadline dashboard and badges',
        },
        {
          channel: 'SOCKET',
          enabled: true,
          description: 'Realtime in-app broadcast for active admin sessions',
        },
        {
          channel: 'EMAIL_DIGEST',
          enabled: false,
          description:
            'Digest payload is prepared; SMTP routing can be enabled per tenant',
        },
      ],
      exposure: {
        activeLcAmount: this.sumUniqueLcAmount(
          active.map((lc) => ({
            lcId: lc._id,
            amount: Number(lc.amount || 0),
          })),
        ),
        deadlineAmount: this.sumUniqueLcAmount(timeline),
        overdueAmount: this.sumUniqueLcAmount(
          timeline.filter((item) => item.severity === 'OVERDUE'),
        ),
        criticalAmount: this.sumUniqueLcAmount(
          timeline.filter((item) =>
            ['TODAY', 'CRITICAL'].includes(item.severity),
          ),
        ),
        presentationAmount: this.sumUniqueLcAmount(
          timeline.filter((item) => item.type === 'PRESENTATION'),
        ),
        discrepancyAmount: this.sumUniqueLcAmount(
          timeline.filter((item) => item.type === 'DISCREPANCY'),
        ),
        invoiceOpenAmount: timeline
          .filter((item) => item.type === 'INVOICE_DUE')
          .reduce((sum, item) => sum + Number(item.openAmountForeign || 0), 0),
      },
      buckets: {
        severity: severityBuckets,
        type: typeBuckets,
      },
      windows: {
        overdue: timeline.filter((item) => item.severity === 'OVERDUE'),
        dueToday: timeline.filter((item) => item.severity === 'TODAY'),
        next7Days: timeline.filter(
          (item) =>
            item.daysRemaining !== null &&
            item.daysRemaining > 0 &&
            item.daysRemaining <= 7,
        ),
        next14Days: timeline.filter(
          (item) =>
            item.daysRemaining !== null &&
            item.daysRemaining > 7 &&
            item.daysRemaining <= 14,
        ),
      },
      counts: {
        expiring: expiring.length,
        shipmentDeadline: shipmentDeadline.length,
        presentationDeadline: presentationDeadline.length,
        openDiscrepancies: openDiscrepancies.length,
        deadlineItems: timeline.length,
        invoiceDue: typeBuckets.INVOICE_DUE,
        overdue: severityBuckets.OVERDUE,
        dueToday: severityBuckets.TODAY,
        critical: severityBuckets.CRITICAL,
        actionRequired: nextActions.length,
      },
    };
  }

  async publishDeadlineNotifications(days = 14, username = 'system') {
    const dashboard = await this.getLCAlerts(days);
    const notifications = Array.isArray(dashboard.notifications)
      ? (dashboard.notifications as LCDeadlineNotification[])
      : [];

    notifications.forEach((notification) => {
      this.eventEmitter.emit('notification.trade_finance_deadline', {
        ...notification,
        username,
        emittedAt: new Date().toISOString(),
      });
    });

    return {
      emitted: notifications.length,
      notifications,
      channels: dashboard.notificationChannels,
    };
  }

  private async findReceivablesForLCs(
    lcs: LetterOfCredit[],
  ): Promise<AccountReceivable[]> {
    const contractIds = Array.from(
      new Set(lcs.map((lc) => lc.salesContractId).filter(Boolean)),
    );
    if (!contractIds.length) return [];

    return this.arRepository.find({
      where: { salesContractId: In(contractIds) },
      relations: ['allocations'],
      order: { dueDate: 'ASC', invoiceDate: 'ASC' },
    });
  }

  private groupInvoiceSnapshotsByContract(
    receivables: AccountReceivable[],
  ): Map<string, LCDeadlineInvoiceSnapshot[]> {
    const groups = new Map<string, LCDeadlineInvoiceSnapshot[]>();

    receivables.forEach((receivable) => {
      if (!receivable.salesContractId) return;
      const snapshot = this.toInvoiceDeadlineSnapshot(receivable);
      const current = groups.get(receivable.salesContractId) || [];
      current.push(snapshot);
      groups.set(receivable.salesContractId, current);
    });

    return groups;
  }

  private toInvoiceDeadlineSnapshot(
    receivable: AccountReceivable,
  ): LCDeadlineInvoiceSnapshot {
    const amountForeign = Number(receivable.amountForeign || 0);
    const paidAmountForeign = Number(receivable.paidAmountForeign || 0);
    return {
      accountReceivableId: receivable._id,
      commercialInvoice_id: receivable.commercialInvoice_id || null,
      invoiceNumber: receivable.invoiceNumber,
      dueDate: receivable.dueDate
        ? new Date(receivable.dueDate).toISOString()
        : null,
      amountForeign,
      paidAmountForeign,
      openAmountForeign: Math.max(amountForeign - paidAmountForeign, 0),
      currency: receivable.currency || 'USD',
      status: receivable.status,
    };
  }

  private enrichLCDeadlineItemsWithInvoices(
    items: LCDeadlineItem[],
    invoiceSnapshotsByContract: Map<string, LCDeadlineInvoiceSnapshot[]>,
  ): LCDeadlineItem[] {
    return items.map((item) => {
      const invoices =
        invoiceSnapshotsByContract.get(item.salesContractId) || [];
      return {
        ...item,
        invoices,
        openAmountForeign: invoices.reduce(
          (sum, invoice) => sum + invoice.openAmountForeign,
          0,
        ),
        notificationChannels: this.getNotificationChannels(item.severity),
      };
    });
  }

  private buildInvoiceDeadlineItems(
    receivables: AccountReceivable[],
    lcByContract: Map<string, LetterOfCredit>,
    horizon: Date,
    now: Date,
  ): LCDeadlineItem[] {
    const items: LCDeadlineItem[] = [];

    receivables.forEach((receivable) => {
      if (
        !receivable.salesContractId ||
        [ARStatus.PAID, ARStatus.CANCELLED].includes(receivable.status)
      )
        return;
      if (!receivable.dueDate) return;
      const dueDate = new Date(receivable.dueDate);
      if (
        Number.isNaN(dueDate.getTime()) ||
        dueDate.getTime() > horizon.getTime()
      )
        return;

      const openAmountForeign = Math.max(
        Number(receivable.amountForeign || 0) -
          Number(receivable.paidAmountForeign || 0),
        0,
      );
      if (openAmountForeign <= 0) return;

      const lc = lcByContract.get(receivable.salesContractId);
      const daysRemaining = this.getDaysRemaining(dueDate, now);
      const severity = this.getDeadlineSeverity(daysRemaining);

      items.push({
        _id: `${receivable._id}-INVOICE_DUE`,
        lcId: lc?._id || `NO_LC-${receivable.salesContractId}`,
        lcNumber: lc?.lcNumber || 'No L/C',
        salesContractId: receivable.salesContractId,
        contractNumber: lc?.salesContract?.contractNumber || null,
        buyerName: lc?.salesContract?.buyer?.name || null,
        type: 'INVOICE_DUE',
        label: 'Commercial Invoice due',
        dueDate: dueDate.toISOString(),
        daysRemaining,
        severity,
        status: receivable.status,
        amount: Number(lc?.amount || receivable.amountForeign || 0),
        currency: receivable.currency || lc?.currency || 'USD',
        action:
          daysRemaining < 0
            ? 'Escalate overdue buyer payment and reconcile T/T allocation'
            : 'Follow up buyer payment and allocate T/T to this invoice',
        accountReceivableId: receivable._id,
        commercialInvoice_id: receivable.commercialInvoice_id || null,
        invoiceNumber: receivable.invoiceNumber,
        invoiceDueDate: dueDate.toISOString(),
        openAmountForeign,
        invoices: [this.toInvoiceDeadlineSnapshot(receivable)],
        notificationChannels: this.getNotificationChannels(severity),
      });
    });

    return items;
  }

  private buildDeadlineNotifications(
    items: LCDeadlineItem[],
  ): LCDeadlineNotification[] {
    return items.map((item) => ({
      _id: `tf-deadline-${item._id}`,
      title: `${item.severity}: ${item.label}`,
      body: [
        item.lcNumber,
        item.contractNumber || item.salesContractId,
        item.invoiceNumber ? `Invoice ${item.invoiceNumber}` : null,
        item.daysRemaining === null
          ? 'needs deadline'
          : item.daysRemaining < 0
            ? `overdue ${Math.abs(item.daysRemaining)} day(s)`
            : item.daysRemaining === 0
              ? 'due today'
              : `${item.daysRemaining} day(s) left`,
      ]
        .filter(Boolean)
        .join(' - '),
      severity: item.severity,
      channels:
        item.notificationChannels ||
        this.getNotificationChannels(item.severity),
      lcId: item.lcId,
      lcNumber: item.lcNumber,
      salesContractId: item.salesContractId,
      contractNumber: item.contractNumber,
      invoiceNumber: item.invoiceNumber,
      dueDate: item.dueDate,
      daysRemaining: item.daysRemaining,
      action: item.action,
    }));
  }

  private getNotificationChannels(
    severity: LCDeadlineSeverity,
  ): LCDeadlineNotificationChannel[] {
    if (['OVERDUE', 'TODAY', 'CRITICAL'].includes(severity)) {
      return ['DASHBOARD', 'SOCKET', 'EMAIL_DIGEST'];
    }
    if (severity === 'WARNING') {
      return ['DASHBOARD', 'SOCKET'];
    }
    return ['DASHBOARD'];
  }

  private buildLCDeadlineItems(
    lcs: LetterOfCredit[],
    horizon: Date,
    now: Date,
  ): LCDeadlineItem[] {
    const items: LCDeadlineItem[] = [];

    for (const lc of lcs) {
      this.pushLCDeadlineItem(
        items,
        lc,
        'EXPIRY',
        'L/C expiry',
        lc.expiryDate,
        horizon,
        now,
        'Close payment or extend L/C before expiry',
      );
      if (lc.status === LCStatus.RECEIVED) {
        this.pushLCDeadlineItem(
          items,
          lc,
          'LATEST_SHIPMENT',
          'Latest shipment',
          lc.latestShipmentDate,
          horizon,
          now,
          'Confirm shipment/export delivery against L/C',
        );
        this.pushLCDeadlineItem(
          items,
          lc,
          'PRESENTATION',
          'Document presentation',
          lc.presentationDeadline,
          horizon,
          now,
          'Present export documents to advising bank',
        );
      }
      if (lc.status === LCStatus.DOCUMENTS_PRESENTED) {
        this.pushLCDeadlineItem(
          items,
          lc,
          'PRESENTATION',
          'Document presentation',
          lc.presentationDeadline,
          horizon,
          now,
          'Present export documents to advising bank',
        );
      }
    }

    return items;
  }

  private async assertSalesContractExists(salesContractId: string) {
    const exists = await this.scRepository.exists({
      where: { _id: salesContractId },
    });
    if (!exists) {
      throw new NotFoundException('Sales contract not found');
    }
  }

  private validateLCPayload(
    dto: Partial<CreateLCDto>,
    current?: LetterOfCredit,
  ) {
    const amount =
      dto.amount !== undefined ? Number(dto.amount) : current?.amount;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      throw new BadRequestException('L/C amount must be greater than zero');
    }

    const issueDate = this.resolveDateValue(dto.issueDate, current?.issueDate);
    const expiryDate = this.resolveDateValue(
      dto.expiryDate,
      current?.expiryDate,
    );
    const latestShipmentDate = this.resolveDateValue(
      dto.latestShipmentDate,
      current?.latestShipmentDate,
    );
    const presentationDeadline = this.resolveDateValue(
      dto.presentationDeadline,
      current?.presentationDeadline,
    );

    if (issueDate && expiryDate && issueDate.getTime() > expiryDate.getTime()) {
      throw new BadRequestException(
        'L/C issue date must be on or before expiry date',
      );
    }
    if (
      latestShipmentDate &&
      expiryDate &&
      latestShipmentDate.getTime() > expiryDate.getTime()
    ) {
      throw new BadRequestException(
        'Latest shipment date must be on or before L/C expiry date',
      );
    }
    if (
      presentationDeadline &&
      expiryDate &&
      presentationDeadline.getTime() > expiryDate.getTime()
    ) {
      throw new BadRequestException(
        'Presentation deadline must be on or before L/C expiry date',
      );
    }
  }

  private resolveDateValue(
    value?: string | null,
    fallback?: Date | string | null,
  ): Date | null {
    const raw = value !== undefined ? value : fallback;
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid L/C date value');
    }
    return date;
  }

  private normalizeDeadlineWindow(days: number) {
    if (!Number.isFinite(days)) return 14;
    return Math.min(Math.max(Math.trunc(days), 1), 90);
  }

  private getPositiveNumberQuery(value: unknown, fallback: number) {
    const numberValue = Number(this.getStringQuery(value) ?? value);
    return Number.isFinite(numberValue) && numberValue > 0
      ? Math.trunc(numberValue)
      : fallback;
  }

  private getStringQuery(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  }

  private escapeLike(value: string) {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private pushLCDeadlineItem(
    items: LCDeadlineItem[],
    lc: LetterOfCredit,
    type: LCDeadlineType,
    label: string,
    value: Date | string | null | undefined,
    horizon: Date,
    now: Date,
    action: string,
  ) {
    if (!value) return;
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return;
    if (dueDate.getTime() > horizon.getTime()) return;

    const daysRemaining = this.getDaysRemaining(dueDate, now);
    const severity = this.getDeadlineSeverity(daysRemaining);
    items.push({
      _id: `${lc._id}-${type}`,
      lcId: lc._id,
      lcNumber: lc.lcNumber,
      salesContractId: lc.salesContractId,
      contractNumber: lc.salesContract?.contractNumber || null,
      buyerName: lc.salesContract?.buyer?.name || null,
      type,
      label,
      dueDate: dueDate.toISOString(),
      daysRemaining,
      severity,
      status: lc.status,
      amount: Number(lc.amount || 0),
      currency: lc.currency || 'USD',
      action,
      notificationChannels: this.getNotificationChannels(severity),
    });
  }

  private buildLCDiscrepancyDeadlineItems(
    discrepancies: LCDiscrepancy[],
    horizon: Date,
    now: Date,
  ): LCDeadlineItem[] {
    const items: LCDeadlineItem[] = [];

    for (const discrepancy of discrepancies) {
      const dueDate = discrepancy.dueDate
        ? new Date(discrepancy.dueDate)
        : null;
      if (dueDate && dueDate.getTime() > horizon.getTime()) continue;

      const lc = discrepancy.letterOfCredit;
      const daysRemaining = dueDate
        ? this.getDaysRemaining(dueDate, now)
        : null;
      const severity =
        daysRemaining === null
          ? this.getDiscrepancySeverity(discrepancy.severity)
          : this.getDeadlineSeverity(daysRemaining);

      items.push({
        _id: `${discrepancy._id}-DISCREPANCY`,
        lcId: discrepancy.lcId,
        lcNumber: lc?.lcNumber || discrepancy.lcId,
        salesContractId: lc?.salesContractId || '',
        contractNumber: lc?.salesContract?.contractNumber || null,
        buyerName: lc?.salesContract?.buyer?.name || null,
        type: 'DISCREPANCY',
        label: 'Open discrepancy',
        dueDate: dueDate ? dueDate.toISOString() : null,
        daysRemaining,
        severity,
        status: discrepancy.status,
        amount: Number(lc?.amount || 0),
        currency: lc?.currency || 'USD',
        action: 'Resolve discrepancy before bank/buyer deadline',
        discrepancyId: discrepancy._id,
        discrepancySeverity: discrepancy.severity,
        description: discrepancy.description,
        notificationChannels: this.getNotificationChannels(severity),
      });
    }

    return items;
  }

  private getDaysRemaining(dueDate: Date, now: Date) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dueDate);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getDeadlineSeverity(daysRemaining: number): LCDeadlineSeverity {
    if (daysRemaining < 0) return 'OVERDUE';
    if (daysRemaining === 0) return 'TODAY';
    if (daysRemaining <= 3) return 'CRITICAL';
    if (daysRemaining <= 7) return 'WARNING';
    return 'UPCOMING';
  }

  private getDiscrepancySeverity(
    severity: LCDiscrepancySeverity,
  ): LCDeadlineSeverity {
    if (
      [LCDiscrepancySeverity.CRITICAL, LCDiscrepancySeverity.HIGH].includes(
        severity,
      )
    ) {
      return 'CRITICAL';
    }
    return 'WARNING';
  }

  private countBySeverity(items: LCDeadlineItem[]) {
    const counts: Record<LCDeadlineSeverity, number> = {
      OVERDUE: 0,
      TODAY: 0,
      CRITICAL: 0,
      WARNING: 0,
      UPCOMING: 0,
    };
    items.forEach((item) => {
      counts[item.severity] += 1;
    });
    return counts;
  }

  private countByDeadlineType(items: LCDeadlineItem[]) {
    const counts: Record<LCDeadlineType, number> = {
      EXPIRY: 0,
      LATEST_SHIPMENT: 0,
      PRESENTATION: 0,
      DISCREPANCY: 0,
      INVOICE_DUE: 0,
    };
    items.forEach((item) => {
      counts[item.type] += 1;
    });
    return counts;
  }

  private buildLCDeadlineGroups(
    items: LCDeadlineItem[],
    groupBy: 'CONTRACT' | 'BUYER',
  ): LCDeadlineGroup[] {
    const groups = new Map<string, LCDeadlineGroup>();

    items.forEach((item) => {
      const key =
        groupBy === 'CONTRACT'
          ? item.salesContractId || item.lcId
          : item.buyerName || 'UNKNOWN_BUYER';
      const label =
        groupBy === 'CONTRACT'
          ? item.contractNumber || item.salesContractId || item.lcNumber
          : item.buyerName || 'Unknown buyer';

      const group: LCDeadlineGroup = groups.get(key) || {
        key,
        label,
        salesContractId:
          groupBy === 'CONTRACT' ? item.salesContractId : undefined,
        contractNumber:
          groupBy === 'CONTRACT' ? item.contractNumber : undefined,
        buyerName: item.buyerName,
        lcNumbers: [],
        nextDeadline: null,
        severity: 'UPCOMING' as LCDeadlineSeverity,
        amountExposure: 0,
        counts: {
          total: 0,
          overdue: 0,
          dueToday: 0,
          critical: 0,
          warning: 0,
          upcoming: 0,
        },
        typeBuckets: {
          EXPIRY: 0,
          LATEST_SHIPMENT: 0,
          PRESENTATION: 0,
          DISCREPANCY: 0,
          INVOICE_DUE: 0,
        },
        deadlineItems: [],
      };

      if (!group.lcNumbers.includes(item.lcNumber)) {
        group.lcNumbers.push(item.lcNumber);
      }
      group.deadlineItems.push(item);
      group.counts.total += 1;
      group.counts.overdue += item.severity === 'OVERDUE' ? 1 : 0;
      group.counts.dueToday += item.severity === 'TODAY' ? 1 : 0;
      group.counts.critical += item.severity === 'CRITICAL' ? 1 : 0;
      group.counts.warning += item.severity === 'WARNING' ? 1 : 0;
      group.counts.upcoming += item.severity === 'UPCOMING' ? 1 : 0;
      group.typeBuckets[item.type] += 1;
      group.severity = this.getWorstSeverity([group.severity, item.severity]);
      group.nextDeadline = this.getEarlierDate(
        group.nextDeadline,
        item.dueDate,
      );
      group.amountExposure = this.sumUniqueLcAmount(group.deadlineItems);

      groups.set(key, group);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        deadlineItems: this.sortDeadlineItems(group.deadlineItems),
      }))
      .sort((left, right) => {
        const severityDelta =
          this.getSeverityRank(left.severity) -
          this.getSeverityRank(right.severity);
        if (severityDelta !== 0) return severityDelta;
        if (!left.nextDeadline && !right.nextDeadline) return 0;
        if (!left.nextDeadline) return 1;
        if (!right.nextDeadline) return -1;
        return (
          new Date(left.nextDeadline).getTime() -
          new Date(right.nextDeadline).getTime()
        );
      });
  }

  private sortDeadlineItems(items: LCDeadlineItem[]) {
    return [...items].sort((left, right) => {
      const severityDelta =
        this.getSeverityRank(left.severity) -
        this.getSeverityRank(right.severity);
      if (severityDelta !== 0) return severityDelta;
      if (!left.dueDate && !right.dueDate) return 0;
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return (
        new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
      );
    });
  }

  private getEarlierDate(current: string | null, candidate: string | null) {
    if (!candidate) return current;
    if (!current) return candidate;
    return new Date(candidate).getTime() < new Date(current).getTime()
      ? candidate
      : current;
  }

  private getWorstSeverity(values: LCDeadlineSeverity[]) {
    return values.sort(
      (left, right) => this.getSeverityRank(left) - this.getSeverityRank(right),
    )[0];
  }

  private getSeverityRank(severity: LCDeadlineSeverity) {
    const ranks: Record<LCDeadlineSeverity, number> = {
      OVERDUE: 0,
      TODAY: 1,
      CRITICAL: 2,
      WARNING: 3,
      UPCOMING: 4,
    };
    return ranks[severity];
  }

  private sumUniqueLcAmount(items: Array<{ lcId: string; amount: number }>) {
    const amountByLc = new Map<string, number>();
    items.forEach((item) => {
      amountByLc.set(item.lcId, Number(item.amount || 0));
    });
    return Array.from(amountByLc.values()).reduce(
      (sum, amount) => sum + amount,
      0,
    );
  }

  private async assertNoBlockingLCDiscrepancy(lcId: string) {
    const openCount = await this.discrepancyRepository.count({
      where: { lcId, status: LCDiscrepancyStatus.OPEN },
    });
    if (openCount > 0) {
      throw new BadRequestException(
        'L/C con discrepancy dang mo, khong the chuyen sang ACCEPTED',
      );
    }
  }

  private validateLCStatusTransition(
    currentStatus: LCStatus,
    nextStatus: LCStatus,
  ) {
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
   * Lấy danh sách Lệnh nhờ thu
   */
  async findAllCollections(query: QueryParams) {
    const relations = ['salesContract', 'salesContract.buyer'];
    // Collection orders live beside L/C records, so they use their own repository.
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    const current = Number(query.current ?? 1) || 1;
    const pageSize = Number(query.pageSize ?? 10) || 10;
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    const [results, total] = await this.collectionRepository.findAndCount({
      where: filter,
      relations,
      order: sort || { createdAt: 'DESC' },
      skip: (current - 1) * pageSize,
      take: pageSize,
    });

    return { results, totalItems: total, current, pageSize };
  }

  async createCollection(data: CreateCollectionInput, user: User) {
    const collection = this.collectionRepository.create({
      ...data,
      status: CollectionOrderStatus.SENT,
    });
    return this.collectionRepository.save(collection);
  }

  async updateCollectionStatus(id: string, status: CollectionOrderStatus) {
    const collection = await this.collectionRepository.findOne({
      where: { _id: id },
    });
    if (!collection)
      throw new BadRequestException('Collection Order not found');
    collection.status = status;
    return this.collectionRepository.save(collection);
  }

  async getReconciliationSummary(salesContractId: string) {
    const contract = await this.scRepository.findOne({
      where: { _id: salesContractId },
      relations: ['buyer', 'proformaInvoice'],
    });
    if (!contract) throw new BadRequestException('Sales Contract not found');

    const transactions = await this.transactionRepository.find({
      where: { salesContractId },
      order: { transactionDate: 'ASC', createdAt: 'ASC' },
    });
    const receivables = await this.arRepository.find({
      where: { salesContractId },
      relations: ['allocations'],
      order: { dueDate: 'ASC', invoiceDate: 'ASC' },
    });

    const receivedTransactions = transactions.filter(
      (tx) => tx.status === TradeFinanceStatus.RECEIVED,
    );
    const receivedAdvance = receivedTransactions
      .filter((tx) => tx.type === TradeFinanceType.TT_ADVANCE)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const receivedTTBalance = receivedTransactions
      .filter((tx) => tx.type === TradeFinanceType.TT_BALANCE)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const receivedCollections = receivedTransactions
      .filter((tx) =>
        [TradeFinanceType.DP, TradeFinanceType.DA].includes(tx.type),
      )
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const receivedBalance = receivedTTBalance + receivedCollections;
    const receivedTotal = receivedAdvance + receivedBalance;

    const contractTotal = Number(contract.totalAmount || 0);
    const pi = contract.proformaInvoice;
    const expectedAdvance = this.deriveExpectedAdvance(contractTotal, pi);
    const expectedBalance = Math.max(contractTotal - expectedAdvance, 0);
    const arTotal = receivables.reduce(
      (sum, ar) => sum + Number(ar.amountForeign || 0),
      0,
    );
    const arPaid = receivables.reduce(
      (sum, ar) => sum + Number(ar.paidAmountForeign || 0),
      0,
    );
    const openAr =
      arTotal > 0
        ? Math.max(arTotal - arPaid, 0)
        : Math.max(contractTotal - receivedTotal, 0);
    const transactionById = new Map(transactions.map((tx) => [tx._id, tx]));
    const allocationTotals: Record<PaymentStage, number> = {
      ADVANCE: 0,
      BALANCE: 0,
      COLLECTION: 0,
      MANUAL: 0,
    };
    const allocationDetailsFlat: Array<{
      _id: string;
      accountReceivableId: string;
      invoiceNumber: string;
      currency: string;
      tradeFinanceTransactionId: string | null;
      transactionType: TradeFinanceType | null;
      transactionStatus: TradeFinanceStatus | null;
      paymentStage: PaymentStage;
      bankReference: string | null;
      transactionDate: Date | null;
      allocatedAmountForeign: number;
      allocatedAmountVnd: number;
      exchangeRate: number;
      allocatedAt: Date;
      allocatedByUsername: string;
      note: string | null;
    }> = [];
    const receivableAllocations = receivables.map((ar) => {
      const allocationDetails = (ar.allocations || []).map((allocation) => {
        const tx = allocation.tradeFinanceTransactionId
          ? transactionById.get(allocation.tradeFinanceTransactionId)
          : undefined;
        const paymentStage = this.getPaymentStage(tx?.type);
        const amountForeign = Number(allocation.allocatedAmountForeign || 0);
        allocationTotals[paymentStage] += amountForeign;

        return {
          _id: allocation._id,
          tradeFinanceTransactionId: allocation.tradeFinanceTransactionId,
          transactionType: tx?.type || null,
          transactionStatus: tx?.status || null,
          paymentStage,
          bankReference: tx?.bankReference || null,
          transactionDate: tx?.transactionDate || null,
          allocatedAmountForeign: amountForeign,
          allocatedAmountVnd: Number(allocation.allocatedAmountVnd || 0),
          exchangeRate: Number(allocation.exchangeRate || 1),
          allocatedAt: allocation.allocatedAt,
          allocatedByUsername: allocation.allocatedByUsername,
          note: allocation.note,
        };
      });
      allocationDetailsFlat.push(
        ...allocationDetails.map((allocation) => ({
          ...allocation,
          accountReceivableId: ar._id,
          invoiceNumber: ar.invoiceNumber,
          currency: ar.currency,
        })),
      );

      const advanceAllocated = allocationDetails
        .filter((allocation) => allocation.paymentStage === 'ADVANCE')
        .reduce(
          (sum, allocation) => sum + allocation.allocatedAmountForeign,
          0,
        );
      const balanceAllocated = allocationDetails
        .filter((allocation) => allocation.paymentStage === 'BALANCE')
        .reduce(
          (sum, allocation) => sum + allocation.allocatedAmountForeign,
          0,
        );
      const collectionAllocated = allocationDetails
        .filter((allocation) => allocation.paymentStage === 'COLLECTION')
        .reduce(
          (sum, allocation) => sum + allocation.allocatedAmountForeign,
          0,
        );
      const manualAllocated = allocationDetails
        .filter((allocation) => allocation.paymentStage === 'MANUAL')
        .reduce(
          (sum, allocation) => sum + allocation.allocatedAmountForeign,
          0,
        );

      return {
        accountReceivableId: ar._id,
        commercialInvoice_id: ar.commercialInvoice_id || null,
        invoiceNumber: ar.invoiceNumber,
        salesContractId: ar.salesContractId,
        sourceType: ar.sourceType,
        dueDate: ar.dueDate,
        amountForeign: Number(ar.amountForeign || 0),
        paidAmountForeign: Number(ar.paidAmountForeign || 0),
        remainingForeign: Math.max(
          Number(ar.amountForeign || 0) - Number(ar.paidAmountForeign || 0),
          0,
        ),
        currency: ar.currency,
        status: ar.status,
        isOverdue: ar.dueDate
          ? new Date(ar.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
          : false,
        advanceAllocated,
        balanceAllocated,
        collectionAllocated,
        manualAllocated,
        allocations: allocationDetails,
      };
    });
    const invoiceAllocationMatrix = receivableAllocations.map((row) => {
      const allocatedTotal =
        row.advanceAllocated +
        row.balanceAllocated +
        row.collectionAllocated +
        row.manualAllocated;
      const allocationPercent =
        row.amountForeign > 0
          ? Number(
              new Decimal(allocatedTotal)
                .div(row.amountForeign)
                .mul(100)
                .toFixed(2),
            )
          : 0;

      return {
        ...row,
        allocatedTotal,
        allocationPercent,
        advanceStatus:
          row.advanceAllocated > 0
            ? 'ALLOCATED'
            : allocationTotals.ADVANCE < expectedAdvance
              ? 'PENDING_ADVANCE'
              : 'NOT_REQUIRED',
        balanceStatus:
          row.remainingForeign <= 0
            ? 'SETTLED'
            : row.balanceAllocated + row.collectionAllocated > 0
              ? 'PARTIAL_BALANCE'
              : 'OPEN_BALANCE',
        suggestedNextStage:
          row.remainingForeign <= 0
            ? 'SETTLED'
            : allocationTotals.ADVANCE < expectedAdvance
              ? 'ADVANCE'
              : 'BALANCE',
        stageBreakdown: {
          advance: row.advanceAllocated,
          balance: row.balanceAllocated,
          collection: row.collectionAllocated,
          manual: row.manualAllocated,
        },
      };
    });
    const transactionAllocations = receivedTransactions.map((tx) => {
      const allocations = allocationDetailsFlat.filter(
        (allocation) => allocation.tradeFinanceTransactionId === tx._id,
      );
      const allocatedAmount = allocations.reduce(
        (sum, allocation) => sum + allocation.allocatedAmountForeign,
        0,
      );
      const stage = this.getPaymentStage(tx.type);

      return {
        _id: tx._id,
        type: tx.type,
        paymentStage: stage,
        status: tx.status,
        bankReference: tx.bankReference,
        transactionDate: tx.transactionDate,
        amount: Number(tx.amount || 0),
        currency: tx.currency || contract.currencyCode || 'USD',
        expectedAmount: Number(tx.expectedAmount || 0),
        varianceAmount: Number(tx.varianceAmount || 0),
        reconciliationStatus: tx.reconciliationStatus,
        allocatedAmount,
        unallocatedAmount: Math.max(
          Number(tx.amount || 0) - allocatedAmount,
          0,
        ),
        allocations,
      };
    });
    const allocatedTotal =
      allocationTotals.ADVANCE +
      allocationTotals.BALANCE +
      allocationTotals.COLLECTION +
      allocationTotals.MANUAL;
    const allocationCoveragePercent =
      contractTotal > 0
        ? Number(
            new Decimal(allocatedTotal).div(contractTotal).mul(100).toFixed(2),
          )
        : 0;

    return {
      salesContract: contract,
      currency: contract.currencyCode || 'USD',
      contractTotal,
      expectedAdvance,
      expectedBalance,
      receivedAdvance,
      receivedBalance,
      receivedTTBalance,
      receivedCollections,
      receivedTotal,
      openAr,
      remainingAdvance: Math.max(expectedAdvance - receivedAdvance, 0),
      remainingBalance: Math.max(expectedBalance - receivedBalance, 0),
      status: openAr <= 0 ? 'SETTLED' : receivedTotal > 0 ? 'PARTIAL' : 'OPEN',
      paymentPlan: {
        advance: {
          expected: expectedAdvance,
          received: receivedAdvance,
          allocated: allocationTotals.ADVANCE,
          remaining: Math.max(expectedAdvance - receivedAdvance, 0),
          unallocated: Math.max(receivedAdvance - allocationTotals.ADVANCE, 0),
          variance: new Decimal(receivedAdvance)
            .minus(expectedAdvance)
            .toNumber(),
        },
        balance: {
          expected: expectedBalance,
          received: receivedTTBalance,
          receivedViaCollections: receivedCollections,
          allocated: allocationTotals.BALANCE,
          allocatedViaCollections: allocationTotals.COLLECTION,
          allocatedTotal:
            allocationTotals.BALANCE + allocationTotals.COLLECTION,
          remaining: Math.max(expectedBalance - receivedBalance, 0),
          unallocated: Math.max(
            receivedBalance -
              allocationTotals.BALANCE -
              allocationTotals.COLLECTION,
            0,
          ),
          variance: new Decimal(receivedBalance)
            .minus(expectedBalance)
            .toNumber(),
        },
        manual: {
          allocated: allocationTotals.MANUAL,
        },
        contract: {
          total: contractTotal,
          received: receivedTotal,
          allocated: allocatedTotal,
          openAr,
          allocationCoveragePercent,
        },
      },
      contractAllocation: {
        contractNumber: contract.contractNumber,
        buyerName: contract.buyer?.name || null,
        currency: contract.currencyCode || 'USD',
        contractTotal,
        expectedAdvance,
        expectedBalance,
        receivedAdvance,
        receivedBalance,
        allocatedAdvance: allocationTotals.ADVANCE,
        allocatedBalance: allocationTotals.BALANCE,
        allocatedCollections: allocationTotals.COLLECTION,
        allocatedManual: allocationTotals.MANUAL,
        allocatedTotal,
        unallocatedReceived: Math.max(receivedTotal - allocatedTotal, 0),
        openAr,
        allocationCoveragePercent,
      },
      invoiceAllocationMatrix,
      transactionAllocations,
      unallocatedTransactions: transactionAllocations.filter(
        (tx) => tx.unallocatedAmount > 0,
      ),
      receivableAllocations,
      receivables,
      transactions,
    };
  }

  private getPaymentStage(type?: TradeFinanceType | null): PaymentStage {
    if (type === TradeFinanceType.TT_ADVANCE) return 'ADVANCE';
    if (type === TradeFinanceType.TT_BALANCE) return 'BALANCE';
    if (type === TradeFinanceType.DP || type === TradeFinanceType.DA)
      return 'COLLECTION';
    return 'MANUAL';
  }

  private deriveExpectedAdvance(
    contractTotal: number,
    proformaInvoice?: ProformaPaymentSnapshot | null,
  ) {
    const depositAmount = Number(proformaInvoice?.depositAmount || 0);
    if (depositAmount > 0) return Math.min(depositAmount, contractTotal);

    const depositPercent = Number(proformaInvoice?.depositPercent || 0);
    if (depositPercent > 0) {
      return Number(
        new Decimal(contractTotal).mul(depositPercent).div(100).toFixed(2),
      );
    }

    return 0;
  }

  private async getExpectedAmountForTransaction(
    data: Pick<CreateTradeFinanceTransactionInput, 'salesContractId' | 'type'>,
  ) {
    if (!data.salesContractId) return null;
    const summary = await this.getReconciliationSummary(data.salesContractId);
    if (data.type === TradeFinanceType.TT_ADVANCE) {
      return summary.remainingAdvance > 0
        ? summary.remainingAdvance
        : summary.openAr;
    }
    return summary.openAr;
  }

  private getReconciliationStatus(
    amount: number,
    expectedAmount: number | null,
  ) {
    if (expectedAmount === null) return ReconciliationStatus.NOT_REQUIRED;
    const variance = new Decimal(amount || 0).minus(expectedAmount || 0);
    if (variance.abs().lessThanOrEqualTo(0.01))
      return ReconciliationStatus.MATCHED;
    if (variance.greaterThan(0)) return ReconciliationStatus.OVERPAID;
    if (amount > 0) return ReconciliationStatus.PARTIAL;
    return ReconciliationStatus.UNDERPAID;
  }

  /**
   * Tạo giao dịch thanh toán mới
   */
  async createTransaction(
    data: CreateTradeFinanceTransactionInput,
    user: User,
  ) {
    const { vendorInvoiceIds, ...rest } = data;
    const invoiceIds =
      vendorInvoiceIds && vendorInvoiceIds.length > 0
        ? vendorInvoiceIds
        : rest.vendorInvoiceId
          ? [rest.vendorInvoiceId]
          : [];

    if (invoiceIds.length > 0) {
      const invoices = await this.dataSource.getRepository(VendorInvoice).find({
        where: { _id: In(invoiceIds) },
      });

      if (invoices.length !== invoiceIds.length) {
        throw new BadRequestException(
          'Khong tim thay day du hoa don NCC can thanh toan',
        );
      }

      const invalidInvoice = invoices.find(
        (invoice) => invoice.status !== VendorInvoiceStatus.PENDING,
      );
      if (invalidInvoice) {
        throw new BadRequestException(
          `Hoa don ${invalidInvoice.invoiceNumber} khong o trang thai cho thanh toan`,
        );
      }

      const currencies = new Set(
        invoices.map((invoice) => invoice.currency || 'VND'),
      );
      if (currencies.size > 1) {
        throw new BadRequestException(
          'Khong the thanh toan nhieu hoa don khac tien te trong mot giao dich',
        );
      }

      const expectedAmount = invoices.reduce(
        (sum, invoice) => sum + Number(invoice.totalAmount),
        0,
      );
      if (Math.abs(Number(rest.amount) - expectedAmount) > 0.01) {
        throw new BadRequestException(
          'So tien thanh toan phai bang tong gia tri cac hoa don da chon',
        );
      }

      const payableRepository = this.dataSource.getRepository(AccountPayable);
      for (const invoice of invoices) {
        const payable = await payableRepository.findOne({
          where: [
            { vendorInvoiceId: invoice._id },
            {
              vendorId: invoice.vendorId,
              invoiceNumber: invoice.invoiceNumber,
            },
          ],
        });

        if (!payable) {
          throw new BadRequestException(
            `Hoa don ${invoice.invoiceNumber} chua co cong no AP`,
          );
        }

        if (!payable.isApprovedForPayment) {
          throw new BadRequestException(
            `Cong no AP cua hoa don ${invoice.invoiceNumber} chua duoc duyet thanh toan`,
          );
        }
      }

      rest.currency = invoices[0].currency || 'VND';
    }

    const expectedAmount = await this.getExpectedAmountForTransaction(rest);
    const reconciliationStatus = this.getReconciliationStatus(
      Number(rest.amount || 0),
      expectedAmount,
    );

    // Nếu có mảng hóa đơn, dùng ID đầu tiên làm tham chiếu chính (legacy support)
    // Nhưng chúng ta sẽ ưu tiên xử lý mảng ở bước updateStatus
    const transaction = this.transactionRepository.create({
      ...rest,
      vendorInvoiceId:
        vendorInvoiceIds && vendorInvoiceIds.length > 0
          ? vendorInvoiceIds[0]
          : rest.vendorInvoiceId,
      createdByUsername: user.username,
      status: TradeFinanceStatus.PENDING,
      expectedAmount: expectedAmount ?? undefined,
      varianceAmount:
        expectedAmount === null
          ? 0
          : new Decimal(rest.amount || 0).minus(expectedAmount).toNumber(),
      reconciliationStatus,
    });

    const saved = await this.transactionRepository.save(transaction);

    // Lưu tạm danh sách IDs vào một metadata hoặc quan hệ nếu cần
    // Ở đây để đơn giản ta sẽ dùng logic update hàng loạt dựa trên vendorInvoiceIds được truyền vào lúc updateStatus hoặc lưu ở Note
    if (vendorInvoiceIds && vendorInvoiceIds.length > 0) {
      saved.note = `Multi-payment for invoices: ${vendorInvoiceIds.join(', ')}. ${saved.note || ''}`;
      await this.transactionRepository.save(saved);
    }

    return saved;
  }

  /**
   * Cập nhật trạng thái giao dịch thanh toán
   */
  async updateTransactionStatus(
    id: string,
    status: TradeFinanceStatus,
    user: User,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await queryRunner.manager.findOne(
        TradeFinanceTransaction,
        {
          where: { _id: id },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!transaction) throw new BadRequestException('Transaction not found');

      // Load relations
      if (transaction.salesContractId) {
        const salesContract = await queryRunner.manager.findOne(SalesContract, {
          where: { _id: transaction.salesContractId },
          relations: ['buyer'],
        });
        if (salesContract) {
          transaction.salesContract = salesContract;
        }
      }

      // Trích xuất IDs từ Note nếu có (Legacy workaround for multi-invoice)
      let invoiceIds: string[] = [];
      if (
        transaction.note &&
        transaction.note.includes('Multi-payment for invoices:')
      ) {
        const match = transaction.note.match(
          /Multi-payment for invoices: ([^.]+)/,
        );
        if (match) {
          invoiceIds = match[1].split(', ').map((i) => i.trim());
        }
      } else if (transaction.vendorInvoiceId) {
        invoiceIds = [transaction.vendorInvoiceId];
      }

      if (invoiceIds.length > 0) {
        transaction['invoices'] = await queryRunner.manager.find(
          VendorInvoice,
          {
            where: { _id: In(invoiceIds) },
            relations: ['vendor'],
          },
        );
      }

      this.validateTransactionStatusTransition(transaction.status, status);

      transaction.status = status;
      if (
        status === TradeFinanceStatus.RECEIVED &&
        transaction.salesContractId
      ) {
        const expectedAmount =
          await this.getExpectedAmountForTransaction(transaction);
        transaction.expectedAmount =
          expectedAmount ?? transaction.expectedAmount;
        transaction.varianceAmount =
          expectedAmount === null
            ? 0
            : new Decimal(transaction.amount || 0)
                .minus(expectedAmount)
                .toNumber();
        transaction.reconciliationStatus = this.getReconciliationStatus(
          Number(transaction.amount || 0),
          expectedAmount,
        );
        transaction.reconciledByUsername = user.username;
        transaction.reconciledAt = new Date();
      } else if (status === TradeFinanceStatus.PAID && invoiceIds.length > 0) {
        transaction.reconciliationStatus = ReconciliationStatus.MATCHED;
        transaction.reconciledByUsername = user.username;
        transaction.reconciledAt = new Date();
      } else if (
        [TradeFinanceStatus.REJECTED, TradeFinanceStatus.CANCELLED].includes(
          status,
        )
      ) {
        transaction.reconciliationStatus = ReconciliationStatus.REJECTED;
      }
      const saved = await queryRunner.manager.save(transaction);

      // Nếu chuyển sang trạng thái đã nhận tiền/đã trả tiền -> Kích hoạt hạch toán
      if (
        status === TradeFinanceStatus.RECEIVED ||
        status === TradeFinanceStatus.PAID
      ) {
        await this.postAccountingForTransaction(saved, queryRunner.manager);

        // Cập nhật trạng thái tất cả hóa đơn liên quan
        if (invoiceIds.length > 0) {
          await queryRunner.manager.update(
            VendorInvoice,
            { _id: In(invoiceIds) },
            {
              status: VendorInvoiceStatus.PAID,
              paymentTransactionId: saved._id,
            },
          );
          const invoices = transaction['invoices'] as VendorInvoice[];
          for (const invoice of invoices) {
            const payable = await queryRunner.manager.findOne(AccountPayable, {
              where: [
                { vendorInvoiceId: invoice._id },
                {
                  vendorId: invoice.vendorId,
                  invoiceNumber: invoice.invoiceNumber,
                },
              ],
            });
            if (payable) {
              await queryRunner.manager.update(
                AccountPayable,
                { _id: payable._id },
                {
                  paidAmount: invoice.totalAmount,
                  status: APStatus.PAID,
                  paidByUsername: user.username,
                  paidAt: new Date(),
                },
              );
            }
          }
        }

        if (status === TradeFinanceStatus.RECEIVED && saved.salesContractId) {
          await this.accountReceivablesService.allocateFromTradeFinanceTransaction(
            saved,
            queryRunner.manager,
            user.username,
          );
        }
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

  private validateTransactionStatusTransition(
    current: TradeFinanceStatus,
    next: TradeFinanceStatus,
  ) {
    const transitions: Record<TradeFinanceStatus, TradeFinanceStatus[]> = {
      [TradeFinanceStatus.PENDING]: [
        TradeFinanceStatus.RECEIVED,
        TradeFinanceStatus.PAID,
        TradeFinanceStatus.REJECTED,
        TradeFinanceStatus.CANCELLED,
      ],
      [TradeFinanceStatus.RECEIVED]: [],
      [TradeFinanceStatus.ACCEPTED]: [
        TradeFinanceStatus.PAID,
        TradeFinanceStatus.REJECTED,
      ],
      [TradeFinanceStatus.PAID]: [],
      [TradeFinanceStatus.REJECTED]: [TradeFinanceStatus.PENDING],
      [TradeFinanceStatus.CANCELLED]: [],
    };
    if (!transitions[current].includes(next)) {
      throw new BadRequestException(
        `Giao dịch đã ${current}, không thể chuyển sang ${next}`,
      );
    }
  }

  private async postAccountingForTransaction(
    tx: TradeFinanceTransaction,
    manager: EntityManager,
  ) {
    const vndAmount = Number(tx.amount) * Number(tx.exchangeRate);
    const journalItems: {
      accountCode: string;
      debit: number;
      credit: number;
      partnerId?: string;
    }[] = [];
    let description = '';

    const invoices = tx['invoices'] as VendorInvoice[];

    if (invoices && invoices.length > 0) {
      // LUỒNG THANH TOÁN ĐA HÓA ĐƠN NCC: Nợ 331 (Nhiều dòng), Có 112 (Tổng)
      description = `Thanh toán ${invoices.length} hóa đơn NCC. Tổng: ${vndAmount.toLocaleString()} VND`;
      let totalActualVndValue = new Decimal(0);

      for (const inv of invoices) {
        // Tỷ giá ghi sổ (Lúc nhận hóa đơn)
        const bookVndValue =
          Number(inv.totalAmount) * Number(inv.exchangeRate || 1);
        // Tỷ giá thực tế (Lúc thanh toán)
        const actualVndValue =
          Number(inv.totalAmount) * Number(tx.exchangeRate);
        const exchangeDiff = new Decimal(actualVndValue).minus(bookVndValue);
        totalActualVndValue = totalActualVndValue.plus(actualVndValue);

        journalItems.push({
          accountCode: '331',
          debit: bookVndValue,
          credit: 0,
          partnerId: inv.vendorId,
        });

        // Balance FX gain/loss in the same AP payment journal.
        if (exchangeDiff.abs().greaterThan(1)) {
          if (exchangeDiff.greaterThan(0)) {
            journalItems.push({
              accountCode: '635',
              debit: exchangeDiff.abs().toNumber(),
              credit: 0,
            });
          } else {
            journalItems.push({
              accountCode: '515',
              debit: 0,
              credit: exchangeDiff.abs().toNumber(),
            });
          }
        }
      }

      journalItems.push({
        accountCode: '112',
        debit: 0,
        credit: totalActualVndValue.toNumber(),
      });
    } else if (tx.salesContractId) {
      // LUỒNG THU TIỀN XUẤT KHẨU: Nợ 112 (Tăng tiền), Có 131 (Giảm nợ khách hàng)
      description = `Ghi nhận thu tiền HĐ: ${tx.salesContract?.contractNumber}`;

      journalItems.push({
        accountCode: '112',
        debit: vndAmount,
        credit: 0,
      });
      journalItems.push({
        accountCode: '131',
        debit: 0,
        credit: vndAmount,
        partnerId: tx.salesContract?.buyerId,
      });
    }

    const journal = await this.accountingService.createJournalEntry(
      {
        description: description,
        referenceType: 'TRADE_FINANCE',
        referenceId: tx._id,
        entryDate: tx.transactionDate || new Date(),
        items: journalItems,
      },
      manager,
    );

    tx.journalEntryId = journal._id;
    await manager.save(tx);

    // Xử lý chênh lệch tỷ giá (Chỉ áp dụng cho Hợp đồng có tỷ giá gốc)
    if (tx.salesContractId && tx.salesContract) {
      const contractVndValue =
        Number(tx.amount) * Number(tx.salesContract.exchangeRate);
      if (Math.abs(vndAmount - contractVndValue) > 1) {
        await this.accountingService.processExchangeGainLoss(
          {
            originalVndValue: contractVndValue,
            actualVndValue: vndAmount,
            description: `Chênh lệch tỷ giá (${tx.type}): ${tx.salesContract.contractNumber}`,
            referenceType: 'TRADE_FINANCE',
            referenceId: tx._id,
            partnerId: tx.salesContract.buyerId,
          },
          manager,
        );
      }
    }
  }

  async findAllTransactions(query: QueryParams) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);

    const current = Number(query.current ?? 1) || 1;
    const pageSize = Number(query.pageSize ?? 10) || 10;
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    const skip = (current - 1) * pageSize;

    const [results, totalItems] = await this.transactionRepository.findAndCount(
      {
        where: filter,
        relations: [
          'salesContract',
          'salesContract.buyer',
          'vendorInvoice',
          'vendorInvoice.vendor',
          'createdBy',
        ],
        order: sort || { createdAt: 'DESC' },
        skip: skip,
        take: pageSize,
      },
    );

    return {
      results,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      current,
      pageSize,
    };
  }
}
