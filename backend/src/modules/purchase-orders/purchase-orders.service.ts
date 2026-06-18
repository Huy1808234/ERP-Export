import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import type { IUser } from '../users/users.interface';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
} from '../purchase-requests/entities/purchase-request.entity';
import {
  PIStatus,
  ProformaInvoice,
} from '../proforma-invoices/entities/proforma-invoice.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { Partner, PartnerType } from '../partners/entities/partner.entity';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/settings.keys';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import { GoodsReceipt } from '../goods-receipts/entities/goods-receipt.entity';
import {
  VendorInvoice,
  VendorInvoiceStatus,
} from '../vendor-invoices/entities/vendor-invoice.entity';
import { VendorInvoiceItem } from '../vendor-invoices/entities/vendor-invoice-item.entity';
import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto';
import { SendPurchaseOrderDto } from './dto/send-purchase-order.dto';

const PO_NO_APPROVAL_RULE_CONFIRMATION_REQUIRED =
  'PO_NO_APPROVAL_RULE_CONFIRMATION_REQUIRED';

@Injectable()
export class PurchaseOrdersService implements OnModuleInit {
  constructor(
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private poItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PurchaseRequest)
    private prRepository: Repository<PurchaseRequest>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(ProformaInvoice)
    private proformaInvoiceRepository: Repository<ProformaInvoice>,
    private dataSource: DataSource,
    private currenciesService: CurrenciesService,
    private settingsService: SettingsService,
    private approvalMatrixService: ApprovalMatrixService,
  ) {}

  private async getDefaultPurchaseVatRate(): Promise<number> {
    const taxRate = await this.settingsService.getNumber(
      SETTING_KEYS.DEFAULT_PURCHASE_VAT_RATE,
      10,
    );

    if (taxRate < 0 || taxRate > 100) {
      throw new BadRequestException(
        'DEFAULT_PURCHASE_VAT_RATE must be between 0 and 100',
      );
    }

    return taxRate;
  }

  private appendAuditEvent(
    po: PurchaseOrder,
    action: string,
    username: string,
    payload: {
      fromStatus?: PurchaseOrderStatus;
      toStatus?: PurchaseOrderStatus;
      reason?: string | null;
    } = {},
  ) {
    po.auditTrail = [
      ...(Array.isArray(po.auditTrail) ? po.auditTrail : []),
      {
        action,
        username: username || 'system',
        at: new Date().toISOString(),
        ...payload,
      },
    ];
  }

  private async validatePiForPurchaseOrder(
    proformaInvoiceId?: string,
  ): Promise<void> {
    if (!proformaInvoiceId) return;

    const pi = await this.proformaInvoiceRepository.findOne({
      where: { _id: proformaInvoiceId },
    });

    if (!pi) {
      throw new NotFoundException('Proforma Invoice not found');
    }

    if (pi.status !== PIStatus.ACCEPTED) {
      throw new BadRequestException(
        'PI phải ở trạng thái ACCEPTED trước khi tạo PO NCC',
      );
    }

    const requiresDeposit =
      Number(pi.depositPercent || 0) > 0 || Number(pi.depositAmount || 0) > 0;
    if (requiresDeposit && !pi.isPaid) {
      throw new BadRequestException(
        'PI có cọc/thanh toán nhưng chưa được xác nhận trước khi tạo PO NCC',
      );
    }
  }

  async onModuleInit() {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      // Step 1: Clean up duplicate poNumbers from dev/test sessions (soft-deleted rows included)
      const duplicates = await queryRunner.query(`
        SELECT "poNumber" FROM "purchase_orders" 
        GROUP BY "poNumber" HAVING COUNT(*) > 1
      `);

      for (const dup of duplicates) {
        const records = await queryRunner.query(
          `SELECT "_id", "deletedAt" FROM "purchase_orders" WHERE "poNumber" = $1 ORDER BY "createdAt" ASC`,
          [dup.poNumber],
        );
        // Keep the first live record, rename all others
        let kept = false;
        for (const rec of records) {
          if (!rec.deletedAt && !kept) {
            kept = true;
            continue;
          }
          const newNum = `${dup.poNumber}-ARCHIVED-${Date.now()}`;
          await queryRunner.query(
            `UPDATE "purchase_orders" SET "poNumber" = $1 WHERE "_id" = $2`,
            [newNum, rec._id],
          );
          console.warn(`[PO] Renamed duplicate: ${dup.poNumber} -> ${newNum}`);
        }
      }

      // Step 2: Drop the old global unique constraint (blocks on soft-deleted rows)
      await queryRunner.query(
        `ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "UQ_2e0fc7a6605393a9bd691cdcebe"`,
      );

      // Step 3: Create a partial unique index for active, non-deleted PO numbers.
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UDX_po_number_active" 
        ON "purchase_orders" ("poNumber") 
        WHERE "deletedAt" IS NULL
      `);

      console.log('[PO] Database: Partial unique index on poNumber ensured.');
      await queryRunner.release();
    } catch (error) {
      console.error('[PO] onModuleInit error:', error.message);
    }
  }

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto, user: IUser) {
    const { items, purchaseRequestId, ...poData } = createPurchaseOrderDto;
    await this.validatePiForPurchaseOrder(poData.proformaInvoiceId);
    const defaultTaxRate = await this.getDefaultPurchaseVatRate();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock table to serialize concurrent PO creation
      await queryRunner.query(
        'LOCK TABLE "purchase_orders" IN SHARE ROW EXCLUSIVE MODE',
      );

      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

      // Query ALL records for today (including soft-deleted) to get the true max sequence
      const todayPos = await queryRunner.query(
        `SELECT "poNumber" FROM "purchase_orders" WHERE "poNumber" LIKE $1`,
        [`PO-${dateStr}-%`],
      );

      let nextSeq = 1;
      if (todayPos.length > 0) {
        const sequences = todayPos
          .map((po: any) => {
            const match = po.poNumber.match(/-(\d{4})(?:-|$)/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((s: number) => s > 0);

        if (sequences.length > 0) {
          nextSeq = Math.max(...sequences) + 1;
        }
      }

      // Find next free poNumber (accounting for ALL rows including soft-deleted)
      let poNumber = `PO-${dateStr}-${nextSeq.toString().padStart(4, '0')}`;
      while (true) {
        const existing = await queryRunner.query(
          `SELECT "_id" FROM "purchase_orders" WHERE "poNumber" = $1 LIMIT 1`,
          [poNumber],
        );
        if (existing.length === 0) break;
        nextSeq++;
        poNumber = `PO-${dateStr}-${nextSeq.toString().padStart(4, '0')}`;
      }

      // 2. Calculate Totals
      let subTotal = 0;
      let taxAmount = 0;

      const preparedItems = items.map((item) => {
        const taxRate = item.taxRate ?? defaultTaxRate;
        const lineTotal = item.quantity * item.unitPrice;
        const lineTax = (lineTotal * taxRate) / 100;

        subTotal += lineTotal;
        taxAmount += lineTax;

        return this.poItemRepository.create({
          ...item,
          taxRate,
          totalAmount: lineTotal + lineTax,
        });
      });

      // 3. Create PO
      const po = this.poRepository.create({
        ...poData,
        poNumber,
        purchaseRequestId,
        subTotal,
        taxAmount,
        totalAmount: subTotal + taxAmount,
        createdByUsername: user.username,
        status: PurchaseOrderStatus.DRAFT,
      });

      const savedPo = await queryRunner.manager.save(po);

      // 4. Save Items
      for (const item of preparedItems) {
        item.purchaseOrderId = savedPo._id;
        await queryRunner.manager.save(item);
      }

      // 5. Update PR status
      if (purchaseRequestId) {
        await queryRunner.manager.update(
          PurchaseRequest,
          { _id: purchaseRequestId },
          {
            status: PurchaseRequestStatus.COMPLETED,
          },
        );
      }

      await queryRunner.commitTransaction();
      return savedPo;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async createFromPR(
    body: { purchaseRequestId: string; vendorId?: string },
    user: IUser,
  ) {
    const { purchaseRequestId, vendorId } = body;

    // 1. Get PR with items
    const pr = await this.prRepository.findOne({
      where: { _id: purchaseRequestId },
      relations: ['items', 'items.product'],
    });

    if (!pr) throw new NotFoundException('Purchase Request not found');
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Purchase Request must be APPROVED to create a PO',
      );
    }

    // 2. Determine Vendor
    let finalVendorId = vendorId;
    if (!finalVendorId) {
      const preferredSupplierItem = pr.items.find(
        (item) => item.product?.preferredSupplierId,
      );
      const preferredSupplierId =
        preferredSupplierItem?.product?.preferredSupplierId;

      if (preferredSupplierId) {
        finalVendorId = preferredSupplierId;
      }
    }

    if (!finalVendorId) {
      // Fallback: Pick the first active supplier if none provided
      const defaultVendor = await this.partnerRepository.findOne({
        where: { partnerType: PartnerType.SUPPLIER, isActive: true },
      });
      if (!defaultVendor)
        throw new BadRequestException(
          'No vendor found to assign to PO. Please specify a vendorId.',
        );
      finalVendorId = defaultVendor._id;
    }

    // 3. Map PR items to PO items DTO
    const poItems = pr.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.estimatedPrice || 0,
      unit: item.unit,
    }));

    // 4. Reuse the existing create logic
    return this.create(
      {
        purchaseRequestId,
        vendorId: finalVendorId,
        orderDate: new Date().toISOString(),
        expectedDeliveryDate:
          pr.expectedDate?.toISOString() ||
          pr.requiredDate?.toISOString() ||
          null,
        items: poItems,
        currency: 'VND',
      } as CreatePurchaseOrderDto,
      user,
    );
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const page =
      Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
    const defaultLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const offset = (page - 1) * defaultLimit;

    const relations =
      population && Array.isArray(population)
        ? population.map((p) => p.path)
        : ['items', 'items.product', 'vendor', 'createdBy', 'purchaseRequest'];

    // Xử lý lọc nhiều trạng thái (comma-separated)
    if (
      filter.status &&
      typeof filter.status === 'string' &&
      filter.status.includes(',')
    ) {
      const { In } = require('typeorm');
      filter.status = In(filter.status.split(','));
    }

    const [result, total] = await this.poRepository.findAndCount({
      where: filter,
      relations,
      order: (sort as any) || { createdAt: 'DESC' },
      take: defaultLimit,
      skip: offset,
    });

    const results = result.map((po) => {
      if (Number(po.totalAmount) === 0 && po.items) {
        const calculatedTotal = po.items.reduce(
          (sum, item) => sum + Number(item.totalAmount || 0),
          0,
        );
        return { ...po, totalAmount: calculatedTotal };
      }
      return po;
    });

    return {
      meta: {
        current: page,
        pageSize: defaultLimit,
        pages: Math.ceil(total / defaultLimit),
        total: total,
      },
      results: results,
    };
  }

  async findOne(purchaseOrderRef: string) {
    const po = await this.poRepository.findOne({
      where: { _id: purchaseOrderRef },
      relations: [
        'items',
        'items.product',
        'vendor',
        'createdBy',
        'purchaseRequest',
      ],
    });
    if (!po) throw new NotFoundException('Purchase Order not found');
    return po;
  }

  async update(
    purchaseOrderRef: string,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ) {
    const po = await this.findOne(purchaseOrderRef);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT POs can be updated');
    }
    return this.poRepository.save({ ...po, ...updatePurchaseOrderDto });
  }

  async send(
    purchaseOrderRef: string,
    user: IUser,
    options: SendPurchaseOrderDto = {},
  ) {
    const po = await this.findOne(purchaseOrderRef);

    if (po.status === PurchaseOrderStatus.APPROVED) {
      po.status = PurchaseOrderStatus.SENT;
      return this.poRepository.save(po);
    }

    if (po.status === PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException('PO is already pending approval');
    }

    if (
      po.status !== PurchaseOrderStatus.DRAFT &&
      po.status !== PurchaseOrderStatus.REJECTED
    ) {
      throw new BadRequestException(
        'PO must be in DRAFT or REJECTED status before submit/send',
      );
    }

    const amountVnd = await this.currenciesService.convertToBase(
      Number(po.totalAmount || 0),
      po.currency,
    );
    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.PURCHASE_ORDER,
      amountVnd,
      po.currency,
    );

    if (!matchingRule) {
      if (options.confirmNoApprovalRule) {
        const fromStatus = po.status;
        po.status = PurchaseOrderStatus.SENT;
        po.approvalWorkflowRequestId = null;
        po.submittedForApprovalByUsername = null;
        po.submittedForApprovalAt = null;
        po.rejectionReason = null;
        this.appendAuditEvent(po, 'SENT_WITHOUT_APPROVAL_RULE', user.username, {
          fromStatus,
          toStatus: PurchaseOrderStatus.SENT,
          reason: 'No active PURCHASE_ORDER approval rule matched',
        });
        return this.poRepository.save(po);
      }

      throw new BadRequestException(PO_NO_APPROVAL_RULE_CONFIRMATION_REQUIRED);
    }

    // PO approval is delegated to the generic approval matrix. Keeping the PO
    // status pending lets downstream modules block GRN/invoice until approval.
    const approvalRequest = await this.approvalMatrixService.createRequest(
      {
        ruleId: matchingRule._id,
        documentType: ApprovalDocumentType.PURCHASE_ORDER,
        documentId: po._id,
        documentNumber: po.poNumber,
        title: `Approve Purchase Order ${po.poNumber}`,
        currency: po.currency,
        amount: Number(po.totalAmount || 0),
        amountVnd,
        metadata: {
          vendorId: po.vendorId,
          vendorName: po.vendor?.name || null,
          source: 'purchase_orders.send',
        },
      },
      user,
    );

    po.status = PurchaseOrderStatus.PENDING_APPROVAL;
    po.approvalWorkflowRequestId = approvalRequest?._id || null;
    po.submittedForApprovalByUsername = user.username;
    po.submittedForApprovalAt = new Date();
    po.rejectionReason = null;
    const savedPo = await this.poRepository.save(po);

    return {
      ...savedPo,
      approvalRequest,
    };
  }

  async softDelete(purchaseOrderRef: string) {
    // Kiểm tra các chứng từ liên quan trước khi cho phép xóa mềm
    const grCount = await this.dataSource
      .getRepository('goods_receipts')
      .count({ where: { purchaseOrderId: purchaseOrderRef } });
    if (grCount > 0) {
      throw new BadRequestException(
        'Không thể xóa đơn đặt hàng đã có phiếu nhập kho (GRN). Vui lòng kiểm tra lại.',
      );
    }

    const invCount = await this.dataSource
      .getRepository('vendor_invoices')
      .count({ where: { purchaseOrderId: purchaseOrderRef } });
    if (invCount > 0) {
      throw new BadRequestException(
        'Không thể xóa đơn đặt hàng đã có hóa đơn nhà cung cấp. Vui lòng kiểm tra lại.',
      );
    }

    return this.poRepository.softDelete({ _id: purchaseOrderRef });
  }

  async cancel(
    purchaseOrderRef: string,
    dto: CancelPurchaseOrderDto,
    user: IUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const po = await manager.findOne(PurchaseOrder, {
        where: { _id: purchaseOrderRef },
        lock: { mode: 'pessimistic_write' },
      });
      if (!po) throw new NotFoundException('Purchase Order not found');
      if (po.status === PurchaseOrderStatus.CANCELLED) {
        throw new BadRequestException('PO da bi huy truoc do');
      }

      const reason = dto.reason?.trim();
      if (!reason) throw new BadRequestException('Can nhap ly do huy PO');

      const receiptCount = await manager.count(GoodsReceipt, {
        where: { purchaseOrderId: purchaseOrderRef },
      });
      po.items = await manager.find(PurchaseOrderItem, {
        where: { purchaseOrderId: po._id },
      });
      if (
        receiptCount > 0 ||
        po.items.some((item) => Number(item.receivedQuantity || 0) > 0)
      ) {
        throw new BadRequestException(
          'PO da co GRN/received quantity; xu ly bang purchase return/claim thay vi cancel',
        );
      }

      const activeInvoiceCount = await manager
        .getRepository(VendorInvoice)
        .createQueryBuilder('invoice')
        .where('invoice."purchaseOrderId" = :purchaseOrderId', {
          purchaseOrderId: purchaseOrderRef,
        })
        .andWhere('invoice.status != :status', {
          status: VendorInvoiceStatus.CANCELLED,
        })
        .getCount();
      if (activeInvoiceCount > 0) {
        throw new BadRequestException(
          'PO da co vendor invoice; khong duoc huy truc tiep',
        );
      }

      const fromStatus = po.status;
      po.status = PurchaseOrderStatus.CANCELLED;
      po.cancellationReason = reason;
      po.cancelledByUsername = user.username;
      po.cancelledAt = new Date();
      po.rejectionReason = null;
      this.appendAuditEvent(po, 'PO_CANCELLED', user.username, {
        fromStatus,
        toStatus: PurchaseOrderStatus.CANCELLED,
        reason,
      });

      return manager.save(PurchaseOrder, po);
    });
  }

  async getMatchingData(purchaseOrderRef: string) {
    const po = await this.poRepository.findOne({
      where: { _id: purchaseOrderRef },
      relations: ['items', 'items.product', 'vendor'],
    });

    if (!po) throw new NotFoundException('Purchase Order not found');

    const grns = await this.dataSource.getRepository(GoodsReceipt).find({
      where: { purchaseOrderId: purchaseOrderRef },
      relations: ['items', 'items.product', 'items.purchaseOrderItem'],
    });

    const invoices = await this.dataSource.getRepository(VendorInvoice).find({
      where: { purchaseOrderId: purchaseOrderRef },
      relations: ['items'],
    });

    const poItemsByProduct = new Map<string, PurchaseOrderItem[]>();
    po.items.forEach((item) => {
      poItemsByProduct.set(item.productId, [
        ...(poItemsByProduct.get(item.productId) || []),
        item,
      ]);
    });

    const resolveLineKey = (
      productId: string,
      purchaseOrderItem_id?: string | null,
    ) => {
      if (
        purchaseOrderItem_id &&
        po.items.some((item) => item._id === purchaseOrderItem_id)
      ) {
        return purchaseOrderItem_id;
      }
      const candidates = poItemsByProduct.get(productId) || [];
      return candidates.length === 1 ? candidates[0]._id : null;
    };

    const receivedMap = new Map<string, number>();
    const rejectedMap = new Map<string, number>();
    grns.forEach((gr) => {
      gr.items.forEach((item) => {
        const lineKey = resolveLineKey(
          item.productId,
          item.purchaseOrderItem_id,
        );
        if (!lineKey) return;
        receivedMap.set(
          lineKey,
          (receivedMap.get(lineKey) || 0) +
            Number(item.quantityReceived) -
            Number(item.quantityRejected || 0),
        );
        rejectedMap.set(
          lineKey,
          (rejectedMap.get(lineKey) || 0) + Number(item.quantityRejected || 0),
        );
      });
    });

    const invoicedMap = new Map<string, number>();
    invoices.forEach((invoice) => {
      if (invoice.status === VendorInvoiceStatus.CANCELLED) return;
      invoice.items?.forEach((item: VendorInvoiceItem) => {
        const lineKey = resolveLineKey(
          item.productId,
          item.purchaseOrderItem_id,
        );
        if (!lineKey) return;
        invoicedMap.set(
          lineKey,
          (invoicedMap.get(lineKey) || 0) + Number(item.quantity),
        );
      });
    });

    const matchingLines = po.items.map((poItem) => {
      const receivedQty = receivedMap.get(poItem._id) || 0;
      const rejectedQty = rejectedMap.get(poItem._id) || 0;
      const invoicedQty = invoicedMap.get(poItem._id) || 0;

      return {
        purchaseOrderItem_id: poItem._id,
        productId: poItem.productId,
        productName: poItem.product?.vietnameseName,
        sku: poItem.product?.sku,
        orderedQty: Number(poItem.quantity),
        receivedQty,
        rejectedQty,
        invoicedQty,
        unitPrice: Number(poItem.unitPrice),
        poLineTotal: Number(poItem.totalAmount),
        varianceQty: Number(poItem.quantity) - receivedQty,
        openToInvoiceQty: Math.max(receivedQty - invoicedQty, 0),
      };
    });

    const totalInvoicedAmount = invoices
      .filter((invoice) => invoice.status !== VendorInvoiceStatus.CANCELLED)
      .reduce((acc, inv) => acc + Number(inv.totalAmount), 0);

    return {
      poNumber: po.poNumber,
      status: po.status,
      vendor: po.vendor,
      totalPoAmount: Number(po.totalAmount),
      totalInvoicedAmount,
      varianceAmount: Number(po.totalAmount) - totalInvoicedAmount,
      lines: matchingLines,
      documents: {
        grns: grns.map((g) => ({
          _id: g._id,
          number: g.grNumber,
          date: g.receivedDate,
        })),
        invoices: invoices.map((i) => ({
          _id: i._id,
          number: i.invoiceNumber,
          date: i.invoiceDate,
          amount: i.totalAmount,
        })),
      },
    };
  }

  async getStats() {
    const total = await this.poRepository.count();

    const pending = await this.poRepository.count({
      where: [
        { status: PurchaseOrderStatus.DRAFT },
        { status: PurchaseOrderStatus.PENDING_APPROVAL },
        { status: PurchaseOrderStatus.APPROVED },
        { status: PurchaseOrderStatus.SENT },
        { status: PurchaseOrderStatus.PARTIAL_RECEIPT },
      ],
    });

    const pos = await this.poRepository.find({
      select: ['totalAmount', 'currency'],
    });
    let totalVndValue = 0;
    for (const po of pos) {
      const vndAmount = await this.currenciesService.convertToBase(
        Number(po.totalAmount),
        po.currency,
      );
      totalVndValue += vndAmount;
    }

    return {
      total,
      pending,
      value: totalVndValue,
    };
  }
}
