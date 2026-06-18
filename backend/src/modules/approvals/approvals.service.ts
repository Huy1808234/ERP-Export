import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
} from '@/modules/purchase-requests/entities/purchase-request.entity';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/modules/purchase-orders/entities/purchase-order.entity';
import {
  Quotation,
  QuotationStatus,
} from '@/modules/quotations/entities/quotation.entity';
import {
  ProformaInvoice,
  PIStatus,
} from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import {
  TradeFinanceTransaction,
  TradeFinanceStatus,
} from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { TradeFinanceService } from '@/modules/trade-finance/trade-finance.service';
import {
  SalesContract,
  SalesContractStatus,
} from '@/modules/sales-contracts/entities/sales-contract.entity';
import { SalesContractsService } from '@/modules/sales-contracts/sales-contracts.service';
import {
  InventoryCount,
  InventoryCountStatus,
} from '@/modules/inventory/entities/inventory-count.entity';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { ApprovalMatrixService } from '@/modules/approval-matrix/approval-matrix.service';
import {
  ProductChangeRequest,
  ProductChangeRequestStatus,
} from '@/modules/products/entities/product-change-request.entity';
import { ProductsService } from '@/modules/products/products.service';
import { normalizeRoleName } from '@/common/auth/role-catalog';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(PurchaseRequest)
    private prRepository: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,
    @InjectRepository(ProformaInvoice)
    private piRepository: Repository<ProformaInvoice>,
    @InjectRepository(TradeFinanceTransaction)
    private tfRepository: Repository<TradeFinanceTransaction>,
    @InjectRepository(SalesContract)
    private scRepository: Repository<SalesContract>,
    @InjectRepository(InventoryCount)
    private inventoryCountRepository: Repository<InventoryCount>,
    @InjectRepository(ProductChangeRequest)
    private productChangeRequestRepository: Repository<ProductChangeRequest>,
    private tradeFinanceService: TradeFinanceService,
    private salesContractsService: SalesContractsService,
    private inventoryService: InventoryService,
    private approvalMatrixService: ApprovalMatrixService,
    private productsService: ProductsService,
  ) {}

  private getRoleName(user: any) {
    const role = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return normalizeRoleName(role);
  }

  private canApproveType(type: string, user: any) {
    const roleName = this.getRoleName(user);

    if (roleName === 'ADMIN') {
      return true;
    }

    if (type === 'INVENTORY_COUNT') {
      return ['MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'].includes(roleName);
    }

    if (type === 'APPROVAL_WORKFLOW') {
      return true;
    }

    if (type === 'PRODUCT_CHANGE_REQUEST') {
      return [
        'DIRECTOR',
        'MANAGER',
        'PURCHASING',
        'ACCOUNTANT',
        'CHIEF_ACCOUNTANT',
      ].includes(roleName);
    }

    if (type === 'TRADE_FINANCE') {
      return ['MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT'].includes(roleName);
    }

    return roleName === 'MANAGER';
  }

  private assertCanApproveType(type: string, user: any) {
    if (!this.canApproveType(type, user)) {
      throw new ForbiddenException(`Role is not allowed to approve ${type}`);
    }
  }

  async getPendingApprovals(user: any) {
    // 1. Fetch Pending PRs
    const pendingPRs = await this.prRepository.find({
      where: {
        status: PurchaseRequestStatus.PENDING,
        approvalWorkflowRequestId: IsNull(),
      },
      relations: ['createdBy', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    // PO now uses the generic approval matrix. It is surfaced below as
    // APPROVAL_WORKFLOW to avoid duplicate approvals and accidental DRAFT approval.
    const pendingPOs: PurchaseOrder[] = [];

    // 2. Fetch Pending Quotations
    const pendingQuotations = await this.quotationRepository.find({
      where: {
        status: QuotationStatus.PENDING_APPROVAL,
        approvalWorkflowRequestId: IsNull(),
      },
      relations: ['createdBy', 'customer', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    // 3. Fetch Pending PIs
    const pendingPIs = await this.piRepository.find({
      where: {
        status: PIStatus.PENDING_APPROVAL,
        approvalWorkflowRequestId: IsNull(),
      },
      relations: ['createdBy', 'customer', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    // Sales Contracts now use the generic approval matrix. Keeping the legacy
    // list empty prevents accidental approval/stock reservation from DRAFT.
    const pendingContracts: SalesContract[] = [];

    // 4. Fetch Pending Trade Finance Transactions
    const pendingTF = await this.tfRepository.find({
      where: { status: TradeFinanceStatus.PENDING },
      relations: [
        'createdBy',
        'salesContract',
        'vendorInvoice',
        'salesContract.buyer',
        'vendorInvoice.vendor',
      ],
      order: { createdAt: 'DESC' },
    });

    const pendingInventoryCounts = await this.inventoryCountRepository.find({
      where: {
        status: InventoryCountStatus.SUBMITTED,
        approvalWorkflowRequestId: IsNull(),
      },
      relations: ['items', 'items.product'],
      order: { submittedAt: 'DESC', createdAt: 'DESC' },
    });

    const pendingApprovalWorkflows =
      await this.approvalMatrixService.findPendingForUser(user);

    const pendingProductChanges =
      await this.productChangeRequestRepository.find({
        where: {
          status: ProductChangeRequestStatus.PENDING_APPROVAL,
          approvalWorkflowRequestId: IsNull(),
        },
        relations: { product: true },
        order: { createdAt: 'DESC' },
      });

    // Unified format
    const unifiedPRs = pendingPRs.map((pr) => ({
      _id: pr._id,
      type: 'PURCHASE_REQUEST',
      number: pr.prNumber,
      description: pr.purpose,
      requestedBy: pr.createdBy?.name,
      requestedAt: pr.createdAt,
      data: pr,
    }));

    const unifiedPOs = pendingPOs.map((po) => ({
      _id: po._id,
      type: 'PURCHASE_ORDER',
      number: po.poNumber,
      description: `PO cho ${po.vendor?.name}`,
      requestedBy: po.createdBy?.name,
      requestedAt: po.createdAt,
      totalAmount: po.totalAmount,
      data: po,
    }));

    const unifiedQuotations = pendingQuotations.map((q) => ({
      _id: q._id,
      type: 'QUOTATION',
      number: q.quotationNumber,
      description: `Báo giá cho ${q.customer?.name}`,
      requestedBy: q.createdBy?.name,
      requestedAt: q.createdAt,
      totalAmount: q.totalAmount,
      data: q,
    }));

    const unifiedPIs = pendingPIs.map((pi) => ({
      _id: pi._id,
      type: 'PROFORMA_INVOICE',
      number: pi.piNumber,
      description: `PI cho ${pi.customer?.name}`,
      requestedBy: pi.createdBy?.name,
      requestedAt: pi.createdAt,
      totalAmount: pi.totalAmount,
      data: pi,
    }));

    const unifiedContracts = pendingContracts.map((sc) => ({
      _id: sc._id,
      type: 'SALES_CONTRACT',
      number: sc.contractNumber,
      description: `Hợp đồng cho ${sc.buyer?.name}`,
      requestedBy: 'System',
      requestedAt: sc.createdAt,
      totalAmount: sc.totalAmountVnd || sc.totalAmount,
      data: sc,
    }));

    const unifiedTF = pendingTF.map((tf) => {
      const isIncome = !!tf.salesContract;
      const partnerName = isIncome
        ? tf.salesContract?.buyer?.name
        : tf.vendorInvoice?.vendor?.name;
      const description = isIncome
        ? `Thu tiền HĐ: ${tf.salesContract?.contractNumber}`
        : `Thanh toán HĐ: ${tf.vendorInvoice?.invoiceNumber || 'Gộp'}`;
      return {
        _id: tf._id,
        type: 'TRADE_FINANCE',
        number: tf.bankReference || 'TFT-NEW',
        description: `${description} (${partnerName})`,
        requestedBy: tf.createdBy?.name,
        requestedAt: tf.createdAt,
        totalAmount: tf.amount,
        data: tf,
      };
    });

    const unifiedInventoryCounts = pendingInventoryCounts.map((count) => {
      const totalVarianceValue = (count.items || []).reduce(
        (sum, item) => sum + Math.abs(Number(item.varianceValue || 0)),
        0,
      );

      return {
        _id: count._id,
        type: 'INVENTORY_COUNT',
        number: count.countNumber,
        description: `Kiểm kê kho ${count.warehouseName}`,
        requestedBy: count.submittedByUsername || count.createdByUsername,
        requestedAt: count.submittedAt || count.createdAt,
        totalAmount: totalVarianceValue,
        data: count,
      };
    });

    const unifiedApprovalWorkflows = pendingApprovalWorkflows.map(
      (request) => ({
        _id: request._id,
        type: 'APPROVAL_WORKFLOW',
        number: request.documentNumber || request.title,
        description: request.title,
        requestedBy: request.requesterUsername,
        requestedAt: request.createdAt,
        totalAmount: request.amountVnd,
        data: request,
      }),
    );

    const unifiedProductChanges = pendingProductChanges.map((request) => ({
      _id: request._id,
      type: 'PRODUCT_CHANGE_REQUEST',
      number: request.requestNumber,
      description: `Äá»•i thÃ´ng tin sáº£n pháº©m ${request.product?.sku || request.productId}`,
      requestedBy: request.requestedByUsername,
      requestedAt: request.requestedAt,
      totalAmount: 0,
      data: request,
    }));

    return [
      ...unifiedPRs,
      ...unifiedPOs,
      ...unifiedQuotations,
      ...unifiedPIs,
      ...unifiedContracts,
      ...unifiedTF,
      ...unifiedInventoryCounts,
      ...unifiedApprovalWorkflows,
      ...unifiedProductChanges,
    ]
      .filter((item) => this.canApproveType(item.type, user))
      .sort(
        (a, b) =>
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
      );
  }

  async approve(id: string, type: string, user: any) {
    this.assertCanApproveType(type, user);

    if (type === 'PURCHASE_REQUEST') {
      const pr = await this.prRepository.findOne({ where: { _id: id } });
      if (pr) {
        pr.status = PurchaseRequestStatus.APPROVED;
        pr.approvedByUsername = user.username;
        pr.approvedAt = new Date();
        return this.prRepository.save(pr);
      }
    } else if (type === 'QUOTATION') {
      const q = await this.quotationRepository.findOne({ where: { _id: id } });
      if (q) {
        q.status = QuotationStatus.SENT; // Duyệt xong thì cho phép gửi
        q.approvedByUsername = user.username;
        q.approvedAt = new Date();
        return this.quotationRepository.save(q);
      }
    } else if (type === 'PROFORMA_INVOICE') {
      const pi = await this.piRepository.findOne({ where: { _id: id } });
      if (pi) {
        pi.status = PIStatus.SENT;
        pi.approvedByUsername = user.username;
        pi.approvedAt = new Date();
        pi.rejectedByUsername = null;
        pi.rejectedAt = null;
        pi.rejectionReason = null;
        return this.piRepository.save(pi);
      }
    } else if (type === 'PURCHASE_ORDER') {
      const po = await this.poRepository.findOne({ where: { _id: id } });
      if (po) {
        po.status = PurchaseOrderStatus.SENT;
        return this.poRepository.save(po);
      }
    } else if (type === 'SALES_CONTRACT') {
      return this.salesContractsService.confirmContract(id);
    } else if (type === 'TRADE_FINANCE') {
      const tf = await this.tfRepository.findOne({ where: { _id: id } });
      if (tf) {
        const approveStatus = tf.salesContractId
          ? TradeFinanceStatus.RECEIVED
          : TradeFinanceStatus.PAID;
        return this.tradeFinanceService.updateTransactionStatus(
          id,
          approveStatus,
          user,
        );
      }
    } else if (type === 'INVENTORY_COUNT') {
      return this.inventoryService.approveInventoryCount(
        id,
        { approvalNote: 'Approved from approval center' },
        user,
      );
    } else if (type === 'APPROVAL_WORKFLOW') {
      return this.approvalMatrixService.approveRequest(
        id,
        { note: 'Approved from approval center' },
        user,
      );
    } else if (type === 'PRODUCT_CHANGE_REQUEST') {
      return this.productsService.approveChangeRequest(
        id,
        { note: 'Approved from approval center' },
        user,
      );
    }
    return null;
  }

  async reject(id: string, type: string, reason: string, user: any) {
    this.assertCanApproveType(type, user);
    const rejectionReason = String(reason || '').trim();
    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    if (type === 'PURCHASE_REQUEST') {
      const pr = await this.prRepository.findOne({ where: { _id: id } });
      if (pr) {
        pr.status = PurchaseRequestStatus.REJECTED;
        pr.rejectionReason = rejectionReason;
        pr.approvedByUsername = user.username;
        pr.approvedAt = new Date();
        return this.prRepository.save(pr);
      }
    } else if (type === 'QUOTATION') {
      const q = await this.quotationRepository.findOne({ where: { _id: id } });
      if (q) {
        q.status = QuotationStatus.REJECTED;
        q.note = [q.note, `Rejected: ${rejectionReason}`]
          .filter(Boolean)
          .join('\n');
        q.rejectedByUsername = user.username;
        q.rejectedAt = new Date();
        q.rejectionReason = rejectionReason;
        return this.quotationRepository.save(q);
      }
    } else if (type === 'PROFORMA_INVOICE') {
      const pi = await this.piRepository.findOne({ where: { _id: id } });
      if (pi) {
        pi.status = PIStatus.REJECTED;
        pi.note = [pi.note, `Rejected: ${rejectionReason}`]
          .filter(Boolean)
          .join('\n');
        pi.rejectedByUsername = user.username;
        pi.rejectedAt = new Date();
        pi.rejectionReason = rejectionReason;
        return this.piRepository.save(pi);
      }
    } else if (type === 'PURCHASE_ORDER') {
      const po = await this.poRepository.findOne({ where: { _id: id } });
      if (po) {
        po.status = PurchaseOrderStatus.CANCELLED;
        po.note = [po.note, `Rejected: ${rejectionReason}`]
          .filter(Boolean)
          .join('\n');
        return this.poRepository.save(po);
      }
    } else if (type === 'SALES_CONTRACT') {
      const sc = await this.scRepository.findOne({ where: { _id: id } });
      if (sc) {
        sc.status = SalesContractStatus.CANCELLED;
        sc.notes = [sc.notes, `Rejected: ${rejectionReason}`]
          .filter(Boolean)
          .join('\n');
        return this.scRepository.save(sc);
      }
    } else if (type === 'TRADE_FINANCE') {
      const tf = await this.tfRepository.findOne({ where: { _id: id } });
      if (tf) {
        return this.tradeFinanceService.updateTransactionStatus(
          id,
          TradeFinanceStatus.REJECTED,
          user,
        );
      }
    } else if (type === 'INVENTORY_COUNT') {
      return this.inventoryService.rejectInventoryCount(
        id,
        rejectionReason,
        user,
      );
    } else if (type === 'APPROVAL_WORKFLOW') {
      return this.approvalMatrixService.rejectRequest(
        id,
        { reason: rejectionReason },
        user,
      );
    } else if (type === 'PRODUCT_CHANGE_REQUEST') {
      return this.productsService.rejectChangeRequest(
        id,
        { reason: rejectionReason },
        user,
      );
    }
    return null;
  }
}
