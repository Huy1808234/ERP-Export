import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import {
  Brackets,
  In,
  IsNull,
  MoreThan,
  Not,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import Decimal from 'decimal.js';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import type {
  AuthenticatedUser,
  QueryParams,
} from '@/common/types/authenticated-user.type';
import {
  AccountReceivable,
  ARStatus,
} from '@/modules/account-receivables/entities/account-receivable.entity';
import { PaymentAllocation } from '@/modules/account-receivables/entities/payment-allocation.entity';
import { FilesService } from '@/modules/files/files.service';
import {
  Inquiry,
  InquiryLineItemSnapshot,
  InquiryStatus,
} from '@/modules/inquiries/entities/inquiry.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { PricingPoliciesService } from '@/modules/pricing-policies/pricing-policies.service';
import { Product } from '@/modules/products/entities/product.entity';
import { ProformaInvoice, PIStatus } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import {
  SalesContract,
  SalesContractStatus,
} from '@/modules/sales-contracts/entities/sales-contract.entity';
import {
  Shipment,
  ShipmentStatus,
} from '@/modules/shipments/entities/shipment.entity';
import { TradeFinanceService } from '@/modules/trade-finance/trade-finance.service';
import {
  Incoterm,
  Quotation,
  QuotationStatus,
} from '@/modules/quotations/entities/quotation.entity';
import {
  TradeFinanceStatus,
  TradeFinanceType,
} from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { AuditLog } from '@/modules/audit-logs/entities/audit-log.entity';
import { CreatePortalInquiryDto } from './dto/create-portal-inquiry.dto';
import {
  CreatePortalPaymentReceiptDto,
  PortalPaymentSource,
} from './dto/create-portal-payment-receipt.dto';
import { ReviewPortalPaymentReceiptDto } from './dto/review-portal-payment-receipt.dto';
import { CreatePortalSupportTicketDto } from './dto/create-portal-support-ticket.dto';
import { CreatePortalSupportMessageDto } from './dto/create-portal-support-message.dto';
import { UpdatePortalSupportTicketStatusDto } from './dto/update-portal-support-ticket-status.dto';
import {
  PortalNotification,
  PortalNotificationSeverity,
  PortalNotificationType,
} from './entities/portal-notification.entity';
import {
  PortalPaymentReceipt,
  PortalReceiptAuditEvent,
  PortalReceiptStatus,
  PortalReceiptType,
} from './entities/portal-payment-receipt.entity';
import {
  PortalAttachment,
  PortalSupportTicket,
  PortalTicketAuditEvent,
  PortalTicketCategory,
  PortalTicketPriority,
  PortalTicketStatus,
} from './entities/portal-support-ticket.entity';
import {
  PortalMessageAuthorType,
  PortalSupportMessage,
} from './entities/portal-support-message.entity';
import { RedisCacheService } from '@/common/cache/redis-cache.service';
import { renderPdfBuffer } from '@/common/pdfmake-server.util';
import {
  QueryCommercialDocumentDto,
  type CustomerDocumentSortField,
  type CustomerDocumentType,
} from './dto/query-commercial-document.dto';
import { RequestSignatureInvitationDto } from '@/modules/sales-contracts/dto/request-signature-invitation.dto';
import { SalesContractsService } from '@/modules/sales-contracts/sales-contracts.service';
import { CommercialInvoice } from '@/modules/commercial-invoices/entities/commercial-invoice.entity';

/**
 * Roles allowed for admin support ticket operations.
 */
const ADMIN_SUPPORT_ROLES = ['ADMIN', 'SALES', 'MANAGER', 'LOGISTICS'] as const;

/**
 * Safely extracts role name from AuthenticatedUser.
 * Returns null if no valid role can be determined.
 */
function extractRoleName(user: AuthenticatedUser): string | null {
  const { role, roleName } = user;

  // Priority: role (if string) > role.name > roleName
  if (typeof role === 'string') {
    return role;
  }

  if (role && typeof role === 'object' && 'name' in role) {
    return role.name || null;
  }

  return roleName || null;
}

/**
 * Checks if user has any of the allowed admin roles.
 */
function hasAdminRole(user: AuthenticatedUser): boolean {
  const userRole = extractRoleName(user);
  if (!userRole) return false;
  return ADMIN_SUPPORT_ROLES.includes(userRole as typeof ADMIN_SUPPORT_ROLES[number]);
}

type PortalBuyerUser = AuthenticatedUser & {
  username: string;
  partnerId: string;
};

type AgingBucket = 'CURRENT' | 'DUE_1_30' | 'DUE_31_60' | 'DUE_61_90' | 'OVERDUE_90';

type PortalStatementLine = {
  _id: string;
  invoiceNumber: string;
  salesContractId: string | null;
  commercialInvoice_id: string | null;
  invoiceDate: Date;
  dueDate: Date | null;
  amountForeign: number;
  paidAmountForeign: number;
  openAmountForeign: number;
  currency: string;
  exchangeRate: number;
  amountVnd: number;
  paidAmountVnd: number;
  openAmountVnd: number;
  status: ARStatus;
  allocations: PaymentAllocation[];
  // Phase 1: Aging & Cross-linking
  agingBucket: AgingBucket;
  daysOverdue: number;
  shipmentNumber: string | null;
  shipmentId: string | null;
  contractNumber: string | null;
  contractId: string | null;
  pdfUrl: string | null;
};

type PortalPricingQuery = QueryParams & {
  incoterm?: string;
  currency?: string;
  quantity?: string;
  search?: string;
  category?: string;
};

type PortalShipmentQuery = QueryParams & {
  current?: string;
  pageSize?: string;
  search?: string;
  status?: string;
};

type PortalInquiryLineInput = {
  product_id: string;
  quantity: number;
  targetPrice?: number | null;
  note?: string | null;
};

type PortalInquiryActor = {
  username: string;
  ipAddress?: string | null;
};

type CustomerDocumentKind =
  | 'QUOTATION'
  | 'SALES_CONTRACT'
  | 'PROFORMA_INVOICE'
  | 'ORDER';

type CustomerDocumentActionState = {
  canAccept: boolean;
  canReject: boolean;
  canRequestRevision: boolean;
  disabledReason: string | null;
};

type CustomerDocumentLineItem = {
  _id: string;
  product_id: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalAmount: number;
};

type CustomerDocumentAttachment = {
  _id: string;
  fileName: string;
  url: string | null;
};

type CustomerCommercialDocument = {
  _id: string;
  documentType: CustomerDocumentKind;
  documentNumber: string;
  lifecycleStage: string;
  status: string;
  documentDate: Date | string | null;
  expiryDate: Date | string | null;
  incoterm: string | null;
  currency: string;
  totalAmount: number;
  totalAmountVnd?: number | null;
  paymentTerms: string | null;
  shipmentStatus: string | null;
  isExpired: boolean;
  actions: CustomerDocumentActionState;
  lineItems: CustomerDocumentLineItem[];
  attachments: CustomerDocumentAttachment[];
  timeline: CustomerTimelineItem[];
  auditLogs: CustomerAuditLogItem[];
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  // Extended fields for detailed view
  buyerName?: string | null;
  buyerCountry?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  signatureStatus?: string | null;
  signingUrl?: string | null;
};

type CustomerAuditLogItem = {
  _id: string;
  action: string;
  username: string | null;
  createdAt: Date;
  oldValues: unknown;
  newValues: unknown;
};

type CustomerTimelineItem = {
  key: string;
  label: string;
  status: 'finish' | 'process' | 'wait' | 'error';
  date: Date | string | null;
  description: string | null;
};

type CommercialDocumentQuery = Required<
  Pick<QueryCommercialDocumentDto, 'type' | 'sortBy' | 'sortOrder' | 'current' | 'pageSize'>
> &
  Pick<QueryCommercialDocumentDto, 'search' | 'status'>;

type SortableDocumentValue = string | number;

const SHIPMENT_TIMELINE = [
  { status: ShipmentStatus.BOOKED, label: 'Booking confirmed' },
  { status: ShipmentStatus.LOADING, label: 'Cargo loading / stock issued' },
  { status: ShipmentStatus.CUSTOMS_CLEARED, label: 'Export customs cleared' },
  { status: ShipmentStatus.ON_BOARD, label: 'On board / departed' },
  { status: ShipmentStatus.ARRIVED, label: 'Arrived at destination' },
  { status: ShipmentStatus.CLOSED, label: 'Shipment closed' },
] as const;

const PORTAL_PROFILE_CACHE_TTL_SECONDS = 60;
const PORTAL_ORDERS_CACHE_TTL_SECONDS = 90;
const PORTAL_SHIPMENTS_CACHE_TTL_SECONDS = 45;
const PORTAL_PRICING_CACHE_TTL_SECONDS = 180;
const PORTAL_INQUIRIES_CACHE_TTL_SECONDS = 30;
const PORTAL_INQUIRY_IDEMPOTENCY_WINDOW_MS = 15_000;
const PORTAL_INQUIRY_RATE_LIMIT_WINDOW_MS = 60_000;
const PORTAL_INQUIRY_RATE_LIMIT_MAX = 5;
const QUOTATION_PORTAL_PUBLISHED_EVENT = 'quotation.portal_published';
const PORTAL_VISIBLE_QUOTATION_STATUSES = [
  QuotationStatus.SENT,
  QuotationStatus.ACCEPTED,
  QuotationStatus.REJECTED,
  QuotationStatus.CONVERTED,
  QuotationStatus.EXPIRED,
];

type QuotationPortalPublishedEvent = {
  quotation_id: string;
  buyer_id: string;
  quotationNumber: string;
  totalAmount: number;
  currency: string;
  publishedByUsername?: string | null;
};

@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(AccountReceivable)
    private readonly arRepository: Repository<AccountReceivable>,
    @InjectRepository(Inquiry)
    private readonly inquiryRepository: Repository<Inquiry>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ProformaInvoice)
    private readonly proformaInvoiceRepository: Repository<ProformaInvoice>,
    @InjectRepository(PortalPaymentReceipt)
    private readonly receiptRepository: Repository<PortalPaymentReceipt>,
    @InjectRepository(PortalSupportTicket)
    private readonly ticketRepository: Repository<PortalSupportTicket>,
    @InjectRepository(PortalSupportMessage)
    private readonly messageRepository: Repository<PortalSupportMessage>,
    @InjectRepository(PortalNotification)
    private readonly notificationRepository: Repository<PortalNotification>,
    @InjectRepository(SalesContract)
    private readonly salesContractRepository: Repository<SalesContract>,
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(CommercialInvoice)
    private readonly commercialInvoiceRepository: Repository<CommercialInvoice>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly filesService: FilesService,
    private readonly pricingPoliciesService: PricingPoliciesService,
    private readonly tradeFinanceService: TradeFinanceService,
    private readonly salesContractsService: SalesContractsService,
    private readonly cache: RedisCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async invalidateBuyerPortalCache(partnerId: string): Promise<void> {
    await this.cache.delByPattern(`mini-erp:portal:*:${partnerId}:*`);
  }

  private assertBuyer(user?: AuthenticatedUser): PortalBuyerUser {
    const username = user?.username?.trim();
    const partnerId = user?.partnerId?.trim();
    if (!username || !partnerId) {
      throw new BadRequestException(
        'Portal user is not linked to a buyer account',
      );
    }

    return { ...user, username, partnerId };
  }

  private async getBuyerPartner(buyer: PortalBuyerUser) {
    const partner = await this.partnerRepository.findOne({
      where: { _id: buyer.partnerId },
    });
    if (!partner)
      throw new BadRequestException(
        'Buyer account is not linked to a valid partner',
      );
    return partner;
  }

  private normalizeIncoterm(value?: string): Incoterm {
    if (value && Object.values(Incoterm).includes(value as Incoterm)) {
      return value as Incoterm;
    }
    return Incoterm.FOB;
  }

  private normalizePositiveNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeInquiryLineInputs(
    dto: CreatePortalInquiryDto,
  ): PortalInquiryLineInput[] {
    const lines = dto.lineItems?.length
      ? dto.lineItems
      : dto.product_id
        ? [
            {
              product_id: dto.product_id,
              quantity: dto.quantity || 1,
              targetPrice: null,
              note: null,
            },
          ]
        : [];

    const normalizedLines = lines.map((line) => ({
      product_id: line.product_id.trim(),
      quantity: this.normalizePositiveNumber(line.quantity, 1),
      targetPrice:
        line.targetPrice === null || line.targetPrice === undefined
          ? null
          : this.normalizePositiveNumber(line.targetPrice, 0),
      note: this.normalizeOptionalText(line.note),
    }));

    if (!normalizedLines.length) {
      throw new BadRequestException('At least one inquiry line item is required');
    }

    if (normalizedLines.some((line) => !line.product_id)) {
      throw new BadRequestException('Every inquiry line must reference a product');
    }

    return normalizedLines;
  }

  private async resolvePortalInquiryLineSnapshots(
    lines: PortalInquiryLineInput[],
  ): Promise<InquiryLineItemSnapshot[]> {
    const productIds = [...new Set(lines.map((line) => line.product_id))];
    const products = await this.productRepository.find({
      where: { _id: In(productIds), isActive: true },
    });
    const productsBy_id = new Map(products.map((product) => [product._id, product]));

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products are not available for portal inquiry',
      );
    }

    return lines.map((line) => {
      const product = productsBy_id.get(line.product_id);
      if (!product) {
        throw new BadRequestException(
          'Product is not available for portal inquiry',
        );
      }

      return {
        product_id: product._id,
        productSnapshotName: product.englishName || product.vietnameseName,
        productSnapshotCode: product.sku,
        unitOfMeasure: product.unitOfMeasure || null,
        quantity: line.quantity,
        targetPrice: line.targetPrice ?? null,
        note: line.note ?? null,
      };
    });
  }

  private buildInquiryIdempotencyKey(input: {
    buyer: PortalBuyerUser;
    dto: CreatePortalInquiryDto;
    lines: PortalInquiryLineInput[];
  }): string {
    const normalizedPayload = {
      buyer_id: input.buyer.partnerId,
      incoterm: input.dto.incoterm || Incoterm.FOB,
      destinationPort: this.normalizeOptionalText(input.dto.destinationPort),
      expectedShipmentDate: input.dto.expectedShipmentDate || null,
      targetPriceCurrency:
        this.normalizeOptionalText(input.dto.targetPriceCurrency) || 'USD',
      note: this.normalizeOptionalText(input.dto.note),
      lines: [...input.lines].sort((a, b) =>
        a.product_id.localeCompare(b.product_id),
      ),
    };

    return createHash('sha256')
      .update(JSON.stringify(normalizedPayload))
      .digest('hex');
  }

  private async assertInquirySubmissionAllowed(
    buyer: PortalBuyerUser,
    idempotencyKey: string,
  ): Promise<Inquiry | null> {
    const duplicate = await this.inquiryRepository.findOne({
      where: {
        buyer_id: buyer.partnerId,
        idempotencyKey,
        createdAt: MoreThan(
          new Date(Date.now() - PORTAL_INQUIRY_IDEMPOTENCY_WINDOW_MS),
        ),
      },
      relations: ['product'],
    });
    if (duplicate) return duplicate;

    const recentCount = await this.inquiryRepository.count({
      where: {
        buyer_id: buyer.partnerId,
        createdAt: MoreThan(
          new Date(Date.now() - PORTAL_INQUIRY_RATE_LIMIT_WINDOW_MS),
        ),
      },
    });

    if (recentCount >= PORTAL_INQUIRY_RATE_LIMIT_MAX) {
      throw new BadRequestException(
        'Too many inquiry submissions. Please wait a minute and try again.',
      );
    }

    return null;
  }

  private async createInquiryNumber(date = new Date()): Promise<string> {
    const year = date.getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const count = await this.inquiryRepository
      .createQueryBuilder('inquiry')
      .where('inquiry.createdAt >= :yearStart', { yearStart })
      .andWhere('inquiry.createdAt < :yearEnd', { yearEnd })
      .getCount();

    return `INQ-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async resolvePortalContact(buyer: PortalBuyerUser, partner: Partner) {
    const user = await this.userRepository.findOne({
      where: { username: buyer.username },
    });

    return {
      email:
        this.normalizeOptionalText(partner.email) ||
        this.normalizeOptionalText(user?.email) ||
        `${buyer.username}@portal.local`,
      phone:
        this.normalizeOptionalText(user?.phone) ||
        this.normalizeOptionalText(partner.phone),
      contactName:
        this.normalizeOptionalText(partner.contactName) ||
        this.normalizeOptionalText(user?.name) ||
        buyer.username,
    };
  }

  private async resolveInquiryAssignee(): Promise<string | null> {
    const salesUser = await this.userRepository.findOne({
      where: { roleName: 'SALES_EXPORT', isActive: true },
      order: { createdAt: 'ASC' },
    });

    return salesUser?.username || null;
  }

  private emitInquirySubmitted(inquiry: Inquiry): void {
    this.eventEmitter.emit('notification.new_inquiry', {
      _id: inquiry._id,
      inquiryNumber: inquiry.inquiryNumber,
      customerName: inquiry.customerName,
      customerEmail: inquiry.customerEmail,
      quantity: inquiry.quantity,
      lineCount: inquiry.lineItems.length,
      assigned_sales_username: inquiry.assigned_sales_username,
      message: `Yêu cầu báo giá mới ${inquiry.inquiryNumber || inquiry._id} từ ${inquiry.customerName}`,
    });
  }

  private buildShipmentTimeline(shipment: Shipment) {
    const currentIndex = SHIPMENT_TIMELINE.findIndex(
      (item) => item.status === shipment.status,
    );
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

    return SHIPMENT_TIMELINE.map((item, index) => ({
      status: item.status,
      label: item.label,
      state:
        index < safeCurrentIndex
          ? 'finish'
          : index === safeCurrentIndex
            ? 'process'
            : 'wait',
      date: this.resolveShipmentTimelineDate(shipment, item.status),
    }));
  }

  private resolveShipmentTimelineDate(
    shipment: Shipment,
    status: ShipmentStatus,
  ) {
    if (status === ShipmentStatus.LOADING)
      return shipment.stockIssuedAt || shipment.etd || null;
    if (status === ShipmentStatus.ON_BOARD) return shipment.etd || null;
    if ([ShipmentStatus.ARRIVED, ShipmentStatus.CLOSED].includes(status))
      return shipment.eta || null;
    return null;
  }

  private createReceiptNumber(date = new Date()) {
    return `TTR-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${createOpaqueCode('receipt').split('_').pop()?.toUpperCase()}`;
  }

  private createTicketNumber(date = new Date()) {
    return `TKT-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${createOpaqueCode('ticket').split('_').pop()?.toUpperCase()}`;
  }

  private receiptAudit(
    action: PortalReceiptAuditEvent['action'],
    username: string,
    extra: Omit<PortalReceiptAuditEvent, 'action' | 'username' | 'at'> = {},
  ): PortalReceiptAuditEvent {
    return { action, username, at: new Date().toISOString(), ...extra };
  }

  private ticketAudit(
    action: PortalTicketAuditEvent['action'],
    username: string,
    extra: Omit<PortalTicketAuditEvent, 'action' | 'username' | 'at'> = {},
  ): PortalTicketAuditEvent {
    return { action, username, at: new Date().toISOString(), ...extra };
  }

  private async createNotification(input: {
    buyerId: string;
    type: PortalNotificationType;
    severity?: PortalNotificationSeverity;
    title: string;
    description: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    const notification = this.notificationRepository.create({
      buyerId: input.buyerId,
      type: input.type,
      severity: input.severity || PortalNotificationSeverity.INFO,
      title: input.title,
      description: input.description,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      readAt: null,
    });

    return this.notificationRepository.save(notification);
  }

  private normalizeCommercialDocumentQuery(
    query: QueryCommercialDocumentDto = {},
  ): CommercialDocumentQuery {
    return {
      search: this.normalizeOptionalText(query.search || null) || undefined,
      status: this.normalizeOptionalText(query.status || null) || undefined,
      type: query.type || 'ALL',
      sortBy: query.sortBy || 'documentDate',
      sortOrder: query.sortOrder || 'DESC',
      current: Number(query.current || 1),
      pageSize: Number(query.pageSize || 10),
    };
  }

  private isQuotationExpired(quotation: Quotation): boolean {
    if (quotation.status === QuotationStatus.EXPIRED) return true;
    if (!quotation.expiryDate) return false;
    return new Date(quotation.expiryDate).getTime() < Date.now();
  }

  private getQuotationActions(quotation: Quotation): CustomerDocumentActionState {
    const isExpired = this.isQuotationExpired(quotation);
    if (isExpired) {
      return {
        canAccept: false,
        canReject: false,
        canRequestRevision: false,
        disabledReason: 'Quotation has expired',
      };
    }

    const isSent = quotation.status === QuotationStatus.SENT;
    return {
      canAccept: isSent,
      canReject: isSent,
      canRequestRevision: isSent,
      disabledReason: isSent ? null : 'Action is not available in current status',
    };
  }

  private getProformaInvoiceActions(invoice: ProformaInvoice): CustomerDocumentActionState {
    const isSent = invoice.status === PIStatus.SENT;
    return {
      canAccept: isSent,
      canReject: isSent,
      canRequestRevision: false,
      disabledReason: isSent ? null : 'Action is not available in current status',
    };
  }

  private getReadOnlyActions(): CustomerDocumentActionState {
    return {
      canAccept: false,
      canReject: false,
      canRequestRevision: false,
      disabledReason: 'Read-only commercial document',
    };
  }

  private mapProductName(product?: Product | null): string {
    return (
      product?.englishName ||
      product?.vietnameseName ||
      product?.sku ||
      'N/A'
    );
  }

  private mapQuotationLineItems(quotation: Quotation): CustomerDocumentLineItem[] {
    return (quotation.items || []).map((item) => ({
      _id: item._id,
      product_id: item.productId || item.product?._id || null,
      productName: this.mapProductName(item.product),
      sku: item.product?.sku || null,
      quantity: Number(item.quantity || 0),
      unit: item.unit || item.product?.unitOfMeasure || null,
      unitPrice: Number(item.unitPrice || 0),
      totalAmount: Number(item.totalAmount || 0),
    }));
  }

  private mapSalesContractLineItems(
    contract: SalesContract,
  ): CustomerDocumentLineItem[] {
    return (contract.items || []).map((item) => ({
      _id: item._id,
      product_id: item.productId || item.product?._id || null,
      productName: this.mapProductName(item.product),
      sku: item.product?.sku || null,
      quantity: Number(item.quantity || 0),
      unit: item.product?.unitOfMeasure || null,
      unitPrice: Number(item.unitPrice || 0),
      totalAmount: Number(item.totalPrice || 0),
    }));
  }

  private mapProformaInvoiceLineItems(
    invoice: ProformaInvoice,
  ): CustomerDocumentLineItem[] {
    return (invoice.items || []).map((item) => ({
      _id: item._id,
      product_id: item.productId || item.product?._id || null,
      productName: this.mapProductName(item.product),
      sku: item.product?.sku || null,
      quantity: Number(item.quantity || 0),
      unit: item.unit || item.product?.unitOfMeasure || null,
      unitPrice: Number(item.unitPrice || 0),
      totalAmount: Number(item.totalAmount || 0),
    }));
  }

  private resolveSalesContractDocumentType(
    contract: SalesContract,
  ): CustomerDocumentKind {
    return ['CONFIRMED', 'SHIPPED', 'PAID'].includes(contract.status)
      ? 'ORDER'
      : 'SALES_CONTRACT';
  }

  private buildQuotationLifecycleStatus(quotation: Quotation): string {
    if (quotation.status === QuotationStatus.ACCEPTED) return 'Accepted';
    if (quotation.status === QuotationStatus.REJECTED) return 'Rejected';
    if (quotation.status === QuotationStatus.CONVERTED) return 'Sales Contract';
    if (this.isQuotationExpired(quotation)) return 'Expired';
    return 'Quotation';
  }

  private buildContractLifecycleStatus(contract: SalesContract): string {
    if (contract.status === 'PAID') return 'Completed';
    if (contract.status === 'SHIPPED') return 'Shipment';
    if (contract.status === 'CONFIRMED') return 'Payment';
    return 'Sales Contract';
  }

  private buildProformaLifecycleStatus(invoice: ProformaInvoice): string {
    if (invoice.isPaid) return 'Payment';
    return 'Proforma Invoice';
  }

  private buildQuotationTimeline(quotation: Quotation): CustomerTimelineItem[] {
    return [
      {
        key: 'quotation',
        label: 'Quotation issued',
        status:
          quotation.status === QuotationStatus.REJECTED ? 'error' : 'finish',
        date: quotation.issueDate || quotation.createdAt || null,
        description: quotation.quotationNumber,
      },
      {
        key: 'buyer_decision',
        label: 'Buyer decision',
        status:
          quotation.status === QuotationStatus.REJECTED
            ? 'error'
            : [QuotationStatus.ACCEPTED, QuotationStatus.CONVERTED].includes(
                  quotation.status,
                )
              ? 'finish'
              : 'process',
        date: quotation.rejectedAt || quotation.approvedAt || null,
        description: quotation.rejectionReason || null,
      },
      {
        key: 'sales_contract',
        label: 'Sales Contract',
        status:
          quotation.status === QuotationStatus.CONVERTED ? 'finish' : 'wait',
        date: null,
        description: null,
      },
    ];
  }

  private mapAuditLog(row: AuditLog): CustomerAuditLogItem {
    return {
      _id: row._id,
      action: row.action,
      username: row.username,
      createdAt: row.createdAt,
      oldValues: row.oldValues,
      newValues: row.newValues,
    };
  }

  private async findDocumentAuditLogs(
    tableName: string,
    recordId: string,
  ): Promise<CustomerAuditLogItem[]> {
    const logs = await this.auditRepository.find({
      where: { tableName, recordId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return logs.map((log) => this.mapAuditLog(log));
  }

  private async findDocumentAttachments(
    recordId: string,
  ): Promise<CustomerDocumentAttachment[]> {
    const fileAssets = await this.filesService.findByLinkedDocument(recordId);
    return fileAssets.map((asset) => ({
      _id: asset._id,
      fileName: asset.originalName || asset.fileName,
      url: asset.url || null,
    }));
  }

  private async writeCustomerAuditLog(input: {
    tableName: string;
    recordId: string;
    username: string;
    oldValues: unknown;
    newValues: unknown;
  }): Promise<void> {
    await this.auditRepository.save(
      this.auditRepository.create({
        tableName: input.tableName,
        recordId: input.recordId,
        action: 'UPDATE',
        oldValues: input.oldValues,
        newValues: input.newValues,
        username: input.username,
      }),
    );
  }

  private mapQuotationDocument(
    quotation: Quotation,
    timeline: CustomerTimelineItem[] = this.buildQuotationTimeline(quotation),
    auditLogs: CustomerAuditLogItem[] = [],
    attachments: CustomerDocumentAttachment[] = [],
  ): CustomerCommercialDocument {
    return {
      _id: quotation._id,
      documentType: 'QUOTATION',
      documentNumber: quotation.quotationNumber || quotation._id,
      lifecycleStage: this.buildQuotationLifecycleStatus(quotation),
      status: this.isQuotationExpired(quotation)
        ? QuotationStatus.EXPIRED
        : quotation.status,
      documentDate: quotation.issueDate || quotation.createdAt || null,
      expiryDate: quotation.expiryDate || null,
      incoterm: quotation.incoterm || null,
      currency: quotation.currency || 'USD',
      totalAmount: Number(quotation.totalAmount || 0),
      paymentTerms: quotation.paymentTerms || null,
      shipmentStatus: null,
      isExpired: this.isQuotationExpired(quotation),
      actions: this.getQuotationActions(quotation),
      lineItems: this.mapQuotationLineItems(quotation),
      attachments,
      timeline,
      auditLogs,
      createdAt: quotation.createdAt || null,
      updatedAt: quotation.updatedAt || null,
    };
  }

  private mapSalesContractDocument(
    contract: SalesContract,
    timeline: CustomerTimelineItem[] = [],
    auditLogs: CustomerAuditLogItem[] = [],
    attachments: CustomerDocumentAttachment[] = [],
  ): CustomerCommercialDocument {
    return {
      _id: contract._id,
      documentType: this.resolveSalesContractDocumentType(contract),
      documentNumber: contract.contractNumber || contract._id,
      lifecycleStage: this.buildContractLifecycleStatus(contract),
      status: contract.status,
      documentDate: contract.createdAt || null,
      expiryDate: contract.validUntil || null,
      incoterm: contract.incoterm || null,
      currency: contract.currencyCode || 'USD',
      totalAmount: Number(contract.totalAmount || 0),
      totalAmountVnd: contract.totalAmountVnd ? Number(contract.totalAmountVnd) : null,
      paymentTerms: contract.paymentTerms || null,
      shipmentStatus: contract.status === 'SHIPPED' ? 'SHIPPED' : null,
      isExpired: Boolean(
        contract.validUntil &&
          new Date(contract.validUntil).getTime() < Date.now(),
      ),
      actions: this.getReadOnlyActions(),
      lineItems: this.mapSalesContractLineItems(contract),
      attachments,
      timeline,
      auditLogs,
      createdAt: contract.createdAt || null,
      updatedAt: contract.updatedAt || null,
      // Extended fields
      buyerName: contract.buyer?.name || null,
      buyerCountry: contract.buyer?.country || null,
      deliveryDate: contract.deliveryDate || null,
      notes: contract.notes || null,
      signatureStatus: contract.signatureStatus || null,
    };
  }

  private mapProformaInvoiceDocument(
    invoice: ProformaInvoice,
    timeline: CustomerTimelineItem[] = [],
    auditLogs: CustomerAuditLogItem[] = [],
    attachments: CustomerDocumentAttachment[] = [],
  ): CustomerCommercialDocument {
    return {
      _id: invoice._id,
      documentType: 'PROFORMA_INVOICE',
      documentNumber: invoice.piNumber || invoice._id,
      lifecycleStage: this.buildProformaLifecycleStatus(invoice),
      status: invoice.status,
      documentDate: invoice.issueDate || invoice.createdAt || null,
      expiryDate: null,
      incoterm: invoice.incoterm || null,
      currency: invoice.currency || 'USD',
      totalAmount: Number(invoice.totalAmount || 0),
      paymentTerms: invoice.paymentTerms || null,
      shipmentStatus: invoice.isPaid ? 'PAYMENT_RECEIVED' : null,
      isExpired: false,
      actions: this.getProformaInvoiceActions(invoice),
      lineItems: this.mapProformaInvoiceLineItems(invoice),
      attachments,
      timeline,
      auditLogs,
      createdAt: invoice.createdAt || null,
      updatedAt: invoice.updatedAt || null,
    };
  }

  private applyCommercialDocumentFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    documentNumberField: string,
    query: CommercialDocumentQuery,
  ): void {
    if (query.status) {
      qb.andWhere(`${alias}.status = :status`, { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where(`${alias}.${documentNumberField} ILIKE :search`, {
              search: `%${query.search}%`,
            })
            .orWhere(`CAST(${alias}.status AS text) ILIKE :search`, {
              search: `%${query.search}%`,
            });
        }),
      );
    }
  }

  private sortCommercialDocuments(
    documents: CustomerCommercialDocument[],
    sortBy: CustomerDocumentSortField,
    sortOrder: 'ASC' | 'DESC' | 'asc' | 'desc',
  ): CustomerCommercialDocument[] {
    const multiplier = sortOrder.toUpperCase() === 'ASC' ? 1 : -1;
    const getValue = (
      document: CustomerCommercialDocument,
    ): SortableDocumentValue => {
      if (sortBy === 'documentNumber') return document.documentNumber;
      if (sortBy === 'status') return document.status;
      if (sortBy === 'totalAmount') return document.totalAmount;
      return document.documentDate
        ? new Date(document.documentDate).getTime()
        : 0;
    };

    return [...documents].sort((left, right) => {
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * multiplier;
      }

      return String(leftValue).localeCompare(String(rightValue)) * multiplier;
    });
  }

  @OnEvent(QUOTATION_PORTAL_PUBLISHED_EVENT)
  async handleQuotationPublishedForPortal(
    event: QuotationPortalPublishedEvent,
  ): Promise<void> {
    const existingNotification = await this.notificationRepository.findOne({
      where: {
        buyerId: event.buyer_id,
        referenceType: 'quotations',
        referenceId: event.quotation_id,
      },
    });

    if (!existingNotification) {
      await this.createNotification({
        buyerId: event.buyer_id,
        type: PortalNotificationType.DOCUMENT,
        severity: PortalNotificationSeverity.SUCCESS,
        title: `Quotation ${event.quotationNumber} is ready`,
        description: `Sales has published quotation ${event.quotationNumber} with total ${event.totalAmount.toLocaleString('en-US')} ${event.currency}.`,
        referenceType: 'quotations',
        referenceId: event.quotation_id,
      });
    }

    await this.invalidateBuyerPortalCache(event.buyer_id);
  }

  private calculateAgingBucket(
    dueDate: Date | null,
    isPaid: boolean,
  ): { bucket: AgingBucket; daysOverdue: number } {
    if (isPaid || !dueDate) {
      return { bucket: 'CURRENT' as AgingBucket, daysOverdue: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - due.getTime();
    const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) {
      return { bucket: 'CURRENT' as AgingBucket, daysOverdue: daysDiff };
    }

    if (daysDiff <= 30) {
      return { bucket: 'DUE_1_30' as AgingBucket, daysOverdue: daysDiff };
    }
    if (daysDiff <= 60) {
      return { bucket: 'DUE_31_60' as AgingBucket, daysOverdue: daysDiff };
    }
    if (daysDiff <= 90) {
      return { bucket: 'DUE_61_90' as AgingBucket, daysOverdue: daysDiff };
    }
    return { bucket: 'OVERDUE_90' as AgingBucket, daysOverdue: daysDiff };
  }

  private toStatementLine(
    row: AccountReceivable,
    commercialInvoiceById: Map<string, CommercialInvoice> = new Map(),
  ): PortalStatementLine {
    const amountForeign = new Decimal(row.amountForeign || 0);
    const paidAmountForeign = new Decimal(row.paidAmountForeign || 0);
    const amountVnd = new Decimal(row.amountVnd || 0);
    const paidAmountVnd = new Decimal(row.paidAmountVnd || 0);
    const isPaid = row.status === ARStatus.PAID || row.status === ARStatus.CANCELLED;
    const { bucket, daysOverdue } = this.calculateAgingBucket(row.dueDate, isPaid);
    const commercialInvoice = row.commercialInvoice_id
      ? commercialInvoiceById.get(row.commercialInvoice_id)
      : undefined;
    const shipment = commercialInvoice?.shipment;
    const salesContract = commercialInvoice?.salesContract || row.salesContract;

    return {
      _id: row._id,
      invoiceNumber: row.invoiceNumber,
      salesContractId: row.salesContractId,
      commercialInvoice_id: row.commercialInvoice_id,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      amountForeign: amountForeign.toNumber(),
      paidAmountForeign: paidAmountForeign.toNumber(),
      openAmountForeign: Decimal.max(
        amountForeign.minus(paidAmountForeign),
        0,
      ).toNumber(),
      currency: row.currency,
      exchangeRate: Number(row.exchangeRate || 1),
      amountVnd: amountVnd.toNumber(),
      paidAmountVnd: paidAmountVnd.toNumber(),
      openAmountVnd: Decimal.max(amountVnd.minus(paidAmountVnd), 0).toNumber(),
      status: row.status,
      allocations: row.allocations || [],
      // Phase 1: Aging & Cross-linking
      agingBucket: bucket,
      daysOverdue,
      shipmentNumber: shipment?.shipmentNumber || null,
      shipmentId: commercialInvoice?.shipment_id || null,
      contractNumber: salesContract?.contractNumber || null,
      contractId: commercialInvoice?.salesContract_id || row.salesContractId || null,
      pdfUrl: row.commercialInvoice_id ? `/api/v1/commercial-invoices/${row.commercialInvoice_id}/export-pdf` : null,
    };
  }

  async getProfile(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const cacheKey = this.cache.makeKey(`portal:profile:${buyer.partnerId}`, {
      username: buyer.username,
    });

    return this.cache.getOrSet(
      cacheKey,
      PORTAL_PROFILE_CACHE_TTL_SECONDS,
      async () => {
        const partner = await this.getBuyerPartner(buyer);
        const contact = await this.resolvePortalContact(buyer, partner);
        const openReceivables = await this.arRepository.find({
          where: { buyerId: buyer.partnerId },
        });
        const openBalance = openReceivables.reduce((sum, row) => {
          if ([ARStatus.PAID, ARStatus.CANCELLED].includes(row.status))
            return sum;
          return sum.plus(
            new Decimal(row.amountForeign || 0).minus(
              row.paidAmountForeign || 0,
            ),
          );
        }, new Decimal(0));

        return {
          user: {
            username: buyer.username,
            partnerId: buyer.partnerId,
            roleName: buyer.roleName || null,
          },
          partner,
          contact,
          finance: {
            openBalanceForeign: Decimal.max(openBalance, 0).toNumber(),
            openInvoiceCount: openReceivables.filter(
              (row) =>
                ![ARStatus.PAID, ARStatus.CANCELLED].includes(row.status),
            ).length,
            defaultCurrency: partner.defaultCurrency || 'USD',
            creditLimit: partner.creditLimit || 0,
            riskLevel: partner.riskLevel,
          },
        };
      },
    );
  }

  async findOrders(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const cacheKey = this.cache.makeKey(`portal:orders:${buyer.partnerId}`, {
      username: buyer.username,
    });

    return this.cache.getOrSet(
      cacheKey,
      PORTAL_ORDERS_CACHE_TTL_SECONDS,
      async () => {
        const [contracts, proformaInvoices, quotations] = await Promise.all([
          this.salesContractRepository.find({
            where: { buyerId: buyer.partnerId },
            relations: ['items', 'items.product'],
            order: { createdAt: 'DESC' },
          }),
          this.proformaInvoiceRepository.find({
            where: { customerId: buyer.partnerId },
            relations: ['items', 'items.product', 'salesContract'],
            order: { createdAt: 'DESC' },
          }),
          this.quotationRepository.find({
            where: {
              customerId: buyer.partnerId,
              status: In(PORTAL_VISIBLE_QUOTATION_STATUSES),
            },
            relations: ['items', 'items.product'],
            order: { createdAt: 'DESC' },
          }),
        ]);

        return {
          summary: {
            quotationCount: quotations.length,
            contractCount: contracts.length,
            proformaInvoiceCount: proformaInvoices.length,
            pendingSignatureCount: contracts.filter(
              (contract) =>
                ['PENDING_BUYER_SIGNATURE', 'BUYER_SIGNED'].includes(
                  contract.status,
                ) ||
                ['PENDING_BUYER', 'BUYER_SIGNED'].includes(
                  contract.signatureStatus,
                ),
            ).length,
            shippedCount: contracts.filter((contract) =>
              ['SHIPPED', 'PAID'].includes(contract.status),
            ).length,
          },
          quotations,
          contracts,
          proformaInvoices,
        };
      },
    );
  }

  async getCustomerOrdersSummary(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const orderStatuses = [
      SalesContractStatus.CONFIRMED,
      SalesContractStatus.SHIPPED,
      SalesContractStatus.PAID,
    ];
    const [
      quotationCount,
      contractCount,
      proformaInvoiceCount,
      orderCount,
      pendingSignatureCount,
      shippedCount,
      completedCount,
    ] = await Promise.all([
      this.quotationRepository.count({
        where: {
          customerId: buyer.partnerId,
          status: In(PORTAL_VISIBLE_QUOTATION_STATUSES),
        },
      }),
      this.salesContractRepository.count({
        where: { buyerId: buyer.partnerId },
      }),
      this.proformaInvoiceRepository.count({
        where: { customerId: buyer.partnerId },
      }),
      this.salesContractRepository.count({
        where: { buyerId: buyer.partnerId, status: In(orderStatuses) },
      }),
      this.salesContractRepository.count({
        where: {
          buyerId: buyer.partnerId,
          status: In([
            SalesContractStatus.PENDING_BUYER_SIGNATURE,
            SalesContractStatus.BUYER_SIGNED,
          ]),
        },
      }),
      this.salesContractRepository.count({
        where: {
          buyerId: buyer.partnerId,
          status: In([SalesContractStatus.SHIPPED, SalesContractStatus.PAID]),
        },
      }),
      this.salesContractRepository.count({
        where: { buyerId: buyer.partnerId, status: SalesContractStatus.PAID },
      }),
    ]);

    return {
      quotationCount,
      contractCount,
      proformaInvoiceCount,
      orderCount,
      pendingSignatureCount,
      shippedCount,
      completedCount,
    };
  }

  async findCommercialDocuments(
    user?: AuthenticatedUser,
    queryDto: QueryCommercialDocumentDto = {},
  ) {
    const buyer = this.assertBuyer(user);
    const query = this.normalizeCommercialDocumentQuery(queryDto);
    const current = Math.max(query.current, 1);
    const pageSize = Math.max(query.pageSize, 1);
    const skip = (current - 1) * pageSize;
    const fetchLimit = query.type === 'ALL' ? current * pageSize : pageSize;
    const fetchSkip = query.type === 'ALL' ? 0 : skip;
    const includeType = (type: CustomerDocumentType): boolean =>
      query.type === 'ALL' || query.type === type;
    const orderStatuses = [
      SalesContractStatus.CONFIRMED,
      SalesContractStatus.SHIPPED,
      SalesContractStatus.PAID,
    ];

    const documentResults: CustomerCommercialDocument[] = [];
    let total = 0;

    if (includeType('QUOTATION')) {
      const qb = this.quotationRepository
        .createQueryBuilder('quotation')
        .leftJoinAndSelect('quotation.items', 'quotation_items')
        .leftJoinAndSelect('quotation_items.product', 'quotation_product')
        .where('quotation.customerId = :buyerId', { buyerId: buyer.partnerId })
        .andWhere('quotation.status IN (:...statuses)', {
          statuses: PORTAL_VISIBLE_QUOTATION_STATUSES,
        });
      this.applyCommercialDocumentFilters(qb, 'quotation', 'quotationNumber', query);
      const count = await qb.getCount();
      total += count;
      const rows = await qb
        .orderBy(
          query.sortBy === 'documentNumber'
            ? 'quotation.quotationNumber'
            : query.sortBy === 'status'
              ? 'quotation.status'
              : query.sortBy === 'totalAmount'
                ? 'quotation.totalAmount'
                : 'quotation.issueDate',
          query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
        )
        .skip(fetchSkip)
        .take(fetchLimit)
        .getMany();
      documentResults.push(...rows.map((row) => this.mapQuotationDocument(row)));
    }

    if (includeType('SALES_CONTRACT') || includeType('ORDER')) {
      const qb = this.salesContractRepository
        .createQueryBuilder('contract')
        .leftJoinAndSelect('contract.items', 'contract_items')
        .leftJoinAndSelect('contract_items.product', 'contract_product')
        .where('contract.buyerId = :buyerId', { buyerId: buyer.partnerId });

      if (query.type === 'SALES_CONTRACT') {
        qb.andWhere('contract.status NOT IN (:...orderStatuses)', {
          orderStatuses,
        });
      }
      if (query.type === 'ORDER') {
        qb.andWhere('contract.status IN (:...orderStatuses)', {
          orderStatuses,
        });
      }

      this.applyCommercialDocumentFilters(qb, 'contract', 'contractNumber', query);
      const count = await qb.getCount();
      total += count;
      const rows = await qb
        .orderBy(
          query.sortBy === 'documentNumber'
            ? 'contract.contractNumber'
            : query.sortBy === 'status'
              ? 'contract.status'
              : query.sortBy === 'totalAmount'
                ? 'contract.totalAmount'
                : 'contract.createdAt',
          query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
        )
        .skip(fetchSkip)
        .take(fetchLimit)
        .getMany();
      documentResults.push(
        ...rows
          .filter((row) => {
            if (query.type === 'ALL') return true;
            return this.resolveSalesContractDocumentType(row) === query.type;
          })
          .map((row) => this.mapSalesContractDocument(row)),
      );
    }

    if (includeType('PROFORMA_INVOICE')) {
      const qb = this.proformaInvoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.items', 'invoice_items')
        .leftJoinAndSelect('invoice_items.product', 'invoice_product')
        .leftJoinAndSelect('invoice.salesContract', 'invoice_contract')
        .where('invoice.customerId = :buyerId', { buyerId: buyer.partnerId });
      this.applyCommercialDocumentFilters(qb, 'invoice', 'piNumber', query);
      const count = await qb.getCount();
      total += count;
      const rows = await qb
        .orderBy(
          query.sortBy === 'documentNumber'
            ? 'invoice.piNumber'
            : query.sortBy === 'status'
              ? 'invoice.status'
              : query.sortBy === 'totalAmount'
                ? 'invoice.totalAmount'
                : 'invoice.issueDate',
          query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
        )
        .skip(fetchSkip)
        .take(fetchLimit)
        .getMany();
      documentResults.push(
        ...rows.map((row) => this.mapProformaInvoiceDocument(row)),
      );
    }

    const sortedDocuments = this.sortCommercialDocuments(
      documentResults,
      query.sortBy,
      query.sortOrder,
    );
    const results =
      query.type === 'ALL'
        ? sortedDocuments.slice(skip, skip + pageSize)
        : sortedDocuments;

    return {
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
      summary: await this.getCustomerOrdersSummary(buyer),
    };
  }

  async findCustomerCommercialDocument(
    recordId: string,
    user?: AuthenticatedUser,
  ): Promise<CustomerCommercialDocument> {
    const buyer = this.assertBuyer(user);
    const quotation = await this.quotationRepository.findOne({
      where: {
        _id: recordId,
        customerId: buyer.partnerId,
        status: In(PORTAL_VISIBLE_QUOTATION_STATUSES),
      },
      relations: [
        'items',
        'items.product',
        'createdBy',
        'portOfLoadingPort',
        'portOfDischargePort',
      ],
    });

    if (quotation) {
      const [auditLogs, attachments] = await Promise.all([
        this.findDocumentAuditLogs('quotations', quotation._id),
        this.findDocumentAttachments(quotation._id),
      ]);
      return this.mapQuotationDocument(
        quotation,
        this.buildQuotationTimeline(quotation),
        auditLogs,
        attachments,
      );
    }

    const contract = await this.salesContractRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
      relations: ['items', 'items.product', 'proformaInvoice'],
    });

    if (contract) {
      const [timeline, auditLogs, attachments] = await Promise.all([
        this.findCustomerOrderTimeline(contract._id, buyer),
        this.findDocumentAuditLogs('sales_contracts', contract._id),
        this.findDocumentAttachments(contract._id),
      ]);
      return this.mapSalesContractDocument(
        contract,
        timeline,
        auditLogs,
        attachments,
      );
    }

    const invoice = await this.proformaInvoiceRepository.findOne({
      where: { _id: recordId, customerId: buyer.partnerId },
      relations: ['items', 'items.product', 'salesContract', 'quotation'],
    });

    if (invoice) {
      const [timeline, auditLogs, attachments] = await Promise.all([
        this.findCustomerOrderTimeline(invoice._id, buyer),
        this.findDocumentAuditLogs('proforma_invoices', invoice._id),
        this.findDocumentAttachments(invoice._id),
      ]);
      return this.mapProformaInvoiceDocument(
        invoice,
        timeline,
        auditLogs,
        attachments,
      );
    }

    throw new NotFoundException('Commercial document not found');
  }

  async findShipments(user?: AuthenticatedUser, query: PortalShipmentQuery = {}) {
    const buyer = this.assertBuyer(user);
    const current = Math.max(Number(query.current || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 50);
    const search = this.normalizeOptionalText(query.search);
    const statusFilter = this.normalizeOptionalText(query.status);
    const statuses = statusFilter
      ? statusFilter
          .split(',')
          .map((value) => value.trim())
          .filter((value): value is ShipmentStatus =>
            Object.values(ShipmentStatus).includes(value as ShipmentStatus),
          )
      : [];
    const cacheKey = this.cache.makeKey(`portal:shipments:${buyer.partnerId}`, {
      username: buyer.username,
      current,
      pageSize,
      search: search || '',
      status: statuses.join(','),
    });

    return this.cache.getOrSet(
      cacheKey,
      PORTAL_SHIPMENTS_CACHE_TTL_SECONDS,
      async () => {
        const qb = this.shipmentRepository
          .createQueryBuilder('shipment')
          .leftJoinAndSelect('shipment.salesContract', 'sales_contract')
          .leftJoinAndSelect('shipment.containers', 'containers')
          .where('"sales_contract"."buyerId" = :buyerId', {
            buyerId: buyer.partnerId,
          })
          .andWhere('shipment."deletedAt" IS NULL');

        if (statuses.length) {
          qb.andWhere('shipment.status IN (:...statuses)', { statuses });
        }

        if (search) {
          qb.andWhere(
            new Brackets((subQb) => {
              subQb
                .where('shipment."shipmentNumber" ILIKE :search', {
                  search: `%${search}%`,
                })
                .orWhere('shipment."bookingNumber" ILIKE :search', {
                  search: `%${search}%`,
                })
                .orWhere('shipment."blNumber" ILIKE :search', {
                  search: `%${search}%`,
                })
                .orWhere('shipment.pol ILIKE :search', {
                  search: `%${search}%`,
                })
                .orWhere('shipment.pod ILIKE :search', {
                  search: `%${search}%`,
                })
                .orWhere('sales_contract."contractNumber" ILIKE :search', {
                  search: `%${search}%`,
                });
            }),
          );
        }

        const [shipments, total] = await qb
          .orderBy('shipment.updatedAt', 'DESC')
          .skip((current - 1) * pageSize)
          .take(pageSize)
          .getManyAndCount();
        const statusRows = await this.shipmentRepository
          .createQueryBuilder('shipment')
          .leftJoin('shipment.salesContract', 'sales_contract')
          .select('shipment.status', 'status')
          .addSelect('COUNT(DISTINCT shipment._id)', 'total')
          .where('"sales_contract"."buyerId" = :buyerId', {
            buyerId: buyer.partnerId,
          })
          .andWhere('shipment."deletedAt" IS NULL')
          .groupBy('shipment.status')
          .getRawMany<{ status: ShipmentStatus; total: string }>();
        const statusCounts = Object.values(ShipmentStatus).reduce(
          (acc, status) => {
            const row = statusRows.find((item) => item.status === status);
            acc[status] = row ? Number(row.total) : 0;
            return acc;
          },
          {} as Record<ShipmentStatus, number>,
        );

        return {
          results: shipments.map((shipment) => ({
            ...shipment,
            timeline: this.buildShipmentTimeline(shipment),
          })),
          meta: {
            current,
            pageSize,
            pages: Math.ceil(total / pageSize),
            total,
          },
          summary: {
            total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
            statusCounts,
          },
        };
      },
    );
  }

  async findInquiries(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const cacheKey = this.cache.makeKey(`portal:inquiries:${buyer.partnerId}`, {
      username: buyer.username,
    });

    return this.cache.getOrSet(
      cacheKey,
      PORTAL_INQUIRIES_CACHE_TTL_SECONDS,
      async () => {
        const partner = await this.getBuyerPartner(buyer);
        const qb = this.inquiryRepository
          .createQueryBuilder('inquiry')
          .leftJoinAndSelect('inquiry.product', 'product')
          .where('inquiry."deletedAt" IS NULL')
          .orderBy('inquiry.createdAt', 'DESC');

        if (partner.email) {
          qb.andWhere(
            '(inquiry."buyer_id" = :buyerId OR inquiry."customerEmail" = :email OR inquiry."customerName" = :name)',
            {
              buyerId: buyer.partnerId,
              email: partner.email,
              name: partner.name,
            },
          );
        } else {
          qb.andWhere(
            '(inquiry."buyer_id" = :buyerId OR inquiry."customerName" = :name)',
            {
              buyerId: buyer.partnerId,
              name: partner.name,
            },
          );
        }

        return qb.getMany();
      },
    );
  }

  async createInquiry(
    dto: CreatePortalInquiryDto,
    user?: AuthenticatedUser,
    actor?: PortalInquiryActor,
  ) {
    const buyer = this.assertBuyer(user);
    const partner = await this.getBuyerPartner(buyer);
    const contact = await this.resolvePortalContact(buyer, partner);
    const lineInputs = this.normalizeInquiryLineInputs(dto);
    const idempotencyKey =
      this.normalizeOptionalText(dto.idempotencyKey) ||
      this.buildInquiryIdempotencyKey({ buyer, dto, lines: lineInputs });
    const duplicate = await this.assertInquirySubmissionAllowed(
      buyer,
      idempotencyKey,
    );
    if (duplicate) return duplicate;

    const lineItems = await this.resolvePortalInquiryLineSnapshots(lineInputs);
    const firstLine = lineItems[0];
    const incoterm = this.normalizeIncoterm(dto.incoterm);
    const assignedSalesUsername = await this.resolveInquiryAssignee();
    const customerPhone =
      this.normalizeOptionalText(dto.customerPhone) || contact.phone;
    const customerEmail =
      this.normalizeOptionalText(dto.contactEmail) || contact.email;
    const expectedShipmentDate = dto.expectedShipmentDate
      ? new Date(dto.expectedShipmentDate)
      : null;
    const inquiry = this.inquiryRepository.create({
      customerName: partner.name,
      customerEmail,
      customerPhone: customerPhone || undefined,
      buyer_id: buyer.partnerId,
      productId: firstLine.product_id,
      productSnapshotName: firstLine.productSnapshotName || undefined,
      productSnapshotCode: firstLine.productSnapshotCode || undefined,
      lineItems,
      quantity: firstLine.quantity,
      incoterm,
      destinationPort: this.normalizeOptionalText(dto.destinationPort),
      expectedShipmentDate,
      targetPriceCurrency:
        this.normalizeOptionalText(dto.targetPriceCurrency) ||
        partner.defaultCurrency ||
        'USD',
      note: this.normalizeOptionalText(dto.note) || undefined,
      status: InquiryStatus.SUBMITTED,
      inquiryNumber: await this.createInquiryNumber(),
      assigned_sales_username: assignedSalesUsername,
      created_by_username: actor?.username || buyer.username,
      sourceIp: actor?.ipAddress || null,
      idempotencyKey,
      requestSnapshot: {
        buyer: {
          _id: partner._id,
          name: partner.name,
          country: partner.country,
          region: partner.region,
          defaultCurrency: partner.defaultCurrency,
        },
        contact,
        lineItems,
        incoterm,
        destinationPort: this.normalizeOptionalText(dto.destinationPort),
        expectedShipmentDate: dto.expectedShipmentDate || null,
      },
      auditTrail: [
        {
          action: 'SUBMITTED',
          username: actor?.username || buyer.username,
          at: new Date().toISOString(),
          ipAddress: actor?.ipAddress || null,
        },
      ],
      isRead: false,
    });

    const saved = await this.inquiryRepository.save(inquiry);
    this.emitInquirySubmitted(saved);
    await this.createNotification({
      buyerId: buyer.partnerId,
      type: PortalNotificationType.SYSTEM,
      severity: PortalNotificationSeverity.INFO,
      title: 'Inquiry submitted',
      description: `${saved.inquiryNumber || saved._id} has been sent to sales with ${lineItems.length} line item(s).`,
      referenceType: 'product_inquiries',
      referenceId: saved._id,
    });
    await this.invalidateBuyerPortalCache(buyer.partnerId);

    return this.inquiryRepository.findOne({
      where: { _id: saved._id },
      relations: ['product'],
    });
  }

  async findPricing(user?: AuthenticatedUser, query: PortalPricingQuery = {}) {
    const buyer = this.assertBuyer(user);
    const quantity = this.normalizePositiveNumber(query.quantity, 1);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const category =
      typeof query.category === 'string' ? query.category.trim() : '';
    const cacheKey = this.cache.makeKey(`portal:pricing:${buyer.partnerId}`, {
      incoterm: query.incoterm,
      currency: query.currency,
      quantity,
      search,
      category,
    });

    return this.cache.getOrSet(
      cacheKey,
      PORTAL_PRICING_CACHE_TTL_SECONDS,
      async () => {
        const partner = await this.getBuyerPartner(buyer);
        const incoterm = this.normalizeIncoterm(query.incoterm);
        const currency = String(
          query.currency || partner.defaultCurrency || 'USD',
        ).toUpperCase();

        const qb = this.productRepository
          .createQueryBuilder('product')
          .where('product."isActive" = true')
          .orderBy('product.isBestseller', 'DESC')
          .addOrderBy('product.vietnameseName', 'ASC');

        if (search) {
          qb.andWhere(
            '(product.sku ILIKE :search OR product."vietnameseName" ILIKE :search OR product."englishName" ILIKE :search OR product."hsCode" ILIKE :search OR product.category ILIKE :search OR product.brand ILIKE :search OR product."originCountry" ILIKE :search)',
            { search: `%${search}%` },
          );
        }

        const categoryQb = this.productRepository
          .createQueryBuilder('product')
          .select('DISTINCT product.category', 'category')
          .where('product."isActive" = true')
          .andWhere('product.category IS NOT NULL')
          .andWhere("TRIM(product.category) != ''")
          .orderBy('product.category', 'ASC');

        if (search) {
          categoryQb.andWhere(
            '(product.sku ILIKE :search OR product."vietnameseName" ILIKE :search OR product."englishName" ILIKE :search OR product."hsCode" ILIKE :search OR product.category ILIKE :search OR product.brand ILIKE :search OR product."originCountry" ILIKE :search)',
            { search: `%${search}%` },
          );
        }

        if (category) {
          qb.andWhere('product.category = :category', { category });
        }

        const categoryRows = await categoryQb.getRawMany<{
          category: string | null;
        }>();
        const products = await qb.getMany();
        const rows = await Promise.all(
          products.map(async (product) => {
            try {
              const resolved = await this.pricingPoliciesService.resolvePrice({
                productId: product._id,
                buyerId: buyer.partnerId,
                quantity,
                incoterm,
                currency,
                country: partner.country || undefined,
                marketRegion: partner.region || undefined,
              });

              return {
                product,
                unitPrice: resolved.unitPrice,
                currency: resolved.currency,
                incoterm,
                source: resolved.source,
                pricingPolicy_id: resolved.pricingPolicyId,
                quantity,
              };
            } catch {
              return {
                product,
                unitPrice: product.defaultExportPrice
                  ? Number(product.defaultExportPrice)
                  : null,
                currency: product.exportCurrency || currency,
                incoterm,
                source: product.defaultExportPrice
                  ? 'PRODUCT_DEFAULT'
                  : 'CONTACT_SALES',
                pricingPolicy_id: null,
                quantity,
              };
            }
          }),
        );

        return {
          buyer: {
            _id: partner._id,
            name: partner.name,
            country: partner.country,
            region: partner.region,
            defaultCurrency: partner.defaultCurrency,
          },
          filters: { incoterm, currency, quantity, search, category },
          categories: categoryRows
            .map((row) => row.category)
            .filter((value): value is string => Boolean(value)),
          results: rows,
        };
      },
    );
  }

  async findProducts(user?: AuthenticatedUser, query: PortalPricingQuery = {}) {
    return this.findPricing(user, query);
  }

  async getStatement(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const receivables = await this.arRepository.find({
      where: { buyerId: buyer.partnerId },
      relations: ['salesContract', 'allocations'],
      order: { dueDate: 'ASC', invoiceDate: 'ASC' },
    });
    const commercialInvoiceIds = [
      ...new Set(
        receivables
          .map((row) => row.commercialInvoice_id)
          .filter((recordId): recordId is string => Boolean(recordId)),
      ),
    ];
    const commercialInvoices = commercialInvoiceIds.length
      ? await this.commercialInvoiceRepository.find({
          where: { _id: In(commercialInvoiceIds), buyer_id: buyer.partnerId },
          relations: ['shipment', 'salesContract'],
        })
      : [];
    const commercialInvoiceById = new Map(
      commercialInvoices.map((invoice) => [invoice._id, invoice]),
    );
    const receipts = await this.findPaymentReceipts(buyer);
    const lines = receivables.map((row) => this.toStatementLine(row, commercialInvoiceById));
    
    // Calculate aging buckets
    const agingSummary = {
      agingCurrent: new Decimal(0),
      agingDue1to30: new Decimal(0),
      agingDue31to60: new Decimal(0),
      agingDue61to90: new Decimal(0),
      agingOverdue90: new Decimal(0),
    };
    
    const summary = lines.reduce(
      (acc, line) => {
        acc.totalForeign = acc.totalForeign.plus(line.amountForeign);
        acc.paidForeign = acc.paidForeign.plus(line.paidAmountForeign);
        acc.openForeign = acc.openForeign.plus(line.openAmountForeign);
        acc.totalVnd = acc.totalVnd.plus(line.amountVnd);
        acc.paidVnd = acc.paidVnd.plus(line.paidAmountVnd);
        acc.openVnd = acc.openVnd.plus(line.openAmountVnd);
        
        // Accumulate aging buckets for open invoices only
        if (line.openAmountForeign > 0) {
          switch (line.agingBucket) {
            case 'CURRENT':
              acc.agingCurrent = acc.agingCurrent.plus(line.openAmountForeign);
              break;
            case 'DUE_1_30':
              acc.agingDue1to30 = acc.agingDue1to30.plus(line.openAmountForeign);
              break;
            case 'DUE_31_60':
              acc.agingDue31to60 = acc.agingDue31to60.plus(line.openAmountForeign);
              break;
            case 'DUE_61_90':
              acc.agingDue61to90 = acc.agingDue61to90.plus(line.openAmountForeign);
              break;
            case 'OVERDUE_90':
              acc.agingOverdue90 = acc.agingOverdue90.plus(line.openAmountForeign);
              break;
          }
        }
        return acc;
      },
      {
        totalForeign: new Decimal(0),
        paidForeign: new Decimal(0),
        openForeign: new Decimal(0),
        totalVnd: new Decimal(0),
        paidVnd: new Decimal(0),
        openVnd: new Decimal(0),
        ...agingSummary,
      },
    );

    return {
      buyerId: buyer.partnerId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalForeign: summary.totalForeign.toNumber(),
        paidForeign: summary.paidForeign.toNumber(),
        openForeign: summary.openForeign.toNumber(),
        totalVnd: summary.totalVnd.toNumber(),
        paidVnd: summary.paidVnd.toNumber(),
        openVnd: summary.openVnd.toNumber(),
        openInvoiceCount: lines.filter((line) => line.openAmountForeign > 0)
          .length,
        pendingReceiptCount: receipts.filter(
          (receipt) => receipt.status === PortalReceiptStatus.SUBMITTED,
        ).length,
        // Phase 1: Aging buckets
        agingCurrent: summary.agingCurrent.toNumber(),
        agingDue1to30: summary.agingDue1to30.toNumber(),
        agingDue31to60: summary.agingDue31to60.toNumber(),
        agingDue61to90: summary.agingDue61to90.toNumber(),
        agingOverdue90: summary.agingOverdue90.toNumber(),
      },
      lines,
      receipts,
    };
  }

  async exportStatementCsv(user?: AuthenticatedUser) {
    const statement = await this.getStatement(user);
    const rows: Array<Array<string | number | null>> = [
      ['statement_generated_at', statement.generatedAt],
      ['buyer_id', statement.buyerId],
      [],
      ['summary', 'totalForeign', statement.summary.totalForeign],
      ['summary', 'paidForeign', statement.summary.paidForeign],
      ['summary', 'openForeign', statement.summary.openForeign],
      ['summary', 'openInvoiceCount', statement.summary.openInvoiceCount],
      [],
      [
        'invoiceNumber',
        'invoiceDate',
        'dueDate',
        'currency',
        'amountForeign',
        'paidAmountForeign',
        'openAmountForeign',
        'status',
      ],
      ...statement.lines.map((line) => [
        line.invoiceNumber,
        line.invoiceDate
          ? new Date(line.invoiceDate).toISOString().slice(0, 10)
          : null,
        line.dueDate ? new Date(line.dueDate).toISOString().slice(0, 10) : null,
        line.currency,
        line.amountForeign,
        line.paidAmountForeign,
        line.openAmountForeign,
        line.status,
      ]),
      [],
      [
        'receiptNumber',
        'receiptType',
        'status',
        'amount',
        'currency',
        'bankReference',
        'submittedAt',
      ],
      ...statement.receipts.map((receipt) => [
        receipt.receiptNumber,
        receipt.receiptType,
        receipt.status,
        receipt.amount,
        receipt.currency,
        receipt.bankReference,
        receipt.submittedAt
          ? new Date(receipt.submittedAt).toISOString()
          : null,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value =
              cell === null || cell === undefined ? '' : String(cell);
            return /[",\n]/.test(value)
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(','),
      )
      .join('\n');

    return Buffer.from(`\uFEFF${csv}`, 'utf8');
  }

  async findPaymentReceipts(user?: AuthenticatedUser | PortalBuyerUser) {
    const buyer = this.assertBuyer(user);
    return this.receiptRepository.find({
      where: { buyerId: buyer.partnerId },
      relations: ['fileAsset', 'accountReceivable', 'salesContract'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPaymentReceiptById(
    recordId: string,
    user?: AuthenticatedUser | PortalBuyerUser,
  ) {
    const buyer = this.assertBuyer(user);
    const receipt = await this.receiptRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
      relations: ['fileAsset', 'accountReceivable', 'salesContract'],
    });
    if (!receipt) {
      throw new NotFoundException(`Payment receipt ${recordId} not found`);
    }
    return receipt;
  }

  async createPaymentReceipt(
    dto: CreatePortalPaymentReceiptDto,
    user?: AuthenticatedUser,
  ) {
    const buyer = this.assertBuyer(user);

    // For VietQR payments (no file required), allow optional fileAsset
    let fileAsset: { _id: string } | null = null;
    if (dto.fileAsset_id) {
      const asset = await this.filesService.findOne(dto.fileAsset_id);
      fileAsset = asset ? { _id: asset._id } : null;
    }

    let accountReceivable: AccountReceivable | null = null;
    let salesContractId = dto.salesContractId || null;
    const receiptAmount = new Decimal(dto.amount || 0);
    if (receiptAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Receipt amount must be greater than zero');
    }

    const normalizedBankReference = (
      dto.bankReference ||
      dto.transferReference ||
      ''
    ).trim();
    if (!normalizedBankReference) {
      throw new BadRequestException(
        'Bank reference is required for T/T receipt reconciliation',
      );
    }

    const duplicateBankReference = await this.receiptRepository
      .createQueryBuilder('receipt')
      .where('receipt.buyerId = :buyerId', { buyerId: buyer.partnerId })
      .andWhere('LOWER(receipt.bankReference) = :bankReference', {
        bankReference: normalizedBankReference.toLowerCase(),
      })
      .andWhere('receipt.status IN (:...statuses)', {
        statuses: [
          PortalReceiptStatus.SUBMITTED,
          PortalReceiptStatus.CONFIRMED,
        ],
      })
      .getOne();
    if (duplicateBankReference) {
      throw new BadRequestException(
        'A T/T receipt with this bank reference already exists',
      );
    }

    if (dto.accountReceivableId) {
      accountReceivable = await this.arRepository.findOne({
        where: { _id: dto.accountReceivableId, buyerId: buyer.partnerId },
      });
      if (!accountReceivable) {
        throw new BadRequestException(
          'Account receivable does not belong to this buyer account',
        );
      }
      if (
        [ARStatus.PAID, ARStatus.CANCELLED].includes(accountReceivable.status)
      ) {
        throw new BadRequestException(
          'This account receivable is already closed',
        );
      }
      const openAmount = new Decimal(
        accountReceivable.amountForeign || 0,
      ).minus(accountReceivable.paidAmountForeign || 0);
      if (openAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'This account receivable has no open balance',
        );
      }
      if (receiptAmount.greaterThan(openAmount)) {
        throw new BadRequestException(
          `Receipt amount exceeds open balance ${openAmount.toFixed(2)} ${accountReceivable.currency}`,
        );
      }

      const invoiceCurrency = (
        accountReceivable.currency || 'USD'
      ).toUpperCase();
      if (dto.currency && dto.currency.toUpperCase() !== invoiceCurrency) {
        throw new BadRequestException(
          `Receipt currency must match invoice currency ${invoiceCurrency}`,
        );
      }

      const duplicatePendingReceipt = await this.receiptRepository.findOne({
        where: {
          buyerId: buyer.partnerId,
          accountReceivableId: accountReceivable._id,
          amount: receiptAmount.toNumber(),
          currency: invoiceCurrency,
          status: PortalReceiptStatus.SUBMITTED,
        },
      });
      if (duplicatePendingReceipt) {
        throw new BadRequestException(
          'A submitted receipt for this invoice and amount is already waiting for review',
        );
      }
      salesContractId = accountReceivable.salesContractId || salesContractId;
    }

    if (salesContractId) {
      const contract = await this.salesContractRepository.findOne({
        where: { _id: salesContractId, buyerId: buyer.partnerId },
      });
      if (!contract) {
        throw new BadRequestException(
          'Sales contract does not belong to this buyer account',
        );
      }
    }

    const now = new Date();

    // Determine status based on source
    // SEPAY_WEBHOOK: auto-confirmed (bank verified)
    // CUSTOMER_QR_INITIATED: SUBMITTED (waiting for webhook)
    // CUSTOMER_PORTAL_UPLOAD: SUBMITTED (needs accountant review)
    const source = dto.source || PortalPaymentSource.CUSTOMER_PORTAL_UPLOAD;
    let status: PortalReceiptStatus;

    if (
      dto.autoApprove === true ||
      source === PortalPaymentSource.SEPAY_WEBHOOK
    ) {
      status = PortalReceiptStatus.CONFIRMED;
    } else {
      status = PortalReceiptStatus.SUBMITTED;
    }

    const receipt = this.receiptRepository.create({
      receiptNumber: this.createReceiptNumber(now),
      buyerId: buyer.partnerId,
      accountReceivableId: accountReceivable?._id || null,
      salesContractId,
      receiptType: dto.receiptType,
      amount: receiptAmount.toNumber(),
      currency: accountReceivable?.currency || dto.currency || 'USD',
      exchangeRate: Number(
        dto.exchangeRate || accountReceivable?.exchangeRate || 1,
      ),
      bankReference: normalizedBankReference,
      remittingBank: dto.remittingBank || dto.senderBankName || null,
      transactionDate: dto.transactionDate
        ? new Date(dto.transactionDate)
        : now,
      fileAsset_id: fileAsset?._id || null,
      tradeFinanceTransactionId: null,
      status,
      submittedByUsername: buyer.username,
      submittedAt: now,
      reviewedByUsername:
        status === PortalReceiptStatus.CONFIRMED ? 'system' : null,
      reviewedAt: status === PortalReceiptStatus.CONFIRMED ? now : null,
      rejectionReason: null,
      note: dto.note || null,
      auditTrail: [
        this.receiptAudit('SUBMITTED', buyer.username, {
          transferReference: dto.transferReference,
          note: dto.note || null,
        }),
      ],
    });

    const saved = await this.receiptRepository.save(receipt);

    // Link file asset if exists
    if (fileAsset) {
      await this.filesService.linkToDocument(fileAsset._id, {
        linkedModule: 'portal',
        linkedDocumentType: 'TT_RECEIPT',
        linkedDocument_id: saved._id,
        username: buyer.username,
        note: `Linked to portal T/T receipt ${saved.receiptNumber}`,
      });
    }

    // Create notification for accountant review
    if (status === PortalReceiptStatus.SUBMITTED) {
      await this.createNotification({
        buyerId: buyer.partnerId,
        type: PortalNotificationType.FINANCE,
        severity: PortalNotificationSeverity.INFO,
        title: 'T/T receipt submitted',
        description: `Receipt ${saved.receiptNumber} is waiting for accounting review.`,
        referenceType: 'portal_payment_receipts',
        referenceId: saved._id,
      });
    }
    await this.invalidateBuyerPortalCache(buyer.partnerId);

    return this.receiptRepository.findOne({
      where: { _id: saved._id },
      relations: ['fileAsset', 'accountReceivable', 'salesContract'],
    });
  }

  async reviewPaymentReceipt(
    recordId: string,
    dto: ReviewPortalPaymentReceiptDto,
    user?: AuthenticatedUser,
  ) {
    const username = user?.username || 'system';
    const receipt = await this.receiptRepository.findOne({
      where: { _id: recordId },
      relations: ['accountReceivable'],
    });
    if (!receipt)
      throw new NotFoundException('Portal payment receipt not found');
    if (receipt.status !== PortalReceiptStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted receipts can be reviewed');
    }

    receipt.reviewedByUsername = username;
    receipt.reviewedAt = new Date();

    if (dto.status === PortalReceiptStatus.REJECTED) {
      receipt.status = PortalReceiptStatus.REJECTED;
      receipt.rejectionReason = dto.note || 'Rejected by accounting';
      receipt.auditTrail = [
        ...(receipt.auditTrail || []),
        this.receiptAudit('REJECTED', username, {
          note: receipt.rejectionReason,
        }),
      ];
      const saved = await this.receiptRepository.save(receipt);
      await this.createNotification({
        buyerId: saved.buyerId,
        type: PortalNotificationType.FINANCE,
        severity: PortalNotificationSeverity.ERROR,
        title: 'T/T receipt rejected',
        description: `${saved.receiptNumber}: ${saved.rejectionReason}`,
        referenceType: 'portal_payment_receipts',
        referenceId: saved._id,
      });
      await this.invalidateBuyerPortalCache(saved.buyerId);
      return saved;
    }

    if (!receipt.salesContractId) {
      throw new BadRequestException(
        'A sales contract is required before confirming this receipt',
      );
    }
    if (!receipt.accountReceivableId || !receipt.accountReceivable) {
      throw new BadRequestException(
        'An invoice reference is required before confirming this receipt',
      );
    }
    const accountReceivableId = receipt.accountReceivableId;

    const receiptAmount = new Decimal(receipt.amount || 0);
    if (receiptAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Receipt amount must be greater than zero');
    }

    const openAmount = new Decimal(
      receipt.accountReceivable.amountForeign || 0,
    ).minus(receipt.accountReceivable.paidAmountForeign || 0);
    if (
      [ARStatus.PAID, ARStatus.CANCELLED].includes(
        receipt.accountReceivable.status,
      ) ||
      openAmount.lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException(
        'This invoice is already closed and cannot accept more receipts',
      );
    }
    if (receiptAmount.greaterThan(openAmount)) {
      throw new BadRequestException(
        `Receipt amount exceeds open balance ${openAmount.toFixed(2)} ${receipt.accountReceivable.currency}`,
      );
    }
    if (
      receipt.currency?.toUpperCase() !==
      receipt.accountReceivable.currency?.toUpperCase()
    ) {
      throw new BadRequestException(
        `Receipt currency must match invoice currency ${receipt.accountReceivable.currency}`,
      );
    }

    const transaction = await this.tradeFinanceService.createTransaction(
      {
        type:
          receipt.receiptType === PortalReceiptType.TT_ADVANCE
            ? TradeFinanceType.TT_ADVANCE
            : TradeFinanceType.TT_BALANCE,
        salesContractId: receipt.salesContractId,
        amount: receipt.amount,
        currency: receipt.currency,
        exchangeRate: receipt.exchangeRate,
        bankReference: receipt.bankReference || receipt.receiptNumber,
        remittingBank: receipt.remittingBank || undefined,
        transactionDate: receipt.transactionDate || new Date(),
        note: `Confirmed from buyer portal receipt ${receipt.receiptNumber}`,
      },
      { username } as UserEntity,
    );
    const postedTransaction =
      await this.tradeFinanceService.updateTransactionStatus(
        transaction._id,
        TradeFinanceStatus.RECEIVED,
        { username } as UserEntity,
      );

    receipt.status = PortalReceiptStatus.CONFIRMED;
    receipt.tradeFinanceTransactionId = postedTransaction._id;
    receipt.auditTrail = [
      ...(receipt.auditTrail || []),
      this.receiptAudit('CONFIRMED', username, {
        note: dto.note || null,
        tradeFinanceTransactionId: postedTransaction._id,
      }),
    ];
    const saved = await this.receiptRepository.save(receipt);
    if (receiptAmount.greaterThanOrEqualTo(openAmount)) {
      const duplicateReceipts = await this.receiptRepository.find({
        where: {
          buyerId: saved.buyerId,
          accountReceivableId,
          status: PortalReceiptStatus.SUBMITTED,
          _id: Not(saved._id),
        },
      });
      if (duplicateReceipts.length) {
        await this.receiptRepository.save(
          duplicateReceipts.map((duplicateReceipt) => ({
            ...duplicateReceipt,
            status: PortalReceiptStatus.REJECTED,
            reviewedByUsername: username,
            reviewedAt: new Date(),
            rejectionReason: `Invoice already reconciled by ${saved.receiptNumber}`,
            auditTrail: [
              ...(duplicateReceipt.auditTrail || []),
              this.receiptAudit('REJECTED', username, {
                note: `Invoice already reconciled by ${saved.receiptNumber}`,
              }),
            ],
          })),
        );
      }
    }
    await this.createNotification({
      buyerId: saved.buyerId,
      type: PortalNotificationType.FINANCE,
      severity: PortalNotificationSeverity.SUCCESS,
      title: 'T/T receipt confirmed',
      description: `${saved.receiptNumber} has been reconciled with your account statement.`,
      referenceType: 'portal_payment_receipts',
      referenceId: saved._id,
    });
    await this.invalidateBuyerPortalCache(saved.buyerId);

    return saved;
  }

  async findSupportTickets(user?: AuthenticatedUser, query: QueryParams = {}) {
    const buyer = this.assertBuyer(user);
    const status = typeof query.status === 'string' ? query.status : undefined;
    const where = {
      buyerId: buyer.partnerId,
      ...(status ? { status: status as PortalTicketStatus } : {}),
    };

    return this.ticketRepository.find({
      where,
      relations: ['shipment'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findSupportTicket(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
      relations: ['shipment', 'messages'],
      order: { messages: { createdAt: 'ASC' } },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  private async normalizeTicketAttachments(attachments?: PortalAttachment[]) {
    const normalized = Array.isArray(attachments) ? attachments : [];
    if (!normalized.length) return null;

    const fileAssets = await Promise.all(
      normalized.map(async (attachment) =>
        this.filesService.findOne(attachment.fileAsset_id),
      ),
    );

    return fileAssets.map((asset) => ({
      fileAsset_id: asset._id,
      fileName: asset.originalName || asset.fileName,
      url: asset.url,
    }));
  }

  async createSupportTicket(
    dto: CreatePortalSupportTicketDto,
    user?: AuthenticatedUser,
  ) {
    const buyer = this.assertBuyer(user);
    if (dto.shipmentId) {
      const shipment = await this.shipmentRepository.findOne({
        where: { _id: dto.shipmentId },
        relations: ['salesContract'],
      });
      if (!shipment || shipment.salesContract?.buyerId !== buyer.partnerId) {
        throw new BadRequestException(
          'Shipment does not belong to this buyer account',
        );
      }
    }

    const attachments = await this.normalizeTicketAttachments(dto.attachments);
    const ticket = this.ticketRepository.create({
      ticketNumber: this.createTicketNumber(),
      buyerId: buyer.partnerId,
      shipmentId: dto.shipmentId || null,
      subject: dto.subject.trim(),
      category: dto.category || PortalTicketCategory.OTHER,
      priority: dto.priority || PortalTicketPriority.MEDIUM,
      status: PortalTicketStatus.OPEN,
      createdByUsername: buyer.username,
      assignedToUsername: null,
      lastMessageAt: new Date(),
      closedAt: null,
      attachments,
      auditTrail: [
        this.ticketAudit('CREATED', buyer.username, { note: dto.message }),
      ],
    });
    const savedTicket = await this.ticketRepository.save(ticket);

    await this.messageRepository.save(
      this.messageRepository.create({
        ticket_id: savedTicket._id,
        authorUsername: buyer.username,
        authorType: PortalMessageAuthorType.BUYER,
        message: dto.message.trim(),
        attachments,
      }),
    );
    await this.createNotification({
      buyerId: buyer.partnerId,
      type: PortalNotificationType.SUPPORT,
      severity: PortalNotificationSeverity.INFO,
      title: 'Support ticket created',
      description: `${savedTicket.ticketNumber} has been opened.`,
      referenceType: 'portal_support_tickets',
      referenceId: savedTicket._id,
    });

    return this.findSupportTicket(savedTicket._id, buyer);
  }

  async addSupportMessage(
    recordId: string,
    dto: CreatePortalSupportMessageDto,
    user?: AuthenticatedUser,
  ) {
    const buyer = this.assertBuyer(user);
    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (
      [PortalTicketStatus.RESOLVED, PortalTicketStatus.CLOSED].includes(
        ticket.status,
      )
    ) {
      throw new BadRequestException(
        'Cannot add messages to a resolved or closed ticket',
      );
    }

    const attachments = await this.normalizeTicketAttachments(dto.attachments);
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        ticket_id: ticket._id,
        authorUsername: buyer.username,
        authorType: PortalMessageAuthorType.BUYER,
        message: dto.message.trim(),
        attachments,
      }),
    );

    ticket.status = PortalTicketStatus.OPEN;
    ticket.lastMessageAt = new Date();
    ticket.auditTrail = [
      ...(ticket.auditTrail || []),
      this.ticketAudit('MESSAGE_ADDED', buyer.username, { note: dto.message }),
    ];
    await this.ticketRepository.save(ticket);

    return message;
  }

  async updateSupportTicketStatus(
    recordId: string,
    dto: UpdatePortalSupportTicketStatusDto,
    user?: AuthenticatedUser,
  ) {
    const buyer = this.assertBuyer(user);
    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (
      ![PortalTicketStatus.CLOSED, PortalTicketStatus.OPEN].includes(dto.status)
    ) {
      throw new BadRequestException(
        'Buyer can only reopen or close a support ticket',
      );
    }

    const fromStatus = ticket.status;
    ticket.status = dto.status;
    ticket.closedAt =
      dto.status === PortalTicketStatus.CLOSED ? new Date() : null;
    ticket.auditTrail = [
      ...(ticket.auditTrail || []),
      this.ticketAudit(
        dto.status === PortalTicketStatus.CLOSED ? 'CLOSED' : 'STATUS_CHANGED',
        buyer.username,
        {
          fromStatus,
          toStatus: dto.status,
          note: dto.note || null,
        },
      ),
    ];
    await this.ticketRepository.save(ticket);
    return this.findSupportTicket(ticket._id, buyer);
  }

  // --- ADMIN SUPPORT TICKETS API ---

  async adminFindSupportTickets(query: QueryParams = {}, user?: AuthenticatedUser) {
    if (!user || !hasAdminRole(user)) {
      throw new BadRequestException('Unauthorized access');
    }

    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 10);
    const status = typeof query.status === 'string' ? query.status : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const where: any = {};
    if (status) where.status = status;
    if (search) where.ticketNumber = search;

    const [results, totalItems] = await this.ticketRepository.findAndCount({
      where,
      relations: ['buyer', 'shipment'],
      order: { updatedAt: 'DESC' },
      skip: (current - 1) * pageSize,
      take: pageSize,
    });

    return {
      results,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      current,
      pageSize,
    };
  }

  async adminFindSupportTicket(recordId: string, user?: AuthenticatedUser) {
    if (!user || !hasAdminRole(user)) {
      throw new BadRequestException('Unauthorized access');
    }

    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId },
      relations: ['buyer', 'shipment', 'messages'],
      order: { messages: { createdAt: 'ASC' } },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async adminAddSupportMessage(
    recordId: string,
    dto: CreatePortalSupportMessageDto,
    user?: AuthenticatedUser,
  ) {
    if (!user || !hasAdminRole(user)) {
      throw new BadRequestException('Unauthorized access');
    }

    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (
      [PortalTicketStatus.RESOLVED, PortalTicketStatus.CLOSED].includes(
        ticket.status,
      )
    ) {
      throw new BadRequestException(
        'Cannot add messages to a resolved or closed ticket',
      );
    }

    const attachments = await this.normalizeTicketAttachments(dto.attachments);
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        ticket_id: ticket._id,
        authorUsername: user.username,
        authorType: PortalMessageAuthorType.STAFF,
        message: dto.message.trim(),
        attachments,
      }),
    );

    ticket.status = PortalTicketStatus.WAITING_BUYER;
    ticket.lastMessageAt = new Date();
    ticket.auditTrail = [
      ...(ticket.auditTrail || []),
      this.ticketAudit('MESSAGE_ADDED', user.username || 'System', { note: dto.message }),
    ];
    await this.ticketRepository.save(ticket);

    return message;
  }

  async adminUpdateSupportTicketStatus(
    recordId: string,
    dto: UpdatePortalSupportTicketStatusDto,
    user?: AuthenticatedUser,
  ) {
    if (!user || !hasAdminRole(user)) {
      throw new BadRequestException('Unauthorized access');
    }

    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');

    const fromStatus = ticket.status;
    ticket.status = dto.status;
    ticket.closedAt =
      dto.status === PortalTicketStatus.CLOSED || dto.status === PortalTicketStatus.RESOLVED ? new Date() : null;
    ticket.auditTrail = [
      ...(ticket.auditTrail || []),
      this.ticketAudit(
        dto.status === PortalTicketStatus.CLOSED ? 'CLOSED' : 'STATUS_CHANGED',
        user.username || 'System',
        {
          fromStatus,
          toStatus: dto.status,
          note: dto.note || null,
        },
      ),
    ];
    await this.ticketRepository.save(ticket);
    return this.adminFindSupportTicket(ticket._id, user);
  }

  async findNotifications(user?: AuthenticatedUser, query: QueryParams = {}) {
    const buyer = this.assertBuyer(user);
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 20);
    const [results, total] = await this.notificationRepository.findAndCount({
      where: { buyerId: buyer.partnerId },
      order: { createdAt: 'DESC' },
      skip: (current - 1) * pageSize,
      take: pageSize,
    });

    return {
      results,
      meta: {
        current,
        pageSize,
        total,
        unread: await this.notificationRepository.count({
          where: { buyerId: buyer.partnerId, readAt: IsNull() },
        }),
      },
    };
  }

  async markNotificationRead(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const notification = await this.notificationRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    notification.readAt = notification.readAt || new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllNotificationsRead(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(PortalNotification)
      .set({ readAt: new Date() })
      .where('"buyerId" = :buyerId', { buyerId: buyer.partnerId })
      .andWhere('"readAt" IS NULL')
      .execute();

    return { affected: result.affected || 0 };
  }

  async findQuotation(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const quotation = await this.quotationRepository.findOne({
      where: {
        _id: recordId,
        customerId: buyer.partnerId,
        status: In([
          QuotationStatus.SENT,
          QuotationStatus.ACCEPTED,
          QuotationStatus.REJECTED,
          QuotationStatus.CONVERTED,
          QuotationStatus.EXPIRED,
        ]),
      },
      relations: [
        'items',
        'items.product',
        'createdBy',
        'portOfLoadingPort',
        'portOfDischargePort',
      ],
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  async findCustomerQuotation(recordId: string, user?: AuthenticatedUser) {
    const quotation = await this.findQuotation(recordId, user);
    const [auditLogs, attachments] = await Promise.all([
      this.findDocumentAuditLogs('quotations', quotation._id),
      this.findDocumentAttachments(quotation._id),
    ]);

    return this.mapQuotationDocument(
      quotation,
      this.buildQuotationTimeline(quotation),
      auditLogs,
      attachments,
    );
  }

  async acceptQuotation(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const quotation = await this.findQuotation(recordId, user);
    const oldValues = {
      status: quotation.status,
      approvedByUsername: quotation.approvedByUsername,
      approvedAt: quotation.approvedAt,
    };

    if (quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException('Quotation cannot be accepted in its current state');
    }
    if (this.isQuotationExpired(quotation)) {
      throw new BadRequestException('Expired quotation cannot be accepted');
    }

    quotation.status = QuotationStatus.ACCEPTED;
    quotation.approvedByUsername = buyer.username;
    quotation.approvedAt = new Date();
    const saved = await this.quotationRepository.save(quotation);
    await this.writeCustomerAuditLog({
      tableName: 'quotations',
      recordId: saved._id,
      username: buyer.username,
      oldValues,
      newValues: {
        status: saved.status,
        approvedByUsername: saved.approvedByUsername,
        approvedAt: saved.approvedAt,
        source: 'customer_portal_accept',
      },
    });
    
    this.eventEmitter.emit('quotation.accepted_by_buyer', {
      quotation_id: saved._id,
      quotationNumber: saved.quotationNumber,
      createdByUsername: saved.createdByUsername,
      buyer_id: buyer.partnerId,
      username: buyer.username,
    });
    
    await this.invalidateBuyerPortalCache(buyer.partnerId);
    return saved;
  }

  async rejectQuotation(recordId: string, reason: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const quotation = await this.findQuotation(recordId, user);
    const oldValues = {
      status: quotation.status,
      rejectedByUsername: quotation.rejectedByUsername,
      rejectedAt: quotation.rejectedAt,
      rejectionReason: quotation.rejectionReason,
    };

    if (quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException('Quotation cannot be rejected in its current state');
    }
    if (this.isQuotationExpired(quotation)) {
      throw new BadRequestException('Expired quotation cannot be rejected');
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    quotation.status = QuotationStatus.REJECTED;
    quotation.rejectionReason = reason.trim();
    quotation.rejectedByUsername = buyer.username;
    quotation.rejectedAt = new Date();
    
    const saved = await this.quotationRepository.save(quotation);
    await this.writeCustomerAuditLog({
      tableName: 'quotations',
      recordId: saved._id,
      username: buyer.username,
      oldValues,
      newValues: {
        status: saved.status,
        rejectedByUsername: saved.rejectedByUsername,
        rejectedAt: saved.rejectedAt,
        rejectionReason: saved.rejectionReason,
        source: 'customer_portal_reject',
      },
    });
    
    this.eventEmitter.emit('quotation.rejected_by_buyer', {
      quotation_id: saved._id,
      quotationNumber: saved.quotationNumber,
      createdByUsername: saved.createdByUsername,
      buyer_id: buyer.partnerId,
      username: buyer.username,
      reason: saved.rejectionReason,
    });
    
    await this.invalidateBuyerPortalCache(buyer.partnerId);
    return saved;
  }

  async findProformaInvoice(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const invoice = await this.proformaInvoiceRepository.findOne({
      where: {
        _id: recordId,
        customerId: buyer.partnerId,
        status: In([
          PIStatus.SENT,
          PIStatus.ACCEPTED,
          PIStatus.REJECTED,
          PIStatus.CANCELLED,
        ]),
      },
      relations: [
        'items',
        'items.product',
        'createdBy',
        'portOfLoadingPort',
        'portOfDischargePort',
        'quotation',
      ],
    });

    if (!invoice) {
      throw new NotFoundException('Proforma Invoice not found');
    }

    return invoice;
  }

  async acceptProformaInvoice(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const invoice = await this.findProformaInvoice(recordId, user);
    const oldValues = {
      status: invoice.status,
      approvedByUsername: invoice.approvedByUsername,
      approvedAt: invoice.approvedAt,
    };

    if (invoice.status !== PIStatus.SENT) {
      throw new BadRequestException('Proforma Invoice cannot be accepted in its current state');
    }

    invoice.status = PIStatus.ACCEPTED;
    invoice.approvedByUsername = buyer.username;
    invoice.approvedAt = new Date();
    const saved = await this.proformaInvoiceRepository.save(invoice);
    await this.writeCustomerAuditLog({
      tableName: 'proforma_invoices',
      recordId: saved._id,
      username: buyer.username,
      oldValues,
      newValues: {
        status: saved.status,
        approvedByUsername: saved.approvedByUsername,
        approvedAt: saved.approvedAt,
        source: 'customer_portal_accept',
      },
    });
    
    this.eventEmitter.emit('proforma_invoice.accepted_by_buyer', {
      proformaInvoice_id: saved._id,
      piNumber: saved.piNumber,
      createdByUsername: saved.createdByUsername,
      buyer_id: buyer.partnerId,
      username: buyer.username,
    });
    
    await this.invalidateBuyerPortalCache(buyer.partnerId);
    return saved;
  }

  async rejectProformaInvoice(recordId: string, reason: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const invoice = await this.findProformaInvoice(recordId, user);
    const oldValues = {
      status: invoice.status,
      rejectedByUsername: invoice.rejectedByUsername,
      rejectedAt: invoice.rejectedAt,
      rejectionReason: invoice.rejectionReason,
    };

    if (invoice.status !== PIStatus.SENT) {
      throw new BadRequestException('Proforma Invoice cannot be rejected in its current state');
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    invoice.status = PIStatus.REJECTED;
    invoice.rejectionReason = reason.trim();
    invoice.rejectedByUsername = buyer.username;
    invoice.rejectedAt = new Date();
    
    const saved = await this.proformaInvoiceRepository.save(invoice);
    await this.writeCustomerAuditLog({
      tableName: 'proforma_invoices',
      recordId: saved._id,
      username: buyer.username,
      oldValues,
      newValues: {
        status: saved.status,
        rejectedByUsername: saved.rejectedByUsername,
        rejectedAt: saved.rejectedAt,
        rejectionReason: saved.rejectionReason,
        source: 'customer_portal_reject',
      },
    });
    
    this.eventEmitter.emit('proforma_invoice.rejected_by_buyer', {
      proformaInvoice_id: saved._id,
      piNumber: saved.piNumber,
      createdByUsername: saved.createdByUsername,
      buyer_id: buyer.partnerId,
      username: buyer.username,
      reason: saved.rejectionReason,
    });
    
    await this.invalidateBuyerPortalCache(buyer.partnerId);
    return saved;
  }

  async requestQuotationRevision(
    recordId: string,
    reason: string,
    user?: AuthenticatedUser,
  ) {
    const buyer = this.assertBuyer(user);
    const quotation = await this.findQuotation(recordId, user);

    if (quotation.status !== QuotationStatus.SENT) {
      throw new BadRequestException(
        'Quotation revision can only be requested while quotation is sent',
      );
    }
    if (this.isQuotationExpired(quotation)) {
      throw new BadRequestException(
        'Expired quotation cannot be sent for revision',
      );
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Revision reason is required');
    }

    await this.writeCustomerAuditLog({
      tableName: 'quotations',
      recordId: quotation._id,
      username: buyer.username,
      oldValues: {
        status: quotation.status,
      },
      newValues: {
        status: quotation.status,
        revisionReason: reason.trim(),
        source: 'customer_portal_request_revision',
      },
    });
    this.eventEmitter.emit('quotation.revision_requested_by_buyer', {
      quotation_id: quotation._id,
      quotationNumber: quotation.quotationNumber,
      createdByUsername: quotation.createdByUsername,
      buyer_id: buyer.partnerId,
      username: buyer.username,
      reason: reason.trim(),
    });
    await this.invalidateBuyerPortalCache(buyer.partnerId);

    return this.findCustomerQuotation(recordId, buyer);
  }

  async findCustomerOrderTimeline(recordId: string, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    let contract = await this.salesContractRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
      relations: ['proformaInvoice'],
    });
    let invoice: ProformaInvoice | null = null;
    let quotation: Quotation | null = null;

    if (!contract) {
      invoice = await this.proformaInvoiceRepository.findOne({
        where: { _id: recordId, customerId: buyer.partnerId },
        relations: ['salesContract', 'quotation'],
      });
      contract = invoice?.salesContract || null;
      quotation = invoice?.quotation || null;
    }

    if (!contract && !quotation) {
      quotation = await this.quotationRepository.findOne({
        where: { _id: recordId, customerId: buyer.partnerId },
      });
    }

    if (!contract && !invoice && !quotation) {
      throw new NotFoundException('Customer order timeline not found');
    }

    if (contract && !invoice && contract.proformaInvoiceId) {
      invoice = await this.proformaInvoiceRepository.findOne({
        where: { _id: contract.proformaInvoiceId, customerId: buyer.partnerId },
        relations: ['quotation'],
      });
      quotation = invoice?.quotation || quotation;
    }

    const shipments = contract
      ? await this.shipmentRepository.find({
          where: { salesContractId: contract._id },
          order: { createdAt: 'ASC' },
        })
      : [];
    const latestShipment = shipments.at(-1) || null;

    return [
      {
        key: 'quotation',
        label: 'Quotation',
        status: quotation ? 'finish' : 'wait',
        date: quotation?.issueDate || quotation?.createdAt || null,
        description: quotation?.quotationNumber || null,
      },
      {
        key: 'contract',
        label: 'Sales Contract',
        status: contract ? 'finish' : quotation ? 'process' : 'wait',
        date: contract?.createdAt || null,
        description: contract?.contractNumber || null,
      },
      {
        key: 'proforma_invoice',
        label: 'Proforma Invoice',
        status: invoice ? 'finish' : contract ? 'process' : 'wait',
        date: invoice?.issueDate || invoice?.createdAt || null,
        description: invoice?.piNumber || null,
      },
      {
        key: 'payment',
        label: 'Payment',
        status:
          invoice?.isPaid || ['PAID', 'SHIPPED'].includes(contract?.status || '')
            ? 'finish'
            : invoice
              ? 'process'
              : 'wait',
        date: invoice?.paidAt || null,
        description: invoice?.isPaid ? 'Payment received' : null,
      },
      {
        key: 'shipment',
        label: 'Shipment',
        status: latestShipment
          ? latestShipment.status === ShipmentStatus.CLOSED
            ? 'finish'
            : 'process'
          : 'wait',
        date: latestShipment?.etd || latestShipment?.createdAt || null,
        description: latestShipment?.shipmentNumber || null,
      },
      {
        key: 'completed',
        label: 'Completed',
        status:
          contract?.status === 'PAID' || latestShipment?.status === ShipmentStatus.CLOSED
            ? 'finish'
            : 'wait',
        date: latestShipment?.updatedAt || contract?.updatedAt || null,
        description: null,
      },
    ] satisfies CustomerTimelineItem[];
  }

  /**
   * Allows a logged-in buyer to (re)create a signing invitation for one of
   * their own sales contracts. The OTP is still emailed to the buyer contact
   * — the only difference from the staff flow is that the buyer can trigger
   * it from the customer portal and we return the signing URL so the FE can
   * navigate them straight to the secure signing page.
   */
  async requestContractSigning(
    contractId: string,
    dto: RequestSignatureInvitationDto = {},
    user?: AuthenticatedUser,
  ) {
    const buyer = this.assertBuyer(user);

    const contract = await this.salesContractRepository.findOne({
      where: { _id: contractId, buyerId: buyer.partnerId },
    });
    if (!contract) {
      throw new BadRequestException(
        'Sales contract does not belong to this buyer account',
      );
    }

    const partner = await this.getBuyerPartner(buyer);

    const signerName =
      dto.signerName?.trim() ||
      partner.contactName ||
      partner.name ||
      buyer.username;
    const signerEmail =
      dto.signerEmail?.trim() ||
      partner.email ||
      (await this.userRepository.findOne({
        where: { username: buyer.username },
        select: ['email'],
      }))?.email;

    if (!signerEmail) {
      throw new BadRequestException(
        'A buyer contact email is required to issue a signing invitation.',
      );
    }

    const result = await this.salesContractsService.sendForSignature(
      contractId,
      {
        signerName,
        signerTitle:
          dto.signerTitle?.trim() || 'Authorized Representative',
        signerEmail,
        expiresInDays: dto.expiresInDays,
      },
      { username: buyer.username },
    );

    const invitation = (result as {
      invitation?: { signingUrl?: string; expiresAt?: string | Date };
    }).invitation;
    const signingUrl = invitation?.signingUrl || '';
    const token = (() => {
      if (!signingUrl) return '';
      const match = signingUrl.match(/\/portal\/sign\/([^/?#]+)/);
      return match ? match[1] : '';
    })();

    if (!token) {
      throw new BadRequestException(
        'Could not derive signing token. Please contact support.',
      );
    }

    await this.invalidateBuyerPortalCache(buyer.partnerId);

    return {
      contractId,
      token,
      signingUrl,
      signerName,
      signerEmail,
      expiresAt: invitation?.expiresAt || null,
    };
  }

  async exportQuotationPdf(recordId: string, user?: AuthenticatedUser): Promise<Buffer> {
    const quotation = await this.findQuotation(recordId, user);
    
    const docDefinition = {
      content: [
        { text: 'QUOTATION', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
        { text: `Quotation No: ${quotation.quotationNumber || quotation._id}`, margin: [0, 0, 0, 10] },
        { text: `Date: ${new Date(quotation.issueDate).toLocaleDateString()}`, margin: [0, 0, 0, 10] },
        { text: `Total Amount: ${quotation.totalAmount} ${quotation.currency}`, margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              ['Product', 'Qty', 'Unit Price', 'Total'],
              ...(quotation.items || []).map(item => [
                item.product?.vietnameseName || item.product?.englishName || item.product?.sku || 'N/A',
                item.quantity,
                `${item.unitPrice} ${quotation.currency}`,
                `${item.totalAmount} ${quotation.currency}`
              ])
            ]
          }
        }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true
        }
      }
    };

    return renderPdfBuffer(docDefinition);
  }
}
