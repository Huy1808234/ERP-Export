import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseRequest, PurchaseRequestStatus } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { Quotation, QuotationStatus } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoice, PIStatus } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';

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
  ) {}

  async getPendingApprovals() {
    // 1. Fetch Pending PRs
    const pendingPRs = await this.prRepository.find({
      where: { status: PurchaseRequestStatus.PENDING },
      relations: ['createdBy', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    // 2. Fetch Pending Quotations
    const pendingQuotations = await this.quotationRepository.find({
      where: { status: QuotationStatus.PENDING_APPROVAL },
      relations: ['createdBy', 'customer', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    // 3. Fetch Pending PIs
    const pendingPIs = await this.piRepository.find({
      where: { status: PIStatus.DRAFT }, // Giả định DRAFT của PI là chờ duyệt để gán số/gửi khách
      relations: ['createdBy', 'customer', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
    });

    // Unified format
    const unifiedPRs = pendingPRs.map(pr => ({
      id: pr.id, type: 'PURCHASE_REQUEST', number: pr.prNumber, description: pr.purpose,
      requestedBy: pr.createdBy?.name, requestedAt: pr.createdAt, data: pr
    }));

    const unifiedQuotations = pendingQuotations.map(q => ({
      id: q.id, type: 'QUOTATION', number: q.quotationNumber, description: `Báo giá cho ${q.customer?.name}`,
      requestedBy: q.createdBy?.name, requestedAt: q.createdAt, totalAmount: q.totalAmount, data: q
    }));

    const unifiedPIs = pendingPIs.map(pi => ({
      id: pi.id, type: 'PROFORMA_INVOICE', number: pi.piNumber, description: `PI cho ${pi.customer?.name}`,
      requestedBy: pi.createdBy?.name, requestedAt: pi.createdAt, totalAmount: pi.totalAmount, data: pi
    }));

    return [...unifiedPRs, ...unifiedQuotations, ...unifiedPIs];
  }

  async approve(id: string, type: string, user: any) {
    if (type === 'PURCHASE_REQUEST') {
      const pr = await this.prRepository.findOne({ where: { id } });
      if (pr) {
        pr.status = PurchaseRequestStatus.APPROVED;
        pr.approvedById = user.id;
        pr.approvedAt = new Date();
        return this.prRepository.save(pr);
      }
    } else if (type === 'QUOTATION') {
      const q = await this.quotationRepository.findOne({ where: { id } });
      if (q) {
        q.status = QuotationStatus.SENT; // Duyệt xong thì cho phép gửi
        q.approvedById = user.id;
        q.approvedAt = new Date();
        return this.quotationRepository.save(q);
      }
    } else if (type === 'PROFORMA_INVOICE') {
      const pi = await this.piRepository.findOne({ where: { id } });
      if (pi) {
        // PI có thể có flow phức tạp hơn, nhưng tạm thời là duyệt sang trạng thái sẵn sàng
        pi.status = PIStatus.SENT; 
        return this.piRepository.save(pi);
      }
    }
    return null;
  }

  async reject(id: string, type: string, reason: string, user: any) {
    if (type === 'PURCHASE_REQUEST') {
      const pr = await this.prRepository.findOne({ where: { id } });
      if (pr) {
        pr.status = PurchaseRequestStatus.REJECTED;
        pr.rejectionReason = reason;
        pr.approvedById = user.id;
        pr.approvedAt = new Date();
        return this.prRepository.save(pr);
      }
    } else if (type === 'QUOTATION') {
      const q = await this.quotationRepository.findOne({ where: { id } });
      if (q) {
        q.status = QuotationStatus.REJECTED;
        q.approvedById = user.id;
        q.approvedAt = new Date();
        return this.quotationRepository.save(q);
      }
    }
    return null;
  }
}
