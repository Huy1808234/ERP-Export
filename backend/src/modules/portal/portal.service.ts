import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import type { AuthenticatedUser, QueryParams } from '@/common/types/authenticated-user.type';
import { AccountReceivable, ARStatus } from '@/modules/account-receivables/entities/account-receivable.entity';
import { PaymentAllocation } from '@/modules/account-receivables/entities/payment-allocation.entity';
import { FilesService } from '@/modules/files/files.service';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { TradeFinanceService } from '@/modules/trade-finance/trade-finance.service';
import {
  TradeFinanceStatus,
  TradeFinanceType,
} from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { CreatePortalPaymentReceiptDto } from './dto/create-portal-payment-receipt.dto';
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

type PortalBuyerUser = AuthenticatedUser & {
  username: string;
  partnerId: string;
};

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
  amountVnd: number;
  paidAmountVnd: number;
  openAmountVnd: number;
  status: ARStatus;
  allocations: PaymentAllocation[];
};

@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(AccountReceivable)
    private readonly arRepository: Repository<AccountReceivable>,
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
    private readonly filesService: FilesService,
    private readonly tradeFinanceService: TradeFinanceService,
  ) {}

  private assertBuyer(user?: AuthenticatedUser): PortalBuyerUser {
    const username = user?.username?.trim();
    const partnerId = user?.partnerId?.trim();
    if (!username || !partnerId) {
      throw new BadRequestException('Portal user is not linked to a buyer account');
    }

    return { ...user, username, partnerId };
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

  private toStatementLine(row: AccountReceivable): PortalStatementLine {
    const amountForeign = new Decimal(row.amountForeign || 0);
    const paidAmountForeign = new Decimal(row.paidAmountForeign || 0);
    const amountVnd = new Decimal(row.amountVnd || 0);
    const paidAmountVnd = new Decimal(row.paidAmountVnd || 0);

    return {
      _id: row._id,
      invoiceNumber: row.invoiceNumber,
      salesContractId: row.salesContractId,
      commercialInvoice_id: row.commercialInvoice_id,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      amountForeign: amountForeign.toNumber(),
      paidAmountForeign: paidAmountForeign.toNumber(),
      openAmountForeign: Decimal.max(amountForeign.minus(paidAmountForeign), 0).toNumber(),
      currency: row.currency,
      amountVnd: amountVnd.toNumber(),
      paidAmountVnd: paidAmountVnd.toNumber(),
      openAmountVnd: Decimal.max(amountVnd.minus(paidAmountVnd), 0).toNumber(),
      status: row.status,
      allocations: row.allocations || [],
    };
  }

  async getStatement(user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const receivables = await this.arRepository.find({
      where: { buyerId: buyer.partnerId },
      relations: ['salesContract', 'allocations'],
      order: { dueDate: 'ASC', invoiceDate: 'ASC' },
    });
    const receipts = await this.findPaymentReceipts(buyer);
    const lines = receivables.map((row) => this.toStatementLine(row));
    const summary = lines.reduce(
      (acc, line) => ({
        totalForeign: acc.totalForeign.plus(line.amountForeign),
        paidForeign: acc.paidForeign.plus(line.paidAmountForeign),
        openForeign: acc.openForeign.plus(line.openAmountForeign),
        totalVnd: acc.totalVnd.plus(line.amountVnd),
        paidVnd: acc.paidVnd.plus(line.paidAmountVnd),
        openVnd: acc.openVnd.plus(line.openAmountVnd),
      }),
      {
        totalForeign: new Decimal(0),
        paidForeign: new Decimal(0),
        openForeign: new Decimal(0),
        totalVnd: new Decimal(0),
        paidVnd: new Decimal(0),
        openVnd: new Decimal(0),
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
        openInvoiceCount: lines.filter((line) => line.openAmountForeign > 0).length,
        pendingReceiptCount: receipts.filter((receipt) => receipt.status === PortalReceiptStatus.SUBMITTED).length,
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
      ['invoiceNumber', 'invoiceDate', 'dueDate', 'currency', 'amountForeign', 'paidAmountForeign', 'openAmountForeign', 'status'],
      ...statement.lines.map((line) => [
        line.invoiceNumber,
        line.invoiceDate ? new Date(line.invoiceDate).toISOString().slice(0, 10) : null,
        line.dueDate ? new Date(line.dueDate).toISOString().slice(0, 10) : null,
        line.currency,
        line.amountForeign,
        line.paidAmountForeign,
        line.openAmountForeign,
        line.status,
      ]),
      [],
      ['receiptNumber', 'receiptType', 'status', 'amount', 'currency', 'bankReference', 'submittedAt'],
      ...statement.receipts.map((receipt) => [
        receipt.receiptNumber,
        receipt.receiptType,
        receipt.status,
        receipt.amount,
        receipt.currency,
        receipt.bankReference,
        receipt.submittedAt ? new Date(receipt.submittedAt).toISOString() : null,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => {
      const value = cell === null || cell === undefined ? '' : String(cell);
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')).join('\n');

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

  async createPaymentReceipt(dto: CreatePortalPaymentReceiptDto, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const fileAsset = await this.filesService.findOne(dto.fileAsset_id);
    let accountReceivable: AccountReceivable | null = null;
    let salesContractId = dto.salesContractId || null;

    if (dto.accountReceivableId) {
      accountReceivable = await this.arRepository.findOne({
        where: { _id: dto.accountReceivableId, buyerId: buyer.partnerId },
      });
      if (!accountReceivable) {
        throw new BadRequestException('Account receivable does not belong to this buyer account');
      }
      salesContractId = accountReceivable.salesContractId || salesContractId;
    }

    if (salesContractId) {
      const contract = await this.salesContractRepository.findOne({
        where: { _id: salesContractId, buyerId: buyer.partnerId },
      });
      if (!contract) {
        throw new BadRequestException('Sales contract does not belong to this buyer account');
      }
    }

    const now = new Date();
    const receipt = this.receiptRepository.create({
      receiptNumber: this.createReceiptNumber(now),
      buyerId: buyer.partnerId,
      accountReceivableId: accountReceivable?._id || null,
      salesContractId,
      receiptType: dto.receiptType,
      amount: Number(dto.amount || 0),
      currency: dto.currency || accountReceivable?.currency || 'USD',
      exchangeRate: Number(dto.exchangeRate || accountReceivable?.exchangeRate || 1),
      bankReference: dto.bankReference || null,
      remittingBank: dto.remittingBank || null,
      transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : now,
      fileAsset_id: fileAsset._id,
      tradeFinanceTransactionId: null,
      status: PortalReceiptStatus.SUBMITTED,
      submittedByUsername: buyer.username,
      submittedAt: now,
      reviewedByUsername: null,
      reviewedAt: null,
      rejectionReason: null,
      note: dto.note || null,
      auditTrail: [
        this.receiptAudit('SUBMITTED', buyer.username, {
          fileAsset_id: fileAsset._id,
          note: dto.note || null,
        }),
      ],
    });

    const saved = await this.receiptRepository.save(receipt);
    await this.filesService.linkToDocument(fileAsset._id, {
      linkedModule: 'portal',
      linkedDocumentType: 'TT_RECEIPT',
      linkedDocument_id: saved._id,
      username: buyer.username,
      note: `Linked to portal T/T receipt ${saved.receiptNumber}`,
    });
    await this.createNotification({
      buyerId: buyer.partnerId,
      type: PortalNotificationType.FINANCE,
      severity: PortalNotificationSeverity.INFO,
      title: 'T/T receipt submitted',
      description: `Receipt ${saved.receiptNumber} is waiting for accounting review.`,
      referenceType: 'portal_payment_receipts',
      referenceId: saved._id,
    });

    return this.receiptRepository.findOne({
      where: { _id: saved._id },
      relations: ['fileAsset', 'accountReceivable', 'salesContract'],
    });
  }

  async reviewPaymentReceipt(recordId: string, dto: ReviewPortalPaymentReceiptDto, user?: AuthenticatedUser) {
    const username = user?.username || 'system';
    const receipt = await this.receiptRepository.findOne({
      where: { _id: recordId },
      relations: ['accountReceivable'],
    });
    if (!receipt) throw new NotFoundException('Portal payment receipt not found');
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
        this.receiptAudit('REJECTED', username, { note: receipt.rejectionReason }),
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
      return saved;
    }

    if (!receipt.salesContractId) {
      throw new BadRequestException('A sales contract is required before confirming this receipt');
    }

    const transaction = await this.tradeFinanceService.createTransaction(
      {
        type: receipt.receiptType === PortalReceiptType.TT_ADVANCE
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
    const postedTransaction = await this.tradeFinanceService.updateTransactionStatus(
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
    await this.createNotification({
      buyerId: saved.buyerId,
      type: PortalNotificationType.FINANCE,
      severity: PortalNotificationSeverity.SUCCESS,
      title: 'T/T receipt confirmed',
      description: `${saved.receiptNumber} has been reconciled with your account statement.`,
      referenceType: 'portal_payment_receipts',
      referenceId: saved._id,
    });

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
      normalized.map(async (attachment) => this.filesService.findOne(attachment.fileAsset_id)),
    );

    return fileAssets.map((asset) => ({
      fileAsset_id: asset._id,
      fileName: asset.originalName || asset.fileName,
      url: asset.url,
    }));
  }

  async createSupportTicket(dto: CreatePortalSupportTicketDto, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    if (dto.shipmentId) {
      const shipment = await this.shipmentRepository.findOne({
        where: { _id: dto.shipmentId },
        relations: ['salesContract'],
      });
      if (!shipment || shipment.salesContract?.buyerId !== buyer.partnerId) {
        throw new BadRequestException('Shipment does not belong to this buyer account');
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
      auditTrail: [this.ticketAudit('CREATED', buyer.username, { note: dto.message })],
    });
    const savedTicket = await this.ticketRepository.save(ticket);

    await this.messageRepository.save(this.messageRepository.create({
      ticket_id: savedTicket._id,
      authorUsername: buyer.username,
      authorType: PortalMessageAuthorType.BUYER,
      message: dto.message.trim(),
      attachments,
    }));
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

  async addSupportMessage(recordId: string, dto: CreatePortalSupportMessageDto, user?: AuthenticatedUser) {
    const buyer = this.assertBuyer(user);
    const ticket = await this.ticketRepository.findOne({
      where: { _id: recordId, buyerId: buyer.partnerId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if ([PortalTicketStatus.RESOLVED, PortalTicketStatus.CLOSED].includes(ticket.status)) {
      throw new BadRequestException('Cannot add messages to a resolved or closed ticket');
    }

    const attachments = await this.normalizeTicketAttachments(dto.attachments);
    const message = await this.messageRepository.save(this.messageRepository.create({
      ticket_id: ticket._id,
      authorUsername: buyer.username,
      authorType: PortalMessageAuthorType.BUYER,
      message: dto.message.trim(),
      attachments,
    }));

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
    if (![PortalTicketStatus.CLOSED, PortalTicketStatus.OPEN].includes(dto.status)) {
      throw new BadRequestException('Buyer can only reopen or close a support ticket');
    }

    const fromStatus = ticket.status;
    ticket.status = dto.status;
    ticket.closedAt = dto.status === PortalTicketStatus.CLOSED ? new Date() : null;
    ticket.auditTrail = [
      ...(ticket.auditTrail || []),
      this.ticketAudit(dto.status === PortalTicketStatus.CLOSED ? 'CLOSED' : 'STATUS_CHANGED', buyer.username, {
        fromStatus,
        toStatus: dto.status,
        note: dto.note || null,
      }),
    ];
    await this.ticketRepository.save(ticket);
    return this.findSupportTicket(ticket._id, buyer);
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
}
