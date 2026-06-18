import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  Partner,
  PartnerType,
} from '@/modules/partners/entities/partner.entity';
import { CreateAccountPayableDto } from './dto/create-account-payable.dto';
import { UpdateAccountPayableDto } from './dto/update-account-payable.dto';
import { AccountPayable, APStatus } from './entities/account-payable.entity';
import {
  AccountPayablePaymentBatch,
  AccountPayablePaymentBatchItem,
  APPaymentBatchStatus,
} from './entities/account-payable-payment-batch.entity';
import {
  AccountPayableSettlementAudit,
  APSettlementAuditType,
} from './entities/account-payable-settlement-audit.entity';
import {
  CreatePaymentBatchDto,
  MarkPaymentBatchPaidDto,
  ReverseSettlementAuditDto,
  ReviewPaymentBatchDto,
  UpdatePaymentBatchDto,
} from './dto/create-payment-batch.dto';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { AccountingService } from '@/modules/accounting/accounting.service';
import {
  VendorInvoice,
  VendorInvoiceStatus,
} from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import { ApprovalMatrixService } from '@/modules/approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';

export interface AccountPayableListQuery {
  vendorId?: string;
  status?: APStatus;
  search?: string;
  current?: string | number;
  pageSize?: string | number;
}

export interface AccountPayableListResponse {
  results: AccountPayable[];
  totalItems: number;
  totalPages: number;
  current: number;
  pageSize: number;
}

@Injectable()
export class AccountPayablesService {
  private readonly secondApprovalThresholdVnd = 100_000_000;

  constructor(
    @InjectRepository(AccountPayable)
    private readonly accountPayableRepository: Repository<AccountPayable>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(AccountPayablePaymentBatch)
    private readonly paymentBatchRepository: Repository<AccountPayablePaymentBatch>,
    @InjectRepository(AccountPayableSettlementAudit)
    private readonly settlementAuditRepository: Repository<AccountPayableSettlementAudit>,
    private readonly dataSource: DataSource,
    private readonly accountingService: AccountingService,
    private readonly approvalMatrixService: ApprovalMatrixService,
  ) {}

  private async validateVendor(vendorId: string) {
    const vendor = await this.partnerRepository.findOneBy({ _id: vendorId });
    if (!vendor) throw new BadRequestException('Nhà cung cấp không tồn tại');
    if (vendor.partnerType !== PartnerType.SUPPLIER) {
      throw new BadRequestException('Đối tác không phải nhà cung cấp');
    }
  }

  private normalizeStatus(ap: AccountPayable) {
    if (ap.status === APStatus.VOID) {
      return APStatus.VOID;
    }
    if (Number(ap.paidAmount) < 0) {
      throw new BadRequestException('So tien da thanh toan khong duoc am');
    }
    if (Number(ap.paidAmount) > Number(ap.amount)) {
      throw new BadRequestException(
        'So tien da thanh toan khong duoc vuot qua cong no',
      );
    }
    if (ap.paidAmount <= 0) return APStatus.UNPAID;
    if (ap.paidAmount >= ap.amount) return APStatus.PAID;
    return APStatus.PARTIAL;
  }

  private getActorUsername(user?: { username?: string }) {
    return user?.username || 'system';
  }

  private createBatchNumber() {
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = createOpaqueCode('ap_batch_no')
      .split('_')
      .pop()
      ?.toUpperCase();
    return `APB-${dateKey}-${suffix}`;
  }

  private normalizeCurrency(value?: string | null) {
    return (value || 'VND').trim().toUpperCase();
  }

  private getExchangeRate(currency: string, exchangeRate?: number | null) {
    if (currency === 'VND') return 1;
    const rate = Number(exchangeRate || 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException(
        'Ty gia bat buoc khi tao/chi batch ngoai te',
      );
    }
    return rate;
  }

  private async findSettlementAudit(recordId: string) {
    const audit = await this.settlementAuditRepository.findOne({
      where: { _id: recordId },
      relations: [
        'accountPayable',
        'paymentBatch',
        'vendor',
        'reversedSettlementAudit',
      ],
    });
    if (!audit) throw new NotFoundException('Khong tim thay audit tat toan AP');
    return audit;
  }

  private isSecondApprovalRequired(batch: AccountPayablePaymentBatch) {
    return Number(batch.totalAmountVnd || 0) >= this.secondApprovalThresholdVnd;
  }

  async create(dto: CreateAccountPayableDto) {
    await this.validateVendor(dto.vendorId);
    if (dto.vendorInvoiceId) {
      throw new BadRequestException(
        'AP cho vendor invoice phai duoc tao tu flow 3-way matching, khong tao truc tiep',
      );
    }
    if (dto.status === APStatus.VOID) {
      throw new BadRequestException(
        'Khong duoc tao cong no AP o trang thai void',
      );
    }

    const entity = this.accountPayableRepository.create({
      ...dto,
      paidAmount: dto.paidAmount ?? 0,
      currency: dto.currency ?? 'VND',
      status: dto.status ?? APStatus.UNPAID,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });

    entity.status = this.normalizeStatus(entity);

    return this.accountPayableRepository.save(entity);
  }

  async findAll(
    query: AccountPayableListQuery = {},
  ): Promise<AccountPayableListResponse> {
    const rawCurrent = Number(query.current || 1);
    const rawPageSize = Number(query.pageSize || 10);
    const current = Number.isFinite(rawCurrent)
      ? Math.max(Math.trunc(rawCurrent), 1)
      : 1;
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(Math.max(Math.trunc(rawPageSize), 1), 100)
      : 10;
    const search = query.search?.trim();
    const status = query.status ? String(query.status) : undefined;
    if (status && !Object.values(APStatus).includes(status as APStatus)) {
      throw new BadRequestException('Trang thai cong no AP khong hop le');
    }

    const qb = this.accountPayableRepository
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.vendor', 'vendor');

    if (query.vendorId) {
      qb.andWhere('ap.vendorId = :vendorId', { vendorId: query.vendorId });
    }

    if (status) {
      qb.andWhere('ap.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(ap.invoiceNumber ILIKE :search OR ap._id ILIKE :search OR vendor.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('ap.updatedAt', 'DESC')
      .skip((current - 1) * pageSize)
      .take(pageSize);

    const [results, totalItems] = await qb.getManyAndCount();

    return {
      results,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      current,
      pageSize,
    };
  }

  async getDueSoon(days = 7) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);

    const payables = await this.accountPayableRepository
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.vendor', 'vendor')
      .where('ap.status NOT IN (:...closedStatuses)', {
        closedStatuses: [APStatus.PAID, APStatus.VOID],
      })
      .andWhere('ap.dueDate <= :horizon', { horizon })
      .orderBy('ap.dueDate', 'ASC')
      .addOrderBy('ap.updatedAt', 'DESC')
      .take(50)
      .getMany();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payables.map((item) => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      return {
        ...item,
        remainingAmount: Math.max(
          Number(item.amount || 0) - Number(item.paidAmount || 0),
          0,
        ),
        isOverdue: !!dueDate && dueDate.getTime() < today.getTime(),
        daysUntilDue: dueDate
          ? Math.ceil(
              (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            )
          : null,
      };
    });
  }

  async findOne(id: string) {
    const ap = await this.accountPayableRepository.findOne({
      where: { _id: id },
      relations: { vendor: true },
    });
    if (!ap) throw new NotFoundException('Không tìm thấy công nợ');
    return ap;
  }

  async update(id: string, dto: UpdateAccountPayableDto) {
    const ap = await this.findOne(id);
    if (ap.status === APStatus.VOID) {
      throw new BadRequestException('Cong no da void, khong duoc cap nhat');
    }

    const payload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (payload.status === APStatus.VOID) {
      throw new BadRequestException('Dung endpoint void de huy cong no AP');
    }

    if (payload.vendorId) {
      await this.validateVendor(payload.vendorId);
    }

    if (payload.dueDate) {
      payload.dueDate = new Date(payload.dueDate as any) as any;
    }

    const merged = { ...ap, ...payload } as AccountPayable;
    merged.status = this.normalizeStatus(merged);
    payload.status = merged.status;

    await this.accountPayableRepository.update({ _id: id }, payload);
    return this.findOne(id);
  }

  approveForPayment(
    _id: string,
    _user?: { username?: string },
    _note?: string,
  ): never {
    throw new BadRequestException(
      'Direct AP approval is disabled. Create and approve an AP payment batch instead.',
    );
  }

  recordPayment(
    _id: string,
    _amount: number,
    _user?: { username?: string },
    _note?: string,
  ): never {
    throw new BadRequestException(
      'Direct AP payment is disabled. Mark an approved AP payment batch as paid instead.',
    );
  }

  async voidPayable(id: string, reason: string, user?: { username?: string }) {
    const reasonText = reason?.trim();
    if (!reasonText || reasonText.length < 3) {
      throw new BadRequestException('Void reason is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const payable = await manager.findOne(AccountPayable, {
        where: { _id: id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payable) throw new NotFoundException('Khong tim thay cong no');
      if (payable.status === APStatus.VOID) {
        return payable;
      }
      if (
        Number(payable.paidAmount || 0) > 0 ||
        payable.status === APStatus.PAID
      ) {
        throw new BadRequestException(
          'Cong no da phat sinh thanh toan, phai dao thanh toan truoc khi void',
        );
      }

      const openBatchCount = await manager
        .createQueryBuilder(AccountPayablePaymentBatchItem, 'item')
        .innerJoin(
          AccountPayablePaymentBatch,
          'batch',
          'batch._id = item.batchId',
        )
        .where('item.accountPayableId = :id', { id })
        .andWhere('batch.status IN (:...openStatuses)', {
          openStatuses: [
            APPaymentBatchStatus.DRAFT,
            APPaymentBatchStatus.SUBMITTED,
            APPaymentBatchStatus.APPROVED_LEVEL_1,
            APPaymentBatchStatus.APPROVED,
          ],
        })
        .getCount();

      if (openBatchCount > 0) {
        throw new BadRequestException(
          'Cong no dang nam trong batch thanh toan, khong duoc void',
        );
      }

      const username = this.getActorUsername(user);
      const note = `${payable.note ? `${payable.note}\n` : ''}VOID AP by ${username}: ${reasonText}`;
      await manager.update(
        AccountPayable,
        { _id: payable._id },
        {
          status: APStatus.VOID,
          isApprovedForPayment: false,
          approvedByUsername: null,
          approvedAt: null,
          voidedAt: new Date(),
          voidedByUsername: username,
          voidReason: reasonText,
          note,
        },
      );

      if (payable.vendorInvoiceId) {
        await manager.update(
          VendorInvoice,
          { _id: payable.vendorInvoiceId },
          { status: VendorInvoiceStatus.CANCELLED },
        );
      }

      const voidedPayable = await manager.findOne(AccountPayable, {
        where: { _id: payable._id },
        relations: ['vendor'],
      });
      if (!voidedPayable)
        throw new NotFoundException('Khong tim thay cong no sau khi void');
      return voidedPayable;
    });
  }

  async findAllPaymentBatches(query: any = {}) {
    const qb = this.paymentBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.items', 'items')
      .leftJoinAndSelect('items.accountPayable', 'accountPayable')
      .leftJoinAndSelect('items.vendor', 'vendor')
      .orderBy('batch.updatedAt', 'DESC');

    if (query.status) {
      qb.andWhere('batch.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(batch.batchNumber ILIKE :search OR batch.bankReference ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    return qb.getMany();
  }

  async findPaymentBatch(recordId: string) {
    const batch = await this.paymentBatchRepository.findOne({
      where: { _id: recordId },
      relations: ['items', 'items.accountPayable', 'items.vendor'],
    });
    if (!batch)
      throw new NotFoundException('Khong tim thay batch thanh toan AP');
    return batch;
  }

  async findSettlementAudits(query: any = {}) {
    const qb = this.dataSource
      .getRepository(AccountPayableSettlementAudit)
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.accountPayable', 'accountPayable')
      .leftJoinAndSelect('audit.paymentBatch', 'paymentBatch')
      .leftJoinAndSelect('audit.vendor', 'vendor')
      .leftJoinAndSelect(
        'audit.reversedSettlementAudit',
        'reversedSettlementAudit',
      )
      .orderBy('audit.settlementDate', 'DESC')
      .addOrderBy('audit.createdAt', 'DESC');

    if (query.accountPayableId) {
      qb.andWhere('audit.accountPayableId = :accountPayableId', {
        accountPayableId: query.accountPayableId,
      });
    }

    if (query.paymentBatchId) {
      qb.andWhere('audit.paymentBatchId = :paymentBatchId', {
        paymentBatchId: query.paymentBatchId,
      });
    }

    if (query.auditType) {
      qb.andWhere('audit.auditType = :auditType', {
        auditType: query.auditType,
      });
    }

    if (query.vendorId) {
      qb.andWhere('audit.vendorId = :vendorId', { vendorId: query.vendorId });
    }

    if (query.search) {
      qb.andWhere(
        '(audit.invoiceNumber ILIKE :search OR audit.bankReference ILIKE :search OR paymentBatch.batchNumber ILIKE :search OR vendor.name ILIKE :search)',
        { search: `%${String(query.search).trim()}%` },
      );
    }

    qb.take(Math.min(Number(query.pageSize || 50), 200));

    return qb.getMany();
  }

  async reverseSettlementAudit(
    recordId: string,
    dto: ReverseSettlementAuditDto,
    user?: { username?: string },
  ) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const audit = await manager.findOne(AccountPayableSettlementAudit, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!audit)
        throw new NotFoundException('Khong tim thay audit tat toan AP');
      if (audit.auditType !== APSettlementAuditType.SETTLEMENT) {
        throw new BadRequestException('Chi duoc dao audit tat toan goc');
      }
      if (audit.reversedAt) {
        throw new BadRequestException(
          'Audit tat toan nay da duoc dao truoc do',
        );
      }

      const reversalAmount = new Decimal(audit.amount || 0).abs();
      if (reversalAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'So tien audit khong hop le de dao thanh toan',
        );
      }

      const amountVnd = reversalAmount.mul(audit.exchangeRate || 1);
      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.AP_PAYMENT_REVERSAL,
        amountVnd.toNumber(),
        audit.currency,
      );

      if (!matchingRule) {
        throw new BadRequestException(
          'Chua co approval rule cho AP payment reversal; khong duoc dao thanh toan truc tiep',
        );
      }

      const approvalRequest =
        await this.approvalMatrixService.createRequestInTransaction(
          manager,
          {
            ruleId: matchingRule._id,
            documentType: ApprovalDocumentType.AP_PAYMENT_REVERSAL,
            documentId: audit._id,
            documentNumber: audit.invoiceNumber || audit._id,
            title: `Approve AP payment reversal ${audit.invoiceNumber || audit._id}`,
            currency: audit.currency,
            amount: reversalAmount.toNumber(),
            amountVnd: amountVnd.toNumber(),
            metadata: {
              source: 'account_payables.settlement_audits.reverse',
              reason: dto.reason,
              reversalDate: dto.reversalDate || null,
              accountPayableId: audit.accountPayableId,
              paymentBatchId: audit.paymentBatchId,
              vendorId: audit.vendorId,
              vendorInvoiceId: audit.vendorInvoiceId,
              invoiceNumber: audit.invoiceNumber,
            },
          },
          user,
        );

      await manager.update(
        AccountPayableSettlementAudit,
        { _id: audit._id },
        { approvalWorkflowRequestId: approvalRequest?._id || null },
      );

      const requestedAudit = await manager.findOne(
        AccountPayableSettlementAudit,
        {
          where: { _id: audit._id },
          relations: [
            'accountPayable',
            'paymentBatch',
            'vendor',
            'reversedSettlementAudit',
          ],
        },
      );
      if (!requestedAudit)
        throw new NotFoundException('Khong tim thay audit tat toan AP');

      return {
        ...requestedAudit,
        approvalRequest,
        requestedByUsername: username,
      };
    });
  }

  private async applySettlementReversalInTransaction(
    manager: EntityManager,
    audit: AccountPayableSettlementAudit,
    dto: ReverseSettlementAuditDto,
    username: string,
    approvalWorkflowRequestId?: string | null,
  ) {
    const payable = await manager.findOne(AccountPayable, {
      where: { _id: audit.accountPayableId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payable)
      throw new NotFoundException('Cong no AP cua audit khong con ton tai');

    const reversalAmount = new Decimal(audit.amount || 0).abs();
    if (reversalAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'So tien audit khong hop le de dao thanh toan',
      );
    }

    const nextPaidAmount = new Decimal(payable.paidAmount || 0).minus(
      reversalAmount,
    );
    if (nextPaidAmount.lessThan(0)) {
      throw new BadRequestException(
        'So tien dao vuot qua so da thanh toan cua cong no',
      );
    }

    const nextPayable = {
      ...payable,
      paidAmount: nextPaidAmount.toNumber(),
    } as AccountPayable;
    const nextStatus = this.normalizeStatus(nextPayable);
    const reversalDate = dto.reversalDate
      ? new Date(dto.reversalDate)
      : new Date();
    const amountVnd = reversalAmount.mul(audit.exchangeRate || 1);

    const journal = await this.accountingService.createJournalEntry(
      {
        description: `Dao thanh toan AP ${audit.invoiceNumber || payable.invoiceNumber || payable._id}`,
        referenceType: 'AP_PAYMENT_REVERSAL',
        referenceId: audit._id,
        entryDate: reversalDate,
        createdByUsername: username,
        items: [
          {
            accountCode: '112',
            debit: amountVnd.toNumber(),
            credit: 0,
          },
          {
            accountCode: '331',
            debit: 0,
            credit: amountVnd.toNumber(),
            partnerId: audit.vendorId,
          },
        ],
      },
      manager,
    );

    await manager.update(
      AccountPayable,
      { _id: payable._id },
      {
        paidAmount: nextPaidAmount.toNumber(),
        status: nextStatus,
        paidAt: nextStatus === APStatus.PAID ? payable.paidAt : null,
        paidByUsername: nextPaidAmount.greaterThan(0)
          ? payable.paidByUsername
          : null,
      },
    );

    if (payable.vendorInvoiceId && nextStatus !== APStatus.PAID) {
      await manager.update(
        VendorInvoice,
        { _id: payable.vendorInvoiceId },
        { status: VendorInvoiceStatus.PENDING },
      );
    }

    const reversalAudit = await manager.save(
      manager.create(AccountPayableSettlementAudit, {
        auditType: APSettlementAuditType.REVERSAL,
        reversedSettlementAudit_id: audit._id,
        accountPayableId: audit.accountPayableId,
        paymentBatchId: audit.paymentBatchId,
        vendorId: audit.vendorId,
        vendorInvoiceId: audit.vendorInvoiceId,
        invoiceNumber: audit.invoiceNumber,
        settlementDate: reversalDate,
        amount: reversalAmount.negated().toNumber(),
        exchangeRate: Number(audit.exchangeRate || 1),
        amountVnd: amountVnd.negated().toNumber(),
        currency: audit.currency,
        paymentMethod: audit.paymentMethod,
        bankReference: audit.bankReference,
        bankProofFileId: audit.bankProofFileId,
        bankProofUrl: audit.bankProofUrl,
        settlementNote: `Dao thanh toan ${audit._id}: ${dto.reason}`,
        settledByUsername: username,
        reversalReason: dto.reason,
        reversalJournalEntry_id: journal._id,
      }),
    );

    await manager.update(
      AccountPayableSettlementAudit,
      { _id: audit._id },
      {
        reversedAt: reversalDate,
        reversedByUsername: username,
        reversalReason: dto.reason,
        approvalWorkflowRequestId:
          approvalWorkflowRequestId || audit.approvalWorkflowRequestId || null,
        reversalJournalEntry_id: journal._id,
      },
    );

    return manager.findOne(AccountPayableSettlementAudit, {
      where: { _id: reversalAudit._id },
      relations: [
        'accountPayable',
        'paymentBatch',
        'vendor',
        'reversedSettlementAudit',
      ],
    });
  }

  async completeSettlementReversalWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const audit = await manager.findOne(AccountPayableSettlementAudit, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!audit)
        throw new NotFoundException('Khong tim thay audit tat toan AP');
      if (audit.reversedAt) return audit;

      const reason =
        typeof metadata?.reason === 'string' && metadata.reason.trim()
          ? metadata.reason.trim()
          : 'Approved by approval matrix';
      const reversalDate =
        typeof metadata?.reversalDate === 'string'
          ? metadata.reversalDate
          : undefined;

      return this.applySettlementReversalInTransaction(
        manager,
        audit,
        { reason, reversalDate },
        username,
        requestId,
      );
    });
  }

  async rejectSettlementReversalWorkflow(recordId: string, requestId: string) {
    await this.settlementAuditRepository.update(
      { _id: recordId },
      { approvalWorkflowRequestId: requestId },
    );
    return this.findSettlementAudit(recordId);
  }

  async createPaymentBatch(
    dto: CreatePaymentBatchDto,
    user?: { username?: string },
  ) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const seen = new Set<string>();
      let currency: string | null = null;
      let totalAmount = new Decimal(0);
      const itemPayloads: Array<Partial<AccountPayablePaymentBatchItem>> = [];

      for (const item of dto.items) {
        if (seen.has(item.accountPayableId)) {
          throw new BadRequestException(
            'Mot cong no khong duoc lap lai trong cung batch',
          );
        }
        seen.add(item.accountPayableId);

        const payable = await manager.findOne(AccountPayable, {
          where: { _id: item.accountPayableId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!payable)
          throw new NotFoundException('Khong tim thay cong no trong batch');
        if (
          payable.status === APStatus.PAID ||
          payable.status === APStatus.VOID
        ) {
          throw new BadRequestException(
            `Cong no ${payable.invoiceNumber || payable._id} da dong/void`,
          );
        }

        const payableCurrency = this.normalizeCurrency(payable.currency);
        if (!currency) currency = payableCurrency;
        if (currency !== payableCurrency) {
          throw new BadRequestException(
            'Mot batch chi duoc gom cac cong no cung loai tien',
          );
        }

        const openAmount = new Decimal(payable.amount).minus(
          payable.paidAmount || 0,
        );
        const paymentAmount = new Decimal(item.amount);
        if (
          paymentAmount.lessThanOrEqualTo(0) ||
          paymentAmount.greaterThan(openAmount)
        ) {
          throw new BadRequestException(
            `So tien chi cho ${payable.invoiceNumber || payable._id} khong hop le`,
          );
        }

        totalAmount = totalAmount.plus(paymentAmount);
        itemPayloads.push({
          accountPayableId: payable._id,
          vendorId: payable.vendorId,
          vendorInvoiceId: payable.vendorInvoiceId,
          invoiceNumber: payable.invoiceNumber,
          amount: paymentAmount.toNumber(),
          currency: payableCurrency,
          note: item.note || null,
        });
      }

      const batchCurrency = currency || 'VND';
      const exchangeRate = this.getExchangeRate(
        batchCurrency,
        dto.exchangeRate,
      );
      const batch = manager.create(AccountPayablePaymentBatch, {
        batchNumber: this.createBatchNumber(),
        status: APPaymentBatchStatus.DRAFT,
        currency: batchCurrency,
        totalAmount: totalAmount.toNumber(),
        exchangeRate,
        totalAmountVnd: totalAmount.mul(exchangeRate).toNumber(),
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        paymentMethod: dto.paymentMethod || null,
        bankReference: dto.bankReference || null,
        createdByUsername: username,
        note: dto.note || null,
      });

      const savedBatch = await manager.save(batch);
      const batchItems = itemPayloads.map((payload) =>
        manager.create(AccountPayablePaymentBatchItem, {
          ...payload,
          batchId: savedBatch._id,
        }),
      );
      await manager.save(batchItems);

      return manager.findOne(AccountPayablePaymentBatch, {
        where: { _id: savedBatch._id },
        relations: ['items', 'items.accountPayable', 'items.vendor'],
      });
    });
  }

  async updatePaymentBatch(recordId: string, dto: UpdatePaymentBatchDto) {
    const batch = await this.findPaymentBatch(recordId);
    if (batch.status !== APPaymentBatchStatus.DRAFT) {
      throw new BadRequestException('Chi duoc sua batch o trang thai DRAFT');
    }

    const exchangeRate =
      dto.exchangeRate !== undefined
        ? this.getExchangeRate(
            this.normalizeCurrency(batch.currency),
            dto.exchangeRate,
          )
        : Number(batch.exchangeRate || 1);

    await this.paymentBatchRepository.update(
      { _id: recordId },
      {
        paymentDate: dto.paymentDate
          ? new Date(dto.paymentDate)
          : batch.paymentDate,
        paymentMethod:
          dto.paymentMethod !== undefined
            ? dto.paymentMethod || null
            : batch.paymentMethod,
        bankReference:
          dto.bankReference !== undefined
            ? dto.bankReference || null
            : batch.bankReference,
        note: dto.note !== undefined ? dto.note || null : batch.note,
        exchangeRate,
        totalAmountVnd: new Decimal(batch.totalAmount)
          .mul(exchangeRate)
          .toNumber(),
      },
    );

    return this.findPaymentBatch(recordId);
  }

  async submitPaymentBatch(recordId: string, user?: { username?: string }) {
    const batch = await this.findPaymentBatch(recordId);
    if (batch.status !== APPaymentBatchStatus.DRAFT) {
      throw new BadRequestException('Chi batch DRAFT moi duoc gui duyet');
    }

    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.AP_PAYMENT_BATCH,
      Number(batch.totalAmountVnd || 0),
      batch.currency,
    );

    if (!matchingRule) {
      throw new BadRequestException(
        'Chua co approval rule cho AP payment batch; khong duoc submit ngoai approval matrix',
      );
    }

    const approvalRequest = await this.approvalMatrixService.createRequest(
      {
        ruleId: matchingRule._id,
        documentType: ApprovalDocumentType.AP_PAYMENT_BATCH,
        documentId: batch._id,
        documentNumber: batch.batchNumber,
        title: `Approve AP payment batch ${batch.batchNumber}`,
        currency: batch.currency,
        amount: Number(batch.totalAmount || 0),
        amountVnd: Number(batch.totalAmountVnd || 0),
        metadata: {
          source: 'account_payables.payment_batches.submit',
          itemCount: batch.items?.length || 0,
        },
      },
      user,
    );

    await this.paymentBatchRepository.update(
      { _id: recordId },
      {
        status: APPaymentBatchStatus.SUBMITTED,
        submittedByUsername: this.getActorUsername(user),
        submittedAt: new Date(),
        approvalWorkflowRequestId: approvalRequest?._id || null,
        rejectionReason: null,
      },
    );

    return {
      ...(await this.findPaymentBatch(recordId)),
      approvalRequest,
    };
  }

  private async approveBatchPayables(
    batch: AccountPayablePaymentBatch,
    username: string,
  ) {
    for (const item of batch.items || []) {
      await this.accountPayableRepository.update(
        { _id: item.accountPayableId },
        {
          isApprovedForPayment: true,
          approvedByUsername: username,
          approvedAt: new Date(),
        },
      );
    }
  }

  async completePaymentBatchWorkflowApproval(
    recordId: string,
    username: string,
    note?: string | null,
  ) {
    const batch = await this.findPaymentBatch(recordId);
    if (
      ![
        APPaymentBatchStatus.SUBMITTED,
        APPaymentBatchStatus.APPROVED_LEVEL_1,
      ].includes(batch.status)
    ) {
      return batch;
    }

    await this.paymentBatchRepository.update(
      { _id: recordId },
      {
        status: APPaymentBatchStatus.APPROVED,
        finalApprovedByUsername: username,
        finalApprovedAt: new Date(),
        rejectionReason: null,
        note: note
          ? `${batch.note ? `${batch.note}\n` : ''}Approval matrix: ${note}`
          : batch.note,
      },
    );
    await this.approveBatchPayables(batch, username);

    return this.findPaymentBatch(recordId);
  }

  async rejectPaymentBatchWorkflow(
    recordId: string,
    username: string,
    reason?: string | null,
  ) {
    const batch = await this.findPaymentBatch(recordId);
    if (
      ![
        APPaymentBatchStatus.SUBMITTED,
        APPaymentBatchStatus.APPROVED_LEVEL_1,
      ].includes(batch.status)
    ) {
      return batch;
    }

    await this.paymentBatchRepository.update(
      { _id: recordId },
      {
        status: APPaymentBatchStatus.REJECTED,
        rejectedByUsername: username,
        rejectedAt: new Date(),
        rejectionReason: reason || 'Rejected by approval matrix',
      },
    );

    return this.findPaymentBatch(recordId);
  }

  async approvePaymentBatch(
    recordId: string,
    user?: { username?: string; role?: any },
    dto?: ReviewPaymentBatchDto,
  ) {
    void recordId;
    void user;
    void dto;
    throw new BadRequestException(
      'AP payment batch phai duoc duyet qua approval-matrix request',
    );
  }

  async rejectPaymentBatch(
    recordId: string,
    user?: { username?: string },
    dto?: ReviewPaymentBatchDto,
  ) {
    void recordId;
    void user;
    void dto;
    throw new BadRequestException(
      'AP payment batch phai duoc reject qua approval-matrix request',
    );
  }

  async markPaymentBatchPaid(
    recordId: string,
    dto: MarkPaymentBatchPaidDto,
    user?: { username?: string },
  ) {
    const username = this.getActorUsername(user);

    return this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOne(AccountPayablePaymentBatch, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch)
        throw new NotFoundException('Khong tim thay batch thanh toan AP');
      if (batch.status !== APPaymentBatchStatus.APPROVED) {
        throw new BadRequestException(
          'Batch phai duoc duyet truoc khi ghi chi',
        );
      }

      const exchangeRate =
        dto.exchangeRate !== undefined
          ? this.getExchangeRate(
              this.normalizeCurrency(batch.currency),
              dto.exchangeRate,
            )
          : Number(batch.exchangeRate || 1);
      const paymentDate = dto.paymentDate
        ? new Date(dto.paymentDate)
        : new Date();
      const bankTransferAt = dto.bankTransferAt
        ? new Date(dto.bankTransferAt)
        : paymentDate;
      const paymentMethod =
        dto.paymentMethod || batch.paymentMethod || 'BANK_TRANSFER';
      const bankReference = dto.bankReference || batch.bankReference || null;
      const bankProofFileId =
        dto.bankProofFileId || batch.bankProofFileId || null;
      const bankProofUrl = dto.bankProofUrl || batch.bankProofUrl || null;
      const settlementNote = dto.settlementNote || dto.note || null;
      let totalVnd = new Decimal(0);
      const journalItems: Array<{
        accountCode: string;
        debit: number;
        credit: number;
        partnerId?: string;
      }> = [];
      batch.items = await manager.find(AccountPayablePaymentBatchItem, {
        where: { batchId: batch._id },
      });

      for (const item of batch.items || []) {
        const payable = await manager.findOne(AccountPayable, {
          where: { _id: item.accountPayableId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!payable)
          throw new NotFoundException('Cong no trong batch khong con ton tai');

        const openAmount = new Decimal(payable.amount).minus(
          payable.paidAmount || 0,
        );
        const paymentAmount = new Decimal(item.amount);
        if (
          paymentAmount.lessThanOrEqualTo(0) ||
          paymentAmount.greaterThan(openAmount)
        ) {
          throw new BadRequestException(
            `Cong no ${payable.invoiceNumber || payable._id} da thay doi so du`,
          );
        }

        const paidAmount = new Decimal(payable.paidAmount || 0)
          .plus(paymentAmount)
          .toNumber();
        const merged = { ...payable, paidAmount } as AccountPayable;
        const status = this.normalizeStatus(merged);

        await manager.update(
          AccountPayable,
          { _id: payable._id },
          {
            paidAmount,
            status,
            isApprovedForPayment: true,
            approvedByUsername:
              payable.approvedByUsername ||
              batch.finalApprovedByUsername ||
              username,
            approvedAt:
              payable.approvedAt || batch.finalApprovedAt || new Date(),
            paidByUsername: username,
            paidAt: status === APStatus.PAID ? paymentDate : payable.paidAt,
          },
        );

        if (status === APStatus.PAID && payable.vendorInvoiceId) {
          await manager.update(
            VendorInvoice,
            { _id: payable.vendorInvoiceId },
            { status: VendorInvoiceStatus.PAID },
          );
        }

        const amountVnd = paymentAmount.mul(exchangeRate);
        totalVnd = totalVnd.plus(amountVnd);

        // Keep an immutable payment line so partial settlements remain traceable by invoice.
        await manager.save(
          manager.create(AccountPayableSettlementAudit, {
            auditType: APSettlementAuditType.SETTLEMENT,
            accountPayableId: payable._id,
            paymentBatchId: batch._id,
            vendorId: item.vendorId,
            vendorInvoiceId: item.vendorInvoiceId,
            invoiceNumber: item.invoiceNumber,
            settlementDate: bankTransferAt,
            amount: paymentAmount.toNumber(),
            exchangeRate,
            amountVnd: amountVnd.toNumber(),
            currency: item.currency,
            paymentMethod,
            bankReference,
            bankProofFileId,
            bankProofUrl,
            settlementNote,
            settledByUsername: username,
          }),
        );

        journalItems.push({
          accountCode: '331',
          debit: amountVnd.toNumber(),
          credit: 0,
          partnerId: item.vendorId,
        });
      }

      journalItems.push({
        accountCode: '112',
        debit: 0,
        credit: totalVnd.toNumber(),
      });

      const journal = await this.accountingService.createJournalEntry(
        {
          description: `Thanh toan AP batch ${batch.batchNumber}`,
          referenceType: 'AP_PAYMENT_BATCH',
          referenceId: batch._id,
          entryDate: paymentDate,
          createdByUsername: username,
          items: journalItems,
        },
        manager,
      );

      await manager.update(
        AccountPayablePaymentBatch,
        { _id: batch._id },
        {
          status: APPaymentBatchStatus.PAID,
          exchangeRate,
          totalAmountVnd: totalVnd.toNumber(),
          paymentDate,
          paymentMethod,
          bankReference,
          bankProofFileId,
          bankProofUrl,
          bankTransferAt,
          settlementNote,
          paidByUsername: username,
          paidAt: new Date(),
          paymentJournalEntryId: journal._id,
          note: dto.note
            ? `${batch.note ? `${batch.note}\n` : ''}Da chi: ${dto.note}`
            : batch.note,
        },
      );

      return manager.findOne(AccountPayablePaymentBatch, {
        where: { _id: batch._id },
        relations: ['items', 'items.accountPayable', 'items.vendor'],
      });
    });
  }
}
