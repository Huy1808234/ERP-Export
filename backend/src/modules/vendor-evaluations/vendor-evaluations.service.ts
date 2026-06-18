import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThanOrEqual, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  AccountPayable,
  APStatus,
} from '@/modules/account-payables/entities/account-payable.entity';
import { GoodsReceipt } from '@/modules/goods-receipts/entities/goods-receipt.entity';
import {
  Partner,
  PartnerType,
} from '@/modules/partners/entities/partner.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import {
  QCClaimStatus,
  QCResult,
  QualityCheck,
} from '@/modules/quality-control/entities/quality-check.entity';
import { CreateVendorEvaluationDto } from './dto/create-vendor-evaluation.dto';
import { UpdateVendorEvaluationDto } from './dto/update-vendor-evaluation.dto';
import {
  VendorEvaluation,
  VendorEvaluationStatus,
  VendorGrade,
} from './entities/vendor-evaluation.entity';

type VendorEvaluationPayloadSource =
  | CreateVendorEvaluationDto
  | UpdateVendorEvaluationDto
  | (Partial<VendorEvaluation> & {
      periodStart?: string | Date;
      periodEnd?: string | Date;
    });

@Injectable()
export class VendorEvaluationsService {
  constructor(
    @InjectRepository(VendorEvaluation)
    private readonly evaluationRepository: Repository<VendorEvaluation>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(AccountPayable)
    private readonly accountPayableRepository: Repository<AccountPayable>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepository: Repository<GoodsReceipt>,
    @InjectRepository(QualityCheck)
    private readonly qualityCheckRepository: Repository<QualityCheck>,
  ) {}

  private getActorUsername(user?: { username?: string }) {
    return user?.username || 'system';
  }

  private async validateVendor(vendorId: string) {
    const vendor = await this.partnerRepository.findOneBy({ _id: vendorId });
    if (!vendor) throw new BadRequestException('Nha cung cap khong ton tai');
    if (
      vendor.partnerType !== PartnerType.SUPPLIER &&
      vendor.partnerType !== PartnerType.LOGISTICS
    ) {
      throw new BadRequestException(
        'Doi tac khong phai nha cung cap/logistics',
      );
    }
    return vendor;
  }

  private calculateOverallScore(dto: Partial<VendorEvaluation>) {
    // Weighted score keeps the model stable and explainable for Purchasing/Accounting review.
    return Number(
      new Decimal(dto.qualityScore || 0)
        .mul(0.4)
        .plus(new Decimal(dto.deliveryScore || 0).mul(0.3))
        .plus(new Decimal(dto.priceScore || 0).mul(0.2))
        .plus(new Decimal(dto.communicationScore ?? 80).mul(0.1))
        .toFixed(2),
    );
  }

  private resolveGrade(score: number): VendorGrade {
    if (score >= 85) return VendorGrade.A;
    if (score >= 70) return VendorGrade.B;
    if (score >= 55) return VendorGrade.C;
    return VendorGrade.D;
  }

  private averageNumber<T>(items: T[], selector: (item: T) => any) {
    const values = items
      .map((item) => Number(selector(item) || 0))
      .filter((value) => Number.isFinite(value));

    if (!values.length) return 0;
    return Number(
      new Decimal(values.reduce((sum, value) => sum + value, 0))
        .div(values.length)
        .toFixed(2),
    );
  }

  private endOfBusinessDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private startOfMonth(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), 1);
  }

  private endOfMonth(value: Date) {
    return this.endOfBusinessDay(
      new Date(value.getFullYear(), value.getMonth() + 1, 0),
    );
  }

  private monthKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  private daysBetween(start: Date, end: Date) {
    const dayMs = 1000 * 60 * 60 * 24;
    return Math.ceil((end.getTime() - start.getTime()) / dayMs);
  }

  private toOptionalDate(value?: string | Date | null) {
    return value ? new Date(value) : undefined;
  }

  private resolveScorecardMonth(value?: string) {
    if (!value) return this.startOfMonth(new Date());
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException('Thang xem scorecard khong hop le');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) {
      throw new BadRequestException('Thang xem scorecard khong hop le');
    }

    return new Date(year, month - 1, 1);
  }

  private isWithinDateRange(
    value: string | Date | null | undefined,
    start: Date,
    end: Date,
  ) {
    if (!value) return false;
    const time = new Date(value).getTime();
    return time >= start.getTime() && time <= end.getTime();
  }

  private isOnOrBefore(value: string | Date | null | undefined, end: Date) {
    if (!value) return false;
    return new Date(value).getTime() <= end.getTime();
  }

  private async calculateOperationalVendorMetrics(vendorId: string) {
    const [purchaseOrderCount, receipts, claimCount, failedQcCount] =
      await Promise.all([
        this.purchaseOrderRepository.count({ where: { vendorId } }),
        this.goodsReceiptRepository
          .createQueryBuilder('receipt')
          .leftJoinAndSelect('receipt.purchaseOrder', 'purchaseOrder')
          .leftJoinAndSelect('receipt.items', 'items')
          .where('purchaseOrder.vendorId = :vendorId', { vendorId })
          .getMany(),
        this.qualityCheckRepository
          .createQueryBuilder('qc')
          .leftJoin('qc.purchaseOrder', 'purchaseOrder')
          .where('purchaseOrder.vendorId = :vendorId', { vendorId })
          .andWhere('(qc.claimStatus != :none OR qc.claimNumber IS NOT NULL)', {
            none: QCClaimStatus.NONE,
          })
          .getCount(),
        this.qualityCheckRepository
          .createQueryBuilder('qc')
          .leftJoin('qc.purchaseOrder', 'purchaseOrder')
          .where('purchaseOrder.vendorId = :vendorId', { vendorId })
          .andWhere('qc.result != :passed', { passed: QCResult.PASSED })
          .getCount(),
      ]);

    const receiptsWithDueDate = receipts.filter(
      (receipt) => receipt.purchaseOrder?.expectedDeliveryDate,
    );
    const onTimeReceiptCount = receiptsWithDueDate.filter((receipt) => {
      const expectedDate = receipt.purchaseOrder?.expectedDeliveryDate;
      if (!expectedDate) return false;
      return (
        new Date(receipt.receivedDate).getTime() <=
        this.endOfBusinessDay(expectedDate).getTime()
      );
    }).length;

    const receivedQuantity = receipts.reduce(
      (sum, receipt) =>
        sum.plus(
          (receipt.items || []).reduce(
            (lineSum, item) => lineSum + Number(item.quantityReceived || 0),
            0,
          ),
        ),
      new Decimal(0),
    );
    const rejectedQuantity = receipts.reduce(
      (sum, receipt) =>
        sum.plus(
          (receipt.items || []).reduce(
            (lineSum, item) => lineSum + Number(item.quantityRejected || 0),
            0,
          ),
        ),
      new Decimal(0),
    );
    const rejectedLineCount = receipts.reduce(
      (sum, receipt) =>
        sum +
        (receipt.items || []).filter(
          (item) =>
            Number(item.quantityRejected || 0) > 0 ||
            item.qualityStatus !== 'PASS',
        ).length,
      0,
    );

    return {
      purchaseOrderCount,
      receiptCount: receipts.length,
      receiptWithDueDateCount: receiptsWithDueDate.length,
      onTimeReceiptCount,
      onTimeDeliveryRate: receiptsWithDueDate.length
        ? Number(
            new Decimal(onTimeReceiptCount)
              .div(receiptsWithDueDate.length)
              .mul(100)
              .toFixed(2),
          )
        : null,
      receivedQuantity: receivedQuantity.toNumber(),
      rejectedQuantity: rejectedQuantity.toNumber(),
      defectRate: receivedQuantity.gt(0)
        ? Number(rejectedQuantity.div(receivedQuantity).mul(100).toFixed(2))
        : null,
      claimCount,
      rejectionCount: rejectedLineCount + failedQcCount,
    };
  }

  private buildPayload(dto: VendorEvaluationPayloadSource) {
    const payload: Partial<VendorEvaluation> = {
      vendorId: dto.vendorId,
      purchaseOrderId: dto.purchaseOrderId,
      goodsReceiptId: dto.goodsReceiptId,
      vendorInvoiceId: dto.vendorInvoiceId,
      periodStart: this.toOptionalDate(dto.periodStart),
      periodEnd: this.toOptionalDate(dto.periodEnd),
      qualityScore: dto.qualityScore,
      deliveryScore: dto.deliveryScore,
      priceScore: dto.priceScore,
      communicationScore: dto.communicationScore ?? 80,
      defectRate: dto.defectRate ?? 0,
      onTimeDeliveryRate: dto.onTimeDeliveryRate ?? 100,
      note: dto.note,
    };
    const overallScore = this.calculateOverallScore(payload);
    payload.overallScore = overallScore;
    payload.grade = this.resolveGrade(overallScore);
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as Partial<VendorEvaluation>;
  }

  async create(dto: CreateVendorEvaluationDto, user?: { username?: string }) {
    await this.validateVendor(dto.vendorId);
    const payload = this.buildPayload(dto);
    const evaluation = this.evaluationRepository.create({
      ...payload,
      evaluatedByUsername: this.getActorUsername(user),
      status: VendorEvaluationStatus.DRAFT,
    });
    return this.evaluationRepository.save(evaluation);
  }

  async findAll(query: Record<string, unknown> = {}) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 20);
    const vendorId = typeof query.vendorId === 'string' ? query.vendorId : '';
    const status = typeof query.status === 'string' ? query.status : '';
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const qb = this.evaluationRepository
      .createQueryBuilder('evaluation')
      .leftJoinAndSelect('evaluation.vendor', 'vendor')
      .leftJoinAndSelect('evaluation.evaluatedBy', 'evaluatedBy')
      .leftJoinAndSelect('evaluation.approvedBy', 'approvedBy')
      .orderBy('evaluation.updatedAt', 'DESC')
      .skip((current - 1) * pageSize)
      .take(pageSize);

    if (vendorId)
      qb.andWhere('evaluation.vendorId = :vendorId', {
        vendorId,
      });
    if (status) qb.andWhere('evaluation.status = :status', { status });
    if (search) {
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('vendor.name ILIKE :search', { search: `%${search}%` })
            .orWhere('evaluation.note ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    const [results, total] = await qb.getManyAndCount();
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

  async findOne(recordId: string) {
    const evaluation = await this.evaluationRepository.findOne({
      where: { _id: recordId },
      relations: ['vendor', 'evaluatedBy', 'approvedBy'],
    });
    if (!evaluation)
      throw new NotFoundException('Khong tim thay danh gia nha cung cap');
    return evaluation;
  }

  async update(recordId: string, dto: UpdateVendorEvaluationDto) {
    const evaluation = await this.findOne(recordId);
    if (evaluation.status === VendorEvaluationStatus.APPROVED) {
      throw new BadRequestException('Danh gia da duoc duyet, khong the sua');
    }
    if (dto.vendorId) await this.validateVendor(dto.vendorId);

    const payload = this.buildPayload({
      ...evaluation,
      ...dto,
    } as VendorEvaluationPayloadSource);
    await this.evaluationRepository.update({ _id: recordId }, payload);
    return this.findOne(recordId);
  }

  async submit(recordId: string, user?: { username?: string }) {
    const evaluation = await this.findOne(recordId);
    if (
      evaluation.status !== VendorEvaluationStatus.DRAFT &&
      evaluation.status !== VendorEvaluationStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Chi danh gia nhap/bi tu choi moi duoc gui duyet',
      );
    }

    await this.evaluationRepository.update(
      { _id: recordId },
      {
        status: VendorEvaluationStatus.SUBMITTED,
        submittedByUsername: this.getActorUsername(user),
      },
    );
    return this.findOne(recordId);
  }

  async approve(
    recordId: string,
    user?: { username?: string },
    approvalNote?: string,
  ) {
    const evaluation = await this.findOne(recordId);
    if (evaluation.status !== VendorEvaluationStatus.SUBMITTED) {
      throw new BadRequestException(
        'Chi danh gia da gui duyet moi duoc phe duyet',
      );
    }

    await this.evaluationRepository.update(
      { _id: recordId },
      {
        status: VendorEvaluationStatus.APPROVED,
        approvedByUsername: this.getActorUsername(user),
        approvedAt: new Date(),
        approvalNote,
      },
    );

    await this.syncVendorScore(evaluation.vendorId);
    return this.findOne(recordId);
  }

  async reject(
    recordId: string,
    user?: { username?: string },
    approvalNote?: string,
  ) {
    const evaluation = await this.findOne(recordId);
    if (evaluation.status !== VendorEvaluationStatus.SUBMITTED) {
      throw new BadRequestException(
        'Chi danh gia da gui duyet moi duoc tu choi',
      );
    }

    await this.evaluationRepository.update(
      { _id: recordId },
      {
        status: VendorEvaluationStatus.REJECTED,
        approvedByUsername: this.getActorUsername(user),
        approvedAt: new Date(),
        approvalNote,
      },
    );
    return this.findOne(recordId);
  }

  async getDashboard(days = 7) {
    const dueSoonPayables = await this.getDueSoonPayables(days);
    const [vendors, approvedEvaluations, submittedCount] = await Promise.all([
      this.partnerRepository.find({
        where: [
          { partnerType: PartnerType.SUPPLIER },
          { partnerType: PartnerType.LOGISTICS },
        ],
        order: { name: 'ASC' },
      }),
      this.evaluationRepository.find({
        where: { status: VendorEvaluationStatus.APPROVED },
        relations: ['vendor'],
        order: { periodEnd: 'DESC', approvedAt: 'DESC', updatedAt: 'DESC' },
      }),
      this.evaluationRepository.count({
        where: { status: VendorEvaluationStatus.SUBMITTED },
      }),
    ]);

    const evaluationsByVendor = new Map<string, VendorEvaluation[]>();
    for (const evaluation of approvedEvaluations) {
      const vendorEvaluations =
        evaluationsByVendor.get(evaluation.vendorId) || [];
      vendorEvaluations.push(evaluation);
      evaluationsByVendor.set(evaluation.vendorId, vendorEvaluations);
    }

    const scorecards = vendors.map((vendor) => {
      const vendorEvaluations = evaluationsByVendor.get(vendor._id) || [];
      const latest = vendorEvaluations[0];
      const previous = vendorEvaluations[1];
      const overallScore =
        vendor.vendorOverallScore ?? latest?.overallScore ?? null;
      const grade =
        (vendor.vendorGrade as VendorGrade | null) ?? latest?.grade ?? null;
      return {
        vendor,
        latestEvaluation: latest || null,
        overallScore,
        grade,
        qualityScore: latest?.qualityScore ?? vendor.qualityScore ?? null,
        deliveryScore: latest?.deliveryScore ?? vendor.deliveryScore ?? null,
        priceScore: latest?.priceScore ?? vendor.priceScore ?? null,
        onTimeDeliveryRate:
          vendor.vendorOnTimeDeliveryRate ?? latest?.onTimeDeliveryRate ?? null,
        defectRate: vendor.vendorDefectRate ?? latest?.defectRate ?? null,
        claimCount: vendor.vendorClaimCount ?? 0,
        rejectionCount: vendor.vendorRejectionCount ?? 0,
        lastEvaluationAt:
          vendor.vendorLastEvaluationAt ??
          latest?.approvedAt ??
          latest?.updatedAt ??
          null,
        scoreTrend:
          latest && previous
            ? Number(
                new Decimal(latest.overallScore || 0)
                  .minus(previous.overallScore || 0)
                  .toFixed(2),
              )
            : null,
      };
    });

    const evaluatedScorecards = scorecards.filter(
      (item) => item.overallScore !== null,
    );
    const avgScore = evaluatedScorecards.length
      ? Number(
          new Decimal(
            evaluatedScorecards.reduce(
              (sum, item) => sum + Number(item.overallScore || 0),
              0,
            ),
          )
            .div(evaluatedScorecards.length)
            .toFixed(2),
        )
      : 0;

    return {
      stats: {
        vendorCount: vendors.length,
        evaluatedVendors: evaluatedScorecards.length,
        submittedCount,
        avgScore,
        dueSoonCount: dueSoonPayables.filter((item) => !item.isOverdue).length,
        overdueCount: dueSoonPayables.filter((item) => item.isOverdue).length,
      },
      topVendors: evaluatedScorecards
        .sort((a, b) => Number(b.overallScore) - Number(a.overallScore))
        .slice(0, 5),
      lowScoreVendors: evaluatedScorecards
        .filter((item) => Number(item.overallScore) < 70)
        .slice(0, 10),
      dueSoonPayables,
      scorecards,
    };
  }

  async getDueSoonPayables(days = 7) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);

    const payables = await this.accountPayableRepository.find({
      where: {
        status: In([APStatus.UNPAID, APStatus.PARTIAL]),
        dueDate: LessThanOrEqual(horizon),
      },
      relations: ['vendor'],
      order: { dueDate: 'ASC', updatedAt: 'DESC' },
      take: 50,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payables.map((item) => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      const remainingAmount = Math.max(
        Number(item.amount || 0) - Number(item.paidAmount || 0),
        0,
      );
      return {
        ...item,
        remainingAmount,
        isOverdue: !!dueDate && dueDate.getTime() < today.getTime(),
        daysUntilDue: dueDate
          ? Math.ceil(
              (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            )
          : null,
      };
    });
  }

  async getVendorScorecardDetail(vendorId: string, months = 6, month?: string) {
    const vendor = await this.validateVendor(vendorId);
    const anchorMonth = this.resolveScorecardMonth(month);
    const selectedMonthStart = this.startOfMonth(anchorMonth);
    const selectedMonthEnd = this.endOfMonth(anchorMonth);
    const trendStart = this.startOfMonth(
      new Date(
        anchorMonth.getFullYear(),
        anchorMonth.getMonth() - Math.max(months - 1, 0),
        1,
      ),
    );
    const currentDate = new Date();
    const referenceDate =
      selectedMonthEnd.getTime() < currentDate.getTime()
        ? selectedMonthEnd
        : currentDate;

    const [evaluations, receipts, purchaseOrders, qualityClaims, payables] =
      await Promise.all([
        this.evaluationRepository.find({
          where: { vendorId, status: VendorEvaluationStatus.APPROVED },
          order: { periodEnd: 'ASC', approvedAt: 'ASC', updatedAt: 'ASC' },
        }),
        this.goodsReceiptRepository
          .createQueryBuilder('receipt')
          .leftJoinAndSelect('receipt.purchaseOrder', 'purchaseOrder')
          .leftJoinAndSelect('receipt.items', 'items')
          .where('purchaseOrder.vendorId = :vendorId', { vendorId })
          .orderBy('receipt.receivedDate', 'DESC')
          .addOrderBy('receipt.updatedAt', 'DESC')
          .take(100)
          .getMany(),
        this.purchaseOrderRepository.find({
          where: { vendorId },
          relations: ['items', 'items.product'],
          order: { expectedDeliveryDate: 'DESC', updatedAt: 'DESC' },
          take: 100,
        }),
        this.qualityCheckRepository
          .createQueryBuilder('qc')
          .leftJoinAndSelect('qc.product', 'product')
          .leftJoinAndSelect('qc.purchaseOrder', 'purchaseOrder')
          .leftJoinAndSelect('qc.goodsReceipt', 'goodsReceipt')
          .leftJoinAndSelect('qc.purchaseReturn', 'purchaseReturn')
          .where('purchaseOrder.vendorId = :vendorId', { vendorId })
          .andWhere(
            '(qc.result != :passed OR qc.claimStatus != :none OR qc.claimNumber IS NOT NULL)',
            {
              passed: QCResult.PASSED,
              none: QCClaimStatus.NONE,
            },
          )
          .orderBy('qc.createdAt', 'DESC')
          .take(100)
          .getMany(),
        this.accountPayableRepository.find({
          where: { vendorId, status: In([APStatus.UNPAID, APStatus.PARTIAL]) },
          order: { dueDate: 'ASC', updatedAt: 'DESC' },
          take: 50,
        }),
      ]);

    const trendBuckets = new Map<
      string,
      {
        month: string;
        qualityScore: number;
        deliveryScore: number;
        priceScore: number;
        onTimeDeliveryRate: number;
        defectRate: number;
        overallScore: number;
        count: number;
      }
    >();

    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(
        anchorMonth.getFullYear(),
        anchorMonth.getMonth() - i,
        1,
      );
      const key = this.monthKey(date);
      trendBuckets.set(key, {
        month: key,
        qualityScore: 0,
        deliveryScore: 0,
        priceScore: 0,
        onTimeDeliveryRate: 0,
        defectRate: 0,
        overallScore: 0,
        count: 0,
      });
    }

    for (const evaluation of evaluations) {
      const basisDate =
        evaluation.periodEnd || evaluation.approvedAt || evaluation.updatedAt;
      if (
        !basisDate ||
        new Date(basisDate).getTime() < trendStart.getTime() ||
        new Date(basisDate).getTime() > selectedMonthEnd.getTime()
      ) {
        continue;
      }
      const key = this.monthKey(new Date(basisDate));
      const bucket = trendBuckets.get(key);
      if (!bucket) continue;

      bucket.qualityScore += Number(evaluation.qualityScore || 0);
      bucket.deliveryScore += Number(evaluation.deliveryScore || 0);
      bucket.priceScore += Number(evaluation.priceScore || 0);
      bucket.onTimeDeliveryRate += Number(evaluation.onTimeDeliveryRate || 0);
      bucket.defectRate += Number(evaluation.defectRate || 0);
      bucket.overallScore += Number(evaluation.overallScore || 0);
      bucket.count += 1;
    }

    const evaluationTrend = Array.from(trendBuckets.values()).map((bucket) => ({
      month: bucket.month,
      qualityScore: bucket.count
        ? Number(new Decimal(bucket.qualityScore).div(bucket.count).toFixed(2))
        : null,
      deliveryScore: bucket.count
        ? Number(new Decimal(bucket.deliveryScore).div(bucket.count).toFixed(2))
        : null,
      priceScore: bucket.count
        ? Number(new Decimal(bucket.priceScore).div(bucket.count).toFixed(2))
        : null,
      onTimeDeliveryRate: bucket.count
        ? Number(
            new Decimal(bucket.onTimeDeliveryRate).div(bucket.count).toFixed(2),
          )
        : null,
      defectRate: bucket.count
        ? Number(new Decimal(bucket.defectRate).div(bucket.count).toFixed(2))
        : null,
      overallScore: bucket.count
        ? Number(new Decimal(bucket.overallScore).div(bucket.count).toFixed(2))
        : null,
      evaluationCount: bucket.count,
    }));

    const claimsInMonth = qualityClaims.filter((claim) => {
      const basisDate = claim.claimSentAt || claim.createdAt;
      return this.isWithinDateRange(
        basisDate,
        selectedMonthStart,
        selectedMonthEnd,
      );
    });

    const qualityIssuesByReceipt = new Map<string, number>();
    const qualityIssuesByPo = new Map<string, number>();
    for (const claim of claimsInMonth) {
      if (claim.goodsReceiptId) {
        qualityIssuesByReceipt.set(
          claim.goodsReceiptId,
          (qualityIssuesByReceipt.get(claim.goodsReceiptId) || 0) + 1,
        );
      }
      if (claim.purchaseOrderId) {
        qualityIssuesByPo.set(
          claim.purchaseOrderId,
          (qualityIssuesByPo.get(claim.purchaseOrderId) || 0) + 1,
        );
      }
    }

    const receiptPoIdsAsOfMonth = new Set(
      receipts
        .filter((receipt) =>
          this.isOnOrBefore(receipt.receivedDate, selectedMonthEnd),
        )
        .map((receipt) => receipt.purchaseOrderId)
        .filter(Boolean),
    );
    const receiptRows = receipts
      .filter((receipt) =>
        this.isWithinDateRange(
          receipt.receivedDate,
          selectedMonthStart,
          selectedMonthEnd,
        ),
      )
      .map((receipt) => {
        const expectedDate =
          receipt.purchaseOrder?.expectedDeliveryDate || null;
        const receivedDate = receipt.receivedDate
          ? new Date(receipt.receivedDate)
          : null;
        const isOnTime =
          expectedDate && receivedDate
            ? receivedDate.getTime() <=
              this.endOfBusinessDay(expectedDate).getTime()
            : null;
        const daysLate =
          expectedDate && receivedDate
            ? Math.max(
                this.daysBetween(
                  this.endOfBusinessDay(expectedDate),
                  receivedDate,
                ),
                0,
              )
            : 0;
        const receivedQuantity = (receipt.items || []).reduce(
          (sum, item) => sum + Number(item.quantityReceived || 0),
          0,
        );
        const rejectedQuantity = (receipt.items || []).reduce(
          (sum, item) => sum + Number(item.quantityRejected || 0),
          0,
        );

        return {
          _id: receipt._id,
          type: 'GRN',
          purchaseOrderId: receipt.purchaseOrderId,
          poNumber: receipt.purchaseOrder?.poNumber || null,
          grNumber: receipt.grNumber,
          expectedDeliveryDate: expectedDate,
          receivedDate,
          isOnTime,
          daysLate,
          receivedQuantity,
          rejectedQuantity,
          qualityIssueCount:
            qualityIssuesByReceipt.get(receipt._id) ||
            qualityIssuesByPo.get(receipt.purchaseOrderId || '') ||
            0,
          status: receipt.status,
        };
      });

    const pendingPoRows = purchaseOrders
      .filter(
        (po) =>
          !receiptPoIdsAsOfMonth.has(po._id) &&
          this.isWithinDateRange(
            po.expectedDeliveryDate,
            selectedMonthStart,
            selectedMonthEnd,
          ),
      )
      .map((po) => {
        const expectedDate = po.expectedDeliveryDate
          ? new Date(po.expectedDeliveryDate)
          : null;
        const isLate = expectedDate
          ? this.endOfBusinessDay(expectedDate).getTime() <
            referenceDate.getTime()
          : false;
        return {
          _id: po._id,
          type: 'PO',
          purchaseOrderId: po._id,
          poNumber: po.poNumber,
          grNumber: null,
          expectedDeliveryDate: expectedDate,
          receivedDate: null,
          isOnTime: expectedDate ? !isLate : null,
          daysLate:
            isLate && expectedDate
              ? Math.max(
                  this.daysBetween(
                    this.endOfBusinessDay(expectedDate),
                    referenceDate,
                  ),
                  0,
                )
              : 0,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          qualityIssueCount: qualityIssuesByPo.get(po._id) || 0,
          status: po.status,
        };
      });

    const poGrnPerformance = [...receiptRows, ...pendingPoRows]
      .sort((a, b) => {
        const aDate = a.receivedDate || a.expectedDeliveryDate || new Date(0);
        const bDate = b.receivedDate || b.expectedDeliveryDate || new Date(0);
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 80);

    const measurablePoGrnRows = poGrnPerformance.filter(
      (row) => row.isOnTime !== null,
    );
    const onTimeCount = measurablePoGrnRows.filter(
      (row) => row.isOnTime,
    ).length;
    const onTimeRate = measurablePoGrnRows.length
      ? Number(
          new Decimal(onTimeCount)
            .div(measurablePoGrnRows.length)
            .mul(100)
            .toFixed(2),
        )
      : null;

    const claimAging = {
      open: 0,
      sent: 0,
      resolved: 0,
      cancelled: 0,
      oldestOpenAgeDays: null as number | null,
      buckets: {
        days0To7: 0,
        days8To14: 0,
        days15To30: 0,
        over30: 0,
      },
    };

    const claimItems = claimsInMonth.map((claim) => {
      const basisDate = claim.claimSentAt || claim.createdAt;
      const ageDays = basisDate
        ? Math.max(this.daysBetween(new Date(basisDate), referenceDate), 0)
        : 0;
      const isOpenClaim = [QCClaimStatus.OPEN, QCClaimStatus.SENT].includes(
        claim.claimStatus,
      );

      if (claim.claimStatus === QCClaimStatus.OPEN) claimAging.open += 1;
      if (claim.claimStatus === QCClaimStatus.SENT) claimAging.sent += 1;
      if (claim.claimStatus === QCClaimStatus.RESOLVED)
        claimAging.resolved += 1;
      if (claim.claimStatus === QCClaimStatus.CANCELLED)
        claimAging.cancelled += 1;

      if (isOpenClaim) {
        claimAging.oldestOpenAgeDays = Math.max(
          claimAging.oldestOpenAgeDays ?? 0,
          ageDays,
        );
        if (ageDays <= 7) claimAging.buckets.days0To7 += 1;
        else if (ageDays <= 14) claimAging.buckets.days8To14 += 1;
        else if (ageDays <= 30) claimAging.buckets.days15To30 += 1;
        else claimAging.buckets.over30 += 1;
      }

      return {
        _id: claim._id,
        checkNumber: claim.checkNumber,
        claimNumber: claim.claimNumber,
        claimStatus: claim.claimStatus,
        result: claim.result,
        productId: claim.productId,
        productName:
          claim.product?.vietnameseName ||
          claim.product?.englishName ||
          claim.product?.sku ||
          null,
        poNumber: claim.purchaseOrder?.poNumber || null,
        grNumber: claim.goodsReceipt?.grNumber || null,
        rejectedQuantity: Number(claim.rejectedQuantity || 0),
        quarantineQuantity: Number(claim.quarantineQuantity || 0),
        backorderQuantity: Number(claim.backorderQuantity || 0),
        creditAmount: Number(claim.creditAmount || 0),
        ageDays,
        createdAt: claim.createdAt,
        claimSentAt: claim.claimSentAt,
        resolvedAt: claim.resolvedAt,
        resolutionType: claim.resolutionType,
        replacementDueDate: claim.replacementDueDate,
      };
    });

    const payablesInMonth = payables.filter((item) =>
      this.isWithinDateRange(
        item.dueDate,
        selectedMonthStart,
        selectedMonthEnd,
      ),
    );

    const payableSummary = payablesInMonth.reduce(
      (acc, item) => {
        const remainingAmount = Math.max(
          Number(item.amount || 0) - Number(item.paidAmount || 0),
          0,
        );
        const dueDate = item.dueDate ? new Date(item.dueDate) : null;
        acc.remainingAmount += remainingAmount;
        if (dueDate && dueDate.getTime() < referenceDate.getTime())
          acc.overdueCount += 1;
        return acc;
      },
      { remainingAmount: 0, overdueCount: 0 },
    );

    const evaluationsAsOfMonth = evaluations.filter((evaluation) => {
      const basisDate =
        evaluation.periodEnd || evaluation.approvedAt || evaluation.updatedAt;
      return this.isOnOrBefore(basisDate, selectedMonthEnd);
    });
    const latestEvaluation = evaluationsAsOfMonth.at(-1) || null;
    const previousEvaluation = evaluationsAsOfMonth.at(-2) || null;
    const scoreTrend =
      latestEvaluation && previousEvaluation
        ? Number(
            new Decimal(latestEvaluation.overallScore || 0)
              .minus(previousEvaluation.overallScore || 0)
              .toFixed(2),
          )
        : null;

    return {
      vendor,
      summary: {
        evaluationCount: evaluationsAsOfMonth.length,
        latestScore:
          latestEvaluation?.overallScore ?? vendor.vendorOverallScore ?? null,
        latestGrade: latestEvaluation?.grade ?? vendor.vendorGrade ?? null,
        scoreTrend,
        onTimeRate,
        measurablePoGrnCount: measurablePoGrnRows.length,
        onTimeCount,
        delayedCount: measurablePoGrnRows.length - onTimeCount,
        claimCount: claimItems.length,
        openClaimCount: claimAging.open + claimAging.sent,
        oldestOpenClaimAgeDays: claimAging.oldestOpenAgeDays,
        payableRemainingAmount: Number(
          new Decimal(payableSummary.remainingAmount).toFixed(2),
        ),
        overduePayableCount: payableSummary.overdueCount,
      },
      evaluationTrend,
      poGrnPerformance,
      claimAging,
      claimItems,
      payables: payablesInMonth.map((item) => ({
        ...item,
        remainingAmount: Math.max(
          Number(item.amount || 0) - Number(item.paidAmount || 0),
          0,
        ),
      })),
    };
  }

  private async syncVendorScore(vendorId: string) {
    const evaluations = await this.evaluationRepository.find({
      where: { vendorId, status: VendorEvaluationStatus.APPROVED },
      order: { approvedAt: 'DESC', updatedAt: 'DESC' },
    });
    const operational = await this.calculateOperationalVendorMetrics(vendorId);
    const updatePayload: Partial<Partner> = {
      vendorOnTimeDeliveryRate: operational.onTimeDeliveryRate ?? null,
      vendorDefectRate: operational.defectRate ?? null,
      vendorClaimCount: operational.claimCount,
      vendorRejectionCount: operational.rejectionCount,
      vendorScoreUpdatedAt: new Date(),
    };

    if (evaluations.length) {
      const overallScore = this.averageNumber(
        evaluations,
        (item) => item.overallScore,
      );
      updatePayload.qualityScore = this.averageNumber(
        evaluations,
        (item) => item.qualityScore,
      );
      updatePayload.deliveryScore = this.averageNumber(
        evaluations,
        (item) => item.deliveryScore,
      );
      updatePayload.priceScore = this.averageNumber(
        evaluations,
        (item) => item.priceScore,
      );
      updatePayload.vendorOverallScore = overallScore;
      updatePayload.vendorGrade = this.resolveGrade(overallScore);
      updatePayload.vendorOnTimeDeliveryRate =
        operational.onTimeDeliveryRate ??
        this.averageNumber(evaluations, (item) => item.onTimeDeliveryRate);
      updatePayload.vendorDefectRate =
        operational.defectRate ??
        this.averageNumber(evaluations, (item) => item.defectRate);
      updatePayload.vendorLastEvaluationAt =
        evaluations[0].approvedAt || evaluations[0].updatedAt || new Date();
    }

    await this.partnerRepository.update({ _id: vendorId }, updatePayload);
  }
}
