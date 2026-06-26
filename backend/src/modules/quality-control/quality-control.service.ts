import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import {
  QCClaimStatus,
  QCExceptionStatus,
  QCResult,
  QCResolutionType,
  QualityCheck,
} from './entities/quality-check.entity';
import { CreateQualityCheckDto } from './dto/create-quality-check.dto';
import { CloseQualityExceptionDto } from './dto/close-quality-exception.dto';
import {
  ResolveQualityExceptionDto,
  SendQualityClaimDto,
} from './dto/quality-claim-action.dto';
import { GoodsReceipt } from '../goods-receipts/entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../goods-receipts/entities/goods-receipt-item.entity';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import { Partner } from '../partners/entities/partner.entity';
import {
  PurchaseReturn,
  PurchaseReturnItem,
  PurchaseReturnStatus,
} from '../purchase-returns/entities/purchase-return.entity';
import type { IUser } from '../users/users.interface';

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dateKey = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

type P2PExceptionCandidateSource = 'GRN_REJECTED_LINE' | 'PO_SHORT_RECEIPT';

type ExceptionCandidateProduct = {
  _id: string;
  sku: string | null;
  vietnameseName: string | null;
  englishName: string | null;
};

type P2PExceptionCandidate = {
  _id: string;
  sourceType: P2PExceptionCandidateSource;
  sourceNumber: string;
  goodsReceiptItem_id: string | null;
  goodsReceipt_id: string | null;
  purchaseOrderItem_id: string | null;
  purchaseOrder_id: string | null;
  product_id: string;
  vendor_id: string | null;
  vendorName: string | null;
  poNumber: string | null;
  grNumber: string | null;
  product: ExceptionCandidateProduct | null;
  quantityOrdered: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  backorderQuantity: number;
  exceptionQuantity: number;
  unit: string | null;
  qualityStatus: string | null;
  reason: string | null;
  createdAt: string;
  canCreateQc: boolean;
  existingQualityCheck_id: string | null;
};

@Injectable()
export class QualityControlService {
  constructor(
    @InjectRepository(QualityCheck)
    private qcRepository: Repository<QualityCheck>,
    private dataSource: DataSource,
  ) {}

  private toCandidateProduct(
    product?: GoodsReceiptItem['product'] | PurchaseOrderItem['product'] | null,
  ): ExceptionCandidateProduct | null {
    if (!product) return null;
    return {
      _id: product._id,
      sku: product.sku ?? null,
      vietnameseName: product.vietnameseName ?? null,
      englishName: product.englishName ?? null,
    };
  }

  private makePoProductKey(
    purchaseOrder_id?: string | null,
    product_id?: string | null,
  ): string {
    return `${purchaseOrder_id || 'NO_PO'}:${product_id || 'NO_PRODUCT'}`;
  }

  private getActiveQualityCheckMaps(rows: QualityCheck[]): {
    byGoodsReceiptItem: Map<string, string>;
    byPoProduct: Map<string, string>;
  } {
    const activeRows = rows.filter(
      (row) =>
        row.exceptionStatus !== QCExceptionStatus.CLOSED &&
        ![QCClaimStatus.RESOLVED, QCClaimStatus.CANCELLED].includes(
          row.claimStatus,
        ),
    );

    return {
      byGoodsReceiptItem: new Map(
        activeRows
          .filter((row) => row.goodsReceiptItemId)
          .map((row) => [row.goodsReceiptItemId as string, row._id]),
      ),
      byPoProduct: new Map(
        activeRows
          .filter((row) => row.purchaseOrderId && row.productId)
          .map((row) => [
            this.makePoProductKey(row.purchaseOrderId, row.productId),
            row._id,
          ]),
      ),
    };
  }

  private resolveVendorGrade(score: number) {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    return 'D';
  }

  private async getPurchaseOrderVendorId(
    manager: any,
    purchaseOrderId?: string | null,
  ) {
    if (!purchaseOrderId) return null;
    const po = await manager.findOne(PurchaseOrder, {
      where: { _id: purchaseOrderId },
    });
    return po?.vendorId || null;
  }

  private async syncVendorOperationalScore(
    manager: any,
    vendorId?: string | null,
  ) {
    if (!vendorId) return;

    const [receipts, claimCount, failedQcCount] = await Promise.all([
      manager
        .getRepository(GoodsReceipt)
        .createQueryBuilder('receipt')
        .leftJoinAndSelect('receipt.purchaseOrder', 'purchaseOrder')
        .leftJoinAndSelect('receipt.items', 'items')
        .where('purchaseOrder.vendorId = :vendorId', { vendorId })
        .getMany(),
      manager
        .getRepository(QualityCheck)
        .createQueryBuilder('qc')
        .leftJoin('qc.purchaseOrder', 'purchaseOrder')
        .where('purchaseOrder.vendorId = :vendorId', { vendorId })
        .andWhere('(qc.claimStatus != :none OR qc.claimNumber IS NOT NULL)', {
          none: QCClaimStatus.NONE,
        })
        .getCount(),
      manager
        .getRepository(QualityCheck)
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
      const due = new Date(expectedDate);
      due.setHours(23, 59, 59, 999);
      return new Date(receipt.receivedDate).getTime() <= due.getTime();
    }).length;

    const receivedQuantity = receipts.reduce(
      (sum, receipt) =>
        sum +
        (receipt.items || []).reduce(
          (lineSum, item) => lineSum + toNumber(item.quantityReceived),
          0,
        ),
      0,
    );
    const rejectedQuantity = receipts.reduce(
      (sum, receipt) =>
        sum +
        (receipt.items || []).reduce(
          (lineSum, item) => lineSum + toNumber(item.quantityRejected),
          0,
        ),
      0,
    );
    const rejectedLineCount = receipts.reduce(
      (sum, receipt) =>
        sum +
        (receipt.items || []).filter(
          (item) =>
            toNumber(item.quantityRejected) > 0 ||
            item.qualityStatus !== 'PASS',
        ).length,
      0,
    );

    const onTimeDeliveryRate = receiptsWithDueDate.length
      ? Number(
          ((onTimeReceiptCount / receiptsWithDueDate.length) * 100).toFixed(2),
        )
      : null;
    const defectRate =
      receivedQuantity > 0
        ? Number(((rejectedQuantity / receivedQuantity) * 100).toFixed(2))
        : null;
    const qualityScore = Math.max(
      0,
      Number((100 - (defectRate || 0) * 2 - claimCount * 3).toFixed(2)),
    );
    const deliveryScore = onTimeDeliveryRate ?? 80;
    const existing = await manager.findOne(Partner, {
      where: { _id: vendorId },
    });
    const priceScore = toNumber(existing?.priceScore, 80);
    const overallScore = Number(
      (qualityScore * 0.45 + deliveryScore * 0.35 + priceScore * 0.2).toFixed(
        2,
      ),
    );

    await manager.update(
      Partner,
      { _id: vendorId },
      {
        qualityScore,
        deliveryScore,
        vendorOverallScore: overallScore,
        vendorGrade: this.resolveVendorGrade(overallScore),
        vendorOnTimeDeliveryRate: onTimeDeliveryRate,
        vendorDefectRate: defectRate,
        vendorClaimCount: claimCount,
        vendorRejectionCount: rejectedLineCount + failedQcCount,
        vendorScoreUpdatedAt: new Date(),
      },
    );
  }

  async create(data: CreateQualityCheckDto, user: IUser) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const lockedGrItem = data.goodsReceiptItemId
        ? await manager.findOne(GoodsReceiptItem, {
            where: { _id: data.goodsReceiptItemId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      if (data.goodsReceiptItemId && !lockedGrItem) {
        throw new NotFoundException('Goods receipt line not found');
      }

      const grItem = lockedGrItem
        ? await manager.findOne(GoodsReceiptItem, {
            where: { _id: lockedGrItem._id },
            relations: ['goodsReceipt', 'product'],
          })
        : null;

      if (grItem && data.productId && data.productId !== grItem.productId) {
        throw new BadRequestException(
          'QC product does not match goods receipt line',
        );
      }

      const gr =
        grItem?.goodsReceipt ??
        (data.goodsReceiptId
          ? await manager.findOne(GoodsReceipt, {
              where: { _id: data.goodsReceiptId },
            })
          : null);

      if (
        data.goodsReceiptId &&
        grItem?.goodsReceiptId &&
        data.goodsReceiptId !== grItem.goodsReceiptId
      ) {
        throw new BadRequestException(
          'Goods receipt line does not belong to selected GRN',
        );
      }

      const productId = data.productId ?? grItem?.productId;
      if (!productId) {
        throw new BadRequestException(
          'QC must have productId or goodsReceiptItemId',
        );
      }

      const purchaseOrderId =
        data.purchaseOrderId ?? gr?.purchaseOrderId ?? null;
      const activeDuplicateQuery = manager
        .getRepository(QualityCheck)
        .createQueryBuilder('qc')
        .where('qc."exceptionStatus" != :closed', {
          closed: QCExceptionStatus.CLOSED,
        })
        .andWhere('qc."claimStatus" NOT IN (:...closedClaimStatuses)', {
          closedClaimStatuses: [QCClaimStatus.RESOLVED, QCClaimStatus.CANCELLED],
        });

      if (grItem) {
        activeDuplicateQuery.andWhere('qc."goodsReceiptItemId" = :lineId', {
          lineId: grItem._id,
        });
      } else if (purchaseOrderId) {
        activeDuplicateQuery
          .andWhere('qc."purchaseOrderId" = :purchaseOrderId', {
            purchaseOrderId,
          })
          .andWhere('qc."productId" = :productId', { productId });
      }

      if ((grItem || purchaseOrderId) && (await activeDuplicateQuery.getCount()) > 0) {
        throw new BadRequestException(
          'An active QC check already exists for this receipt line',
        );
      }

      const receivedQuantity = toNumber(
        data.receivedQuantity,
        toNumber(grItem?.quantityReceived),
      );
      const rejectedQuantity = toNumber(
        data.rejectedQuantity,
        toNumber(grItem?.quantityRejected),
      );

      if (rejectedQuantity > receivedQuantity) {
        throw new BadRequestException(
          'Rejected quantity cannot exceed received quantity',
        );
      }
      if (data.result === QCResult.PASSED && rejectedQuantity > 0) {
        throw new BadRequestException(
          'A PASSED QC check cannot contain rejected quantity',
        );
      }

      const acceptedQuantity = Math.max(receivedQuantity - rejectedQuantity, 0);
      const hasException =
        data.result !== QCResult.PASSED || rejectedQuantity > 0;
      const checkCount = await manager.count(QualityCheck);
      const checkNumber = `QC-${dateKey()}-${String(checkCount + 1).padStart(4, '0')}`;
      const claimNumber = hasException
        ? `CLM-${dateKey()}-${String(Date.now()).slice(-5)}`
        : null;

      const qc = manager.create(QualityCheck, {
        ...data,
        checkNumber,
        productId,
        lotId: data.lotId ?? null,
        goodsReceiptId: gr?._id ?? data.goodsReceiptId ?? null,
        goodsReceiptItemId: grItem?._id ?? null,
        purchaseOrderId,
        receivedQuantity,
        acceptedQuantity,
        rejectedQuantity,
        quarantineQuantity: hasException ? rejectedQuantity : 0,
        // If a line is rejected after physical receipt, the PO still needs a replacement.
        // We keep this as an explicit backorder/claim quantity instead of silently closing the PO line.
        backorderQuantity: hasException ? rejectedQuantity : 0,
        result: data.result,
        exceptionStatus: hasException
          ? QCExceptionStatus.QUARANTINED
          : QCExceptionStatus.NONE,
        claimNumber,
        claimStatus: hasException ? QCClaimStatus.OPEN : QCClaimStatus.NONE,
        inspectorUsername: user.username,
      });

      const savedQc = await manager.save(qc);

      if (grItem) {
        grItem.quantityRejected = rejectedQuantity;
        grItem.rejectionReason = hasException
          ? data.inspectorNotes || data.correctiveAction || 'Rejected by QC'
          : null;
        grItem.qualityStatus =
          data.result === QCResult.PASSED ? 'PASS' : data.result;
        grItem.lineNote = data.inspectorNotes ?? grItem.lineNote;
        await manager.save(grItem);
      }

      if (
        data.result === QCResult.FAILED &&
        hasException &&
        rejectedQuantity > 0
      ) {
        const returnCount = await manager.count(PurchaseReturn);
        const purchaseReturn = manager.create(PurchaseReturn, {
          returnNumber: `RET-${dateKey()}-${String(returnCount + 1).padStart(4, '0')}`,
          purchaseOrderId,
          qualityCheckId: savedQc._id,
          claimNumber,
          status: PurchaseReturnStatus.PENDING_VENDOR,
          returnDate: new Date(),
          reason:
            data.inspectorNotes ||
            `QC ${data.result} - rejected ${rejectedQuantity}`,
          createdByUsername: user.username,
        } as Partial<PurchaseReturn>);

        const savedReturn = await manager.save(purchaseReturn);
        await manager.save(
          manager.create(PurchaseReturnItem, {
            purchaseReturnId: savedReturn._id,
            productId,
            quantity: rejectedQuantity,
            unit: grItem?.unit ?? null,
          }),
        );

        savedQc.purchaseReturnId = savedReturn._id;
        savedQc.exceptionStatus = QCExceptionStatus.RETURN_CREATED;
        await manager.save(savedQc);
      }

      if (purchaseOrderId) {
        await this.recalculatePurchaseOrderStatus(manager, purchaseOrderId);
        await this.syncVendorOperationalScore(
          manager,
          await this.getPurchaseOrderVendorId(manager, purchaseOrderId),
        );
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedQc._id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      )
        throw err;
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: any) {
    const where: Record<string, any> = {};
    if (query.productId) where.productId = query.productId;
    if (query.lotId) where.lotId = query.lotId;
    if (query.goodsReceiptId) where.goodsReceiptId = query.goodsReceiptId;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;
    if (query.result) where.result = query.result;

    return this.qcRepository.find({
      where,
      relations: [
        'product',
        'lot',
        'inspector',
        'goodsReceipt',
        'goodsReceipt.purchaseOrder',
        'goodsReceipt.purchaseOrder.vendor',
        'goodsReceiptItem',
        'goodsReceiptItem.product',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseReturn',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findExceptions() {
    return this.qcRepository.find({
      where: [
        { exceptionStatus: Not(QCExceptionStatus.NONE) },
        { result: In([QCResult.FAILED, QCResult.CONDITIONAL]) },
      ],
      relations: [
        'product',
        'inspector',
        'goodsReceipt',
        'goodsReceipt.purchaseOrder',
        'goodsReceipt.purchaseOrder.vendor',
        'goodsReceiptItem',
        'goodsReceiptItem.product',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseReturn',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findExceptionCandidates(
    activeQualityChecks?: QualityCheck[],
  ): Promise<P2PExceptionCandidate[]> {
    const qualityChecks = activeQualityChecks ?? (await this.findExceptions());
    const activeMaps = this.getActiveQualityCheckMaps(qualityChecks);

    const rejectedLines = await this.dataSource
      .getRepository(GoodsReceiptItem)
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.goodsReceipt', 'goodsReceipt')
      .leftJoinAndSelect('goodsReceipt.purchaseOrder', 'purchaseOrder')
      .leftJoinAndSelect('purchaseOrder.vendor', 'vendor')
      .leftJoinAndSelect('item.product', 'product')
      .where(
        '(COALESCE(item."quantityRejected", 0) > 0 OR item."qualityStatus" != :pass)',
        {
          pass: 'PASS',
        },
      )
      .orderBy('item."updatedAt"', 'DESC')
      .getMany();

    const rejectedLineCandidates = rejectedLines
      .filter((line) => {
        const purchaseOrder = line.goodsReceipt?.purchaseOrder ?? null;
        return (
          !activeMaps.byGoodsReceiptItem.has(line._id) &&
          !activeMaps.byPoProduct.has(
            this.makePoProductKey(purchaseOrder?._id, line.productId),
          )
        );
      })
      .map<P2PExceptionCandidate>((line) => {
        const purchaseOrder = line.goodsReceipt?.purchaseOrder ?? null;
        const rejectedQuantity = toNumber(line.quantityRejected);
        const receivedQuantity = toNumber(line.quantityReceived);
        const exceptionQuantity =
          rejectedQuantity > 0 ? rejectedQuantity : receivedQuantity;

        return {
          _id: `candidate:grn:${line._id}`,
          sourceType: 'GRN_REJECTED_LINE',
          sourceNumber: line.goodsReceipt?.grNumber || 'GRN',
          goodsReceiptItem_id: line._id,
          goodsReceipt_id: line.goodsReceiptId,
          purchaseOrderItem_id: line.purchaseOrderItem_id,
          purchaseOrder_id: purchaseOrder?._id ?? null,
          product_id: line.productId,
          vendor_id: purchaseOrder?.vendor?._id ?? null,
          vendorName: purchaseOrder?.vendor?.name ?? null,
          poNumber: purchaseOrder?.poNumber ?? null,
          grNumber: line.goodsReceipt?.grNumber ?? null,
          product: this.toCandidateProduct(line.product),
          quantityOrdered: toNumber(line.quantityOrdered),
          receivedQuantity,
          rejectedQuantity,
          backorderQuantity: exceptionQuantity,
          exceptionQuantity,
          unit: line.unit,
          qualityStatus: line.qualityStatus,
          reason: line.rejectionReason || line.lineNote || null,
          createdAt: line.updatedAt.toISOString(),
          canCreateQc: true,
          existingQualityCheck_id: null,
        };
      });

    const shortReceiptLines = await this.dataSource
      .getRepository(PurchaseOrderItem)
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.purchaseOrder', 'purchaseOrder')
      .leftJoinAndSelect('purchaseOrder.vendor', 'vendor')
      .leftJoinAndSelect('item.product', 'product')
      .where('purchaseOrder.status IN (:...statuses)', {
        statuses: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.PARTIAL_RECEIPT,
        ],
      })
      .andWhere(
        `(
          COALESCE(item."backorderQuantity", 0) > 0
          OR (COALESCE(item."receivedQuantity", 0) > 0 AND COALESCE(item."receivedQuantity", 0) < COALESCE(item."quantity", 0))
          OR (
            "purchaseOrder"."expectedDeliveryDate" IS NOT NULL
            AND "purchaseOrder"."expectedDeliveryDate" < NOW()
            AND COALESCE(item."receivedQuantity", 0) < COALESCE(item."quantity", 0)
          )
        )`,
      )
      .orderBy('item."updatedAt"', 'DESC')
      .getMany();

    const shortReceiptCandidates = shortReceiptLines
      .filter(
        (line) =>
          !activeMaps.byPoProduct.has(
            this.makePoProductKey(line.purchaseOrderId, line.productId),
          ),
      )
      .map<P2PExceptionCandidate>((line) => {
        const purchaseOrder = line.purchaseOrder ?? null;
        const quantityOrdered = toNumber(line.quantity);
        const receivedQuantity = toNumber(line.receivedQuantity);
        const shortQuantity = Math.max(quantityOrdered - receivedQuantity, 0);
        const backorderQuantity = Math.max(
          toNumber(line.backorderQuantity),
          shortQuantity,
        );

        return {
          _id: `candidate:po:${line._id}`,
          sourceType: 'PO_SHORT_RECEIPT',
          sourceNumber: purchaseOrder?.poNumber || 'PO',
          goodsReceiptItem_id: null,
          goodsReceipt_id: null,
          purchaseOrderItem_id: line._id,
          purchaseOrder_id: line.purchaseOrderId,
          product_id: line.productId,
          vendor_id: purchaseOrder?.vendor?._id ?? null,
          vendorName: purchaseOrder?.vendor?.name ?? null,
          poNumber: purchaseOrder?.poNumber ?? null,
          grNumber: null,
          product: this.toCandidateProduct(line.product),
          quantityOrdered,
          receivedQuantity,
          rejectedQuantity: toNumber(line.rejectedQuantity),
          backorderQuantity,
          exceptionQuantity: backorderQuantity,
          unit: line.unit,
          qualityStatus: null,
          reason: purchaseOrder?.expectedDeliveryDate
            ? `Expected delivery ${purchaseOrder.expectedDeliveryDate.toISOString().slice(0, 10)}`
            : null,
          createdAt: line.updatedAt.toISOString(),
          canCreateQc: false,
          existingQualityCheck_id: null,
        };
      });

    return [...rejectedLineCandidates, ...shortReceiptCandidates].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async getExceptionDashboard() {
    const rows = await this.findExceptions();
    const candidates = await this.findExceptionCandidates(rows);
    const now = Date.now();
    const activeRows = rows.filter(
      (row) =>
        row.exceptionStatus !== QCExceptionStatus.CLOSED &&
        ![QCClaimStatus.RESOLVED, QCClaimStatus.CANCELLED].includes(
          row.claimStatus,
        ),
    );

    const claimAging = {
      days0To7: 0,
      days8To14: 0,
      days15To30: 0,
      over30: 0,
    };
    const vendorMap = new Map<
      string,
      {
        vendor_id: string;
        vendorName: string;
        openExceptionCount: number;
        openClaimCount: number;
        rejectedQuantity: number;
        backorderQuantity: number;
        creditAmount: number;
        oldestOpenAt: string | null;
      }
    >();
    const productMap = new Map<
      string,
      {
        product_id: string;
        sku: string | null;
        productName: string | null;
        openExceptionCount: number;
        rejectedQuantity: number;
        backorderQuantity: number;
      }
    >();

    for (const row of activeRows) {
      const ageDays = Math.floor(
        (now - new Date(row.createdAt).getTime()) / 86_400_000,
      );
      if (ageDays <= 7) claimAging.days0To7 += 1;
      else if (ageDays <= 14) claimAging.days8To14 += 1;
      else if (ageDays <= 30) claimAging.days15To30 += 1;
      else claimAging.over30 += 1;

      const po = row.purchaseOrder || row.goodsReceipt?.purchaseOrder || null;
      const vendor = po?.vendor || null;
      const vendorId = vendor?._id || 'UNKNOWN_VENDOR';
      const vendorBucket = vendorMap.get(vendorId) || {
        vendor_id: vendorId,
        vendorName: vendor?.name || 'Unknown vendor',
        openExceptionCount: 0,
        openClaimCount: 0,
        rejectedQuantity: 0,
        backorderQuantity: 0,
        creditAmount: 0,
        oldestOpenAt: null,
      };
      vendorBucket.openExceptionCount += 1;
      if ([QCClaimStatus.OPEN, QCClaimStatus.SENT].includes(row.claimStatus)) {
        vendorBucket.openClaimCount += 1;
      }
      vendorBucket.rejectedQuantity += toNumber(row.rejectedQuantity);
      vendorBucket.backorderQuantity += toNumber(row.backorderQuantity);
      vendorBucket.creditAmount += toNumber(row.creditAmount);
      if (
        !vendorBucket.oldestOpenAt ||
        new Date(row.createdAt).getTime() <
          new Date(vendorBucket.oldestOpenAt).getTime()
      ) {
        vendorBucket.oldestOpenAt = row.createdAt.toISOString();
      }
      vendorMap.set(vendorId, vendorBucket);

      const product = row.goodsReceiptItem?.product || row.product || null;
      const productId = product?._id || row.productId;
      const productBucket = productMap.get(productId) || {
        product_id: productId,
        sku: product?.sku || null,
        productName: product?.vietnameseName || product?.englishName || null,
        openExceptionCount: 0,
        rejectedQuantity: 0,
        backorderQuantity: 0,
      };
      productBucket.openExceptionCount += 1;
      productBucket.rejectedQuantity += toNumber(row.rejectedQuantity);
      productBucket.backorderQuantity += toNumber(row.backorderQuantity);
      productMap.set(productId, productBucket);
    }

    for (const candidate of candidates) {
      const vendorKey = candidate.vendor_id || 'UNKNOWN_VENDOR';
      const vendorBucket = vendorMap.get(vendorKey) || {
        vendor_id: vendorKey,
        vendorName: candidate.vendorName || 'Unknown vendor',
        openExceptionCount: 0,
        openClaimCount: 0,
        rejectedQuantity: 0,
        backorderQuantity: 0,
        creditAmount: 0,
        oldestOpenAt: null,
      };
      vendorBucket.openExceptionCount += 1;
      vendorBucket.rejectedQuantity += toNumber(candidate.rejectedQuantity);
      vendorBucket.backorderQuantity += toNumber(candidate.backorderQuantity);
      if (
        !vendorBucket.oldestOpenAt ||
        new Date(candidate.createdAt).getTime() <
          new Date(vendorBucket.oldestOpenAt).getTime()
      ) {
        vendorBucket.oldestOpenAt = candidate.createdAt;
      }
      vendorMap.set(vendorKey, vendorBucket);

      const productKey = candidate.product_id;
      const productBucket = productMap.get(productKey) || {
        product_id: productKey,
        sku: candidate.product?.sku || null,
        productName:
          candidate.product?.vietnameseName ||
          candidate.product?.englishName ||
          null,
        openExceptionCount: 0,
        rejectedQuantity: 0,
        backorderQuantity: 0,
      };
      productBucket.openExceptionCount += 1;
      productBucket.rejectedQuantity += toNumber(candidate.rejectedQuantity);
      productBucket.backorderQuantity += toNumber(candidate.backorderQuantity);
      productMap.set(productKey, productBucket);
    }

    const overdueReplacementRows = activeRows.filter(
      (row) =>
        row.replacementDueDate &&
        new Date(row.replacementDueDate).getTime() < now &&
        row.resolutionType === QCResolutionType.REPLACEMENT,
    );

    return {
      summary: {
        totalExceptionCount: rows.length,
        openExceptionCount: activeRows.length + candidates.length,
        activeQualityCheckCount: activeRows.length,
        pendingSourceCount: candidates.length,
        rejectedGrnLineCount: candidates.filter(
          (row) => row.sourceType === 'GRN_REJECTED_LINE',
        ).length,
        shortReceiptCount: candidates.filter(
          (row) => row.sourceType === 'PO_SHORT_RECEIPT',
        ).length,
        openClaimCount: activeRows.filter((row) =>
          [QCClaimStatus.OPEN, QCClaimStatus.SENT].includes(row.claimStatus),
        ).length,
        sentClaimCount: activeRows.filter(
          (row) => row.claimStatus === QCClaimStatus.SENT,
        ).length,
        rejectedQuantity:
          activeRows.reduce(
            (sum, row) => sum + toNumber(row.rejectedQuantity),
            0,
          ) +
          candidates.reduce(
            (sum, row) => sum + toNumber(row.rejectedQuantity),
            0,
          ),
        backorderQuantity:
          activeRows.reduce(
            (sum, row) => sum + toNumber(row.backorderQuantity),
            0,
          ) +
          candidates.reduce(
            (sum, row) => sum + toNumber(row.backorderQuantity),
            0,
          ),
        pendingCreditAmount: activeRows.reduce(
          (sum, row) => sum + toNumber(row.creditAmount),
          0,
        ),
        overdueReplacementCount: overdueReplacementRows.length,
      },
      claimAging,
      byVendor: [...vendorMap.values()].sort(
        (a, b) => b.openExceptionCount - a.openExceptionCount,
      ),
      byProduct: [...productMap.values()].sort(
        (a, b) => b.backorderQuantity - a.backorderQuantity,
      ),
      overdueReplacements: overdueReplacementRows.map((row) => ({
        _id: row._id,
        checkNumber: row.checkNumber,
        claimNumber: row.claimNumber,
        replacementDueDate: row.replacementDueDate,
        product_id: row.productId,
        backorderQuantity: row.backorderQuantity,
        vendorName:
          (row.purchaseOrder || row.goodsReceipt?.purchaseOrder)?.vendor
            ?.name || null,
      })),
      pendingSources: candidates,
    };
  }

  async findOne(recordId: string) {
    const qc = await this.qcRepository.findOne({
      where: { _id: recordId },
      relations: [
        'product',
        'lot',
        'inspector',
        'goodsReceipt',
        'goodsReceipt.purchaseOrder',
        'goodsReceipt.purchaseOrder.vendor',
        'goodsReceiptItem',
        'goodsReceiptItem.product',
        'purchaseOrder',
        'purchaseOrder.vendor',
        'purchaseReturn',
      ],
    });
    if (!qc) throw new NotFoundException('QC check not found');
    return qc;
  }

  async closeException(
    recordId: string,
    dto: CloseQualityExceptionDto,
    user: IUser,
  ) {
    return this.resolveException(
      recordId,
      {
        resolutionType: QCResolutionType.OTHER,
        note: dto.correctiveAction || 'Closed from exception board',
      },
      user,
    );
  }

  async sendClaim(recordId: string, dto: SendQualityClaimDto, user: IUser) {
    return this.dataSource.transaction(async (manager) => {
      const qc = await manager.findOne(QualityCheck, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!qc) throw new NotFoundException('QC check not found');
      if (qc.exceptionStatus === QCExceptionStatus.NONE) {
        throw new BadRequestException('QC check has no exception to claim');
      }
      if (![QCClaimStatus.OPEN, QCClaimStatus.SENT].includes(qc.claimStatus)) {
        throw new BadRequestException('Only open claims can be sent to vendor');
      }

      qc.claimStatus = QCClaimStatus.SENT;
      qc.exceptionStatus = QCExceptionStatus.CLAIM_OPEN;
      qc.claimSentByUsername = user.username;
      qc.claimSentAt = new Date();
      qc.correctiveAction = [
        qc.correctiveAction,
        dto.note ? `Claim sent: ${dto.note}` : 'Claim sent to vendor',
      ]
        .filter(Boolean)
        .join('\n');

      if (qc.purchaseReturnId) {
        await manager.update(
          PurchaseReturn,
          { _id: qc.purchaseReturnId },
          {
            status: PurchaseReturnStatus.SENT,
            sentByUsername: user.username,
            sentAt: new Date(),
            settlementNote: dto.note || null,
          },
        );
      }

      await manager.save(qc);

      if (qc.purchaseOrderId) {
        await this.recalculatePurchaseOrderStatus(manager, qc.purchaseOrderId);
        await this.syncVendorOperationalScore(
          manager,
          await this.getPurchaseOrderVendorId(manager, qc.purchaseOrderId),
        );
      }

      return manager.findOne(QualityCheck, {
        where: { _id: recordId },
        relations: [
          'product',
          'inspector',
          'goodsReceipt',
          'goodsReceipt.purchaseOrder',
          'goodsReceipt.purchaseOrder.vendor',
          'goodsReceiptItem',
          'goodsReceiptItem.product',
          'purchaseOrder',
          'purchaseOrder.vendor',
          'purchaseReturn',
        ],
      });
    });
  }

  async resolveException(
    recordId: string,
    dto: ResolveQualityExceptionDto,
    user: IUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const qc = await manager.findOne(QualityCheck, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!qc) throw new NotFoundException('QC check not found');
      if (qc.exceptionStatus === QCExceptionStatus.NONE) {
        throw new BadRequestException(
          'QC check has no open exception workflow',
        );
      }
      if (qc.claimStatus === QCClaimStatus.RESOLVED) {
        throw new BadRequestException('QC exception is already resolved');
      }

      const now = new Date();
      qc.exceptionStatus = QCExceptionStatus.CLOSED;
      qc.claimStatus =
        dto.resolutionType === QCResolutionType.CANCELLED
          ? QCClaimStatus.CANCELLED
          : QCClaimStatus.RESOLVED;
      qc.resolutionType = dto.resolutionType;
      qc.creditAmount = toNumber(dto.creditAmount);
      qc.replacementDueDate = dto.replacementDueDate || null;
      qc.resolutionNote = dto.note || null;
      qc.resolvedByUsername = user.username;
      qc.resolvedAt = now;
      qc.correctiveAction = [
        qc.correctiveAction,
        dto.note
          ? `Resolved: ${dto.note}`
          : `Resolved as ${dto.resolutionType}`,
      ]
        .filter(Boolean)
        .join('\n');

      if (qc.purchaseReturnId) {
        const returnStatus =
          dto.resolutionType === QCResolutionType.REPLACEMENT
            ? PurchaseReturnStatus.REPLACED
            : dto.resolutionType === QCResolutionType.CREDIT_NOTE
              ? PurchaseReturnStatus.CREDITED
              : PurchaseReturnStatus.CLOSED;

        await manager.update(
          PurchaseReturn,
          { _id: qc.purchaseReturnId },
          {
            status: returnStatus,
            resolvedByUsername: user.username,
            resolvedAt: now,
            settlementType: dto.resolutionType,
            settlementNote: dto.note || null,
          },
        );
      }

      await manager.save(qc);

      if (qc.purchaseOrderId) {
        await this.recalculatePurchaseOrderStatus(manager, qc.purchaseOrderId);
        await this.syncVendorOperationalScore(
          manager,
          await this.getPurchaseOrderVendorId(manager, qc.purchaseOrderId),
        );
      }

      return manager.findOne(QualityCheck, {
        where: { _id: recordId },
        relations: [
          'product',
          'inspector',
          'goodsReceipt',
          'goodsReceipt.purchaseOrder',
          'goodsReceipt.purchaseOrder.vendor',
          'goodsReceiptItem',
          'goodsReceiptItem.product',
          'purchaseOrder',
          'purchaseOrder.vendor',
          'purchaseReturn',
        ],
      });
    });
  }

  private async recalculatePurchaseOrderStatus(
    manager: any,
    purchaseOrderId: string,
  ) {
    const po = await manager.findOne(PurchaseOrder, {
      where: { _id: purchaseOrderId },
      relations: ['items'],
    });
    if (!po || po.status === PurchaseOrderStatus.CANCELLED) return;

    const acceptedByProduct = await manager
      .getRepository(GoodsReceiptItem)
      .createQueryBuilder('item')
      .leftJoin('item.goodsReceipt', 'gr')
      .select('item."productId"', 'productId')
      .addSelect(
        'COALESCE(SUM(item."quantityReceived" - COALESCE(item."quantityRejected", 0)), 0)',
        'acceptedQty',
      )
      .addSelect(
        'COALESCE(SUM(COALESCE(item."quantityRejected", 0)), 0)',
        'rejectedQty',
      )
      .where('gr."purchaseOrderId" = :purchaseOrderId', { purchaseOrderId })
      .groupBy('item."productId"')
      .getRawMany();

    const acceptedMap = new Map<string, number>(
      acceptedByProduct.map((row) => [
        row.productId,
        toNumber(row.acceptedQty),
      ]),
    );
    const rejectedMap = new Map<string, number>(
      acceptedByProduct.map((row) => [
        row.productId,
        toNumber(row.rejectedQty),
      ]),
    );

    const backorderRows = await manager
      .getRepository(QualityCheck)
      .createQueryBuilder('qc')
      .select('qc."productId"', 'productId')
      .addSelect('COALESCE(SUM(qc."backorderQuantity"), 0)', 'backorderQty')
      .where('qc."purchaseOrderId" = :purchaseOrderId', { purchaseOrderId })
      .andWhere(
        '(qc."claimStatus" IN (:...activeClaims) OR qc."resolutionType" = :replacement)',
        {
          activeClaims: [QCClaimStatus.OPEN, QCClaimStatus.SENT],
          replacement: QCResolutionType.REPLACEMENT,
        },
      )
      .groupBy('qc."productId"')
      .getRawMany();
    const backorderMap = new Map<string, number>(
      backorderRows.map((row) => [row.productId, toNumber(row.backorderQty)]),
    );

    for (const item of po.items) {
      item.receivedQuantity = acceptedMap.get(item.productId) || 0;
      item.rejectedQuantity = rejectedMap.get(item.productId) || 0;
      item.backorderQuantity = backorderMap.get(item.productId) || 0;
      await manager.save(PurchaseOrderItem, item);
    }

    const allReceived = po.items.every(
      (item) => (acceptedMap.get(item.productId) || 0) >= Number(item.quantity),
    );
    const someReceived = po.items.some(
      (item) => (acceptedMap.get(item.productId) || 0) > 0,
    );

    po.status = allReceived
      ? PurchaseOrderStatus.RECEIVED
      : someReceived
        ? PurchaseOrderStatus.PARTIAL_RECEIPT
        : PurchaseOrderStatus.SENT;

    await manager.save(PurchaseOrder, po);
  }
}
