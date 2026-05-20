import { createHash, randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  SalesContract,
  SalesContractSignatureStatus,
  SalesContractStatus,
} from './entities/sales-contract.entity';
import { SalesContractItem } from './entities/sales-contract-item.entity';
import { ContractSignature, ContractSignerType } from './entities/contract-signature.entity';
import {
  ContractSignatureInvitation,
  ContractSignatureInvitationAuditEvent,
  ContractSignatureInvitationStatus,
} from './entities/contract-signature-invitation.entity';
import { SignSalesContractDto } from './dto/sign-sales-contract.dto';
import { RequestSignatureInvitationDto } from './dto/request-signature-invitation.dto';
import { VerifySignatureOtpDto } from './dto/verify-signature-otp.dto';
import { PortalSignSalesContractDto } from './dto/portal-sign-sales-contract.dto';
import { InventoryService } from '../inventory/inventory.service';
import { IncotermsService } from './incoterms.service';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Incoterm } from '../quotations/entities/quotation.entity';
import { PricingPoliciesService } from '../pricing-policies/pricing-policies.service';
import { SalesPriceSourceType } from '../pricing-policies/entities/sales-price-history.entity';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';

const PdfPrinter = require('pdfmake');

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type SignaturePacketEvent = {
  action: string;
  at: string | Date;
  actor: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  note?: string | null;
};

type SignatureDeliveryStatus = 'EMAIL_SENT' | 'EMAIL_FAILED' | 'EMAIL_SKIPPED';

type SignatureInvitationResponse = {
  _id: string;
  signerType: ContractSignerType;
  signerName: string;
  signerTitle: string | null;
  signerEmailMasked: string | null;
  status: ContractSignatureInvitationStatus;
  expiresAt: Date;
  sentAt: Date | null;
  openedAt: Date | null;
  verifiedAt: Date | null;
  signedAt: Date | null;
  certificateNumber: string | null;
  certificateHash: string | null;
  signingUrl?: string;
};

type SigningSessionResponse = {
  invitation: SignatureInvitationResponse & { otpVerified: boolean };
  contract: {
    _id: string;
    contractNumber: string;
    status: SalesContractStatus;
    signatureStatus: SalesContractSignatureStatus;
    buyerName: string | null;
    buyerCountry: string | null;
    incoterm: string;
    currencyCode: string;
    totalAmount: number;
    totalAmountVnd: number;
    deliveryDate: string | null;
    paymentTerms: string | null;
    notes: string | null;
    items: Array<{
      _id: string;
      productName: string | null;
      sku: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  };
  documentHash: string;
};

type SignatureAuditPacket = {
  contract: {
    _id: string;
    contractNumber: string;
    status: SalesContractStatus;
    signatureStatus: SalesContractSignatureStatus;
    buyerName: string | null;
    totalAmount: number;
    currencyCode: string;
    documentHash: string | null;
  };
  certificate: {
    certificateNumber: string | null;
    certificateHash: string | null;
    packetHash: string;
    generatedAt: string;
  };
  signatures: Array<{
    _id: string;
    signerType: ContractSignerType;
    signerName: string;
    signerTitle: string | null;
    signerEmailMasked: string | null;
    signedAt: Date;
    documentHash: string;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
  invitations: SignatureInvitationResponse[];
  timeline: SignaturePacketEvent[];
};

@Injectable()
export class SalesContractsService {
  constructor(
    @InjectRepository(SalesContract)
    private readonly contractRepository: Repository<SalesContract>,
    @InjectRepository(ContractSignatureInvitation)
    private readonly signatureInvitationRepository: Repository<ContractSignatureInvitation>,
    private readonly dataSource: DataSource,
    private readonly mailerService: MailerService,
    private readonly inventoryService: InventoryService,
    private readonly incotermsService: IncotermsService,
    private readonly pricingPoliciesService: PricingPoliciesService,
    private readonly approvalMatrixService: ApprovalMatrixService,
  ) {}

  private getActorUsername(user?: { username?: string } | null) {
    return user?.username || 'system';
  }

  private hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashOtp(otp: string, tokenHash: string) {
    return this.hashSecret(`${otp}:${tokenHash}`);
  }

  private generateSigningToken() {
    return randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private generateOtp() {
    return String(randomInt(100000, 1000000));
  }

  private addMinutes(date: Date, minutes: number) {
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + minutes);
    return next;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private maskEmail(value?: string | null) {
    if (!value || !value.includes('@')) return value || null;
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }

  private buildFrontendSigningUrl(token: string) {
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl.replace(/\/$/g, '')}/vi/portal/sign/${token}`;
  }

  private appendInvitationAudit(
    invitation: ContractSignatureInvitation,
    action: string,
    meta?: RequestMeta & { actorUsername?: string | null; note?: string | null },
  ) {
    const event: ContractSignatureInvitationAuditEvent = {
      action,
      at: new Date().toISOString(),
      actorUsername: meta?.actorUsername || null,
      ipAddress: meta?.ipAddress || null,
      userAgent: meta?.userAgent || null,
      note: meta?.note || null,
    };
    invitation.auditTrail = [
      ...(Array.isArray(invitation.auditTrail) ? invitation.auditTrail : []),
      event,
    ];
  }

  private toInvitationResponse(
    invitation: ContractSignatureInvitation,
    signingUrl?: string,
  ): SignatureInvitationResponse {
    return {
      _id: invitation._id,
      signerType: invitation.signerType,
      signerName: invitation.signerName,
      signerTitle: invitation.signerTitle,
      signerEmailMasked: this.maskEmail(invitation.signerEmail),
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      sentAt: invitation.sentAt,
      openedAt: invitation.openedAt,
      verifiedAt: invitation.verifiedAt,
      signedAt: invitation.signedAt,
      certificateNumber: invitation.certificateNumber,
      certificateHash: invitation.certificateHash,
      ...(signingUrl ? { signingUrl } : {}),
    };
  }

  private toSigningSessionResponse(invitation: ContractSignatureInvitation): SigningSessionResponse {
    const contract = invitation.contract;
    return {
      invitation: {
        ...this.toInvitationResponse(invitation),
        otpVerified: invitation.status === ContractSignatureInvitationStatus.OTP_VERIFIED,
      },
      contract: {
        _id: contract._id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        signatureStatus: contract.signatureStatus,
        buyerName: contract.buyer?.name || null,
        buyerCountry: contract.buyer?.country || null,
        incoterm: contract.incoterm,
        currencyCode: contract.currencyCode,
        totalAmount: Number(contract.totalAmount || 0),
        totalAmountVnd: Number(contract.totalAmountVnd || 0),
        deliveryDate: contract.deliveryDate || null,
        paymentTerms: contract.paymentTerms || null,
        notes: contract.notes || null,
        items: (contract.items || []).map((item) => ({
          _id: item._id,
          productName: item.product?.vietnameseName || item.product?.englishName || null,
          sku: item.product?.sku || null,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          totalPrice: Number(item.totalPrice || 0),
        })),
      },
      documentHash: this.buildContractHash(contract),
    };
  }

  private getSignatureInvitationRelations() {
    return [
      'contract',
      'contract.buyer',
      'contract.items',
      'contract.items.product',
      'contract.signatures',
      'contract.signatureInvitations',
    ];
  }

  private async findInvitationByToken(
    token: string,
    manager?: EntityManager,
    lock = false,
  ): Promise<ContractSignatureInvitation> {
    const repository = manager
      ? manager.getRepository(ContractSignatureInvitation)
      : this.signatureInvitationRepository;
    const invitation = await repository.findOne({
      where: { tokenHash: this.hashSecret(token) },
      relations: this.getSignatureInvitationRelations(),
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!invitation) {
      throw new NotFoundException('Signature invitation not found.');
    }

    return invitation;
  }

  private async ensureInvitationUsable(
    invitation: ContractSignatureInvitation,
    manager?: EntityManager,
  ) {
    if (invitation.status === ContractSignatureInvitationStatus.REVOKED) {
      throw new BadRequestException('Signature invitation has been revoked.');
    }
    if (invitation.status === ContractSignatureInvitationStatus.SIGNED) {
      throw new BadRequestException('Signature invitation has already been signed.');
    }
    if (invitation.status === ContractSignatureInvitationStatus.EXPIRED || invitation.expiresAt.getTime() < Date.now()) {
      if (invitation.status !== ContractSignatureInvitationStatus.EXPIRED) {
        invitation.status = ContractSignatureInvitationStatus.EXPIRED;
        this.appendInvitationAudit(invitation, 'EXPIRED', { note: 'Invitation expired before signing' });
        const repository = manager
          ? manager.getRepository(ContractSignatureInvitation)
          : this.signatureInvitationRepository;
        await repository.save(invitation);
      }
      throw new BadRequestException('Signature invitation has expired.');
    }
  }

  private async deliverSignatureInvitation(
    invitation: ContractSignatureInvitation,
    contract: SalesContract,
    signingUrl: string,
    otp: string,
  ): Promise<SignatureDeliveryStatus> {
    if (!invitation.signerEmail) return 'EMAIL_SKIPPED';

    try {
      await this.mailerService.sendMail({
        to: invitation.signerEmail,
        subject: `Signature requested: ${contract.contractNumber}`,
        html: `
          <p>Hello ${invitation.signerName},</p>
          <p>Please review and sign Sales Contract <strong>${contract.contractNumber}</strong>.</p>
          <p><a href="${signingUrl}">Open secure signing portal</a></p>
          <p>Your OTP is <strong>${otp}</strong>. It expires in 15 minutes.</p>
          <p>This link expires at ${invitation.expiresAt.toISOString()}.</p>
        `,
      });
      return 'EMAIL_SENT';
    } catch {
      return 'EMAIL_FAILED';
    }
  }

  private buildSignatureAuditPacket(contract: SalesContract): SignatureAuditPacket {
    const invitations = [...(contract.signatureInvitations || [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const signatures = [...(contract.signatures || [])].sort(
      (a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime(),
    );

    const timeline: SignaturePacketEvent[] = [];
    if (contract.submittedForApprovalAt) {
      timeline.push({
        action: 'SUBMITTED_FOR_APPROVAL',
        at: contract.submittedForApprovalAt,
        actor: contract.submittedForApprovalByUsername,
      });
    }
    if (contract.approvedAt) {
      timeline.push({
        action: 'APPROVED',
        at: contract.approvedAt,
        actor: contract.approvedByUsername,
      });
    }

    for (const invitation of invitations) {
      for (const event of invitation.auditTrail || []) {
        timeline.push({
          action: event.action,
          at: event.at,
          actor: event.actorUsername || null,
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
          note: event.note || null,
        });
      }
    }

    for (const signature of signatures) {
      timeline.push({
        action: `${signature.signerType}_SIGNED`,
        at: signature.signedAt,
        actor: signature.signedByUsername,
        ipAddress: signature.ipAddress,
        userAgent: signature.userAgent,
        note: signature.signerName,
      });
    }

    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const signedInvitation = [...invitations].reverse().find((item) => item.status === ContractSignatureInvitationStatus.SIGNED);
    const packetPayload = {
      contractId: contract._id,
      contractNumber: contract.contractNumber,
      documentHash: contract.signatureDocumentHash,
      signatures: signatures.map((signature) => ({
        _id: signature._id,
        signerType: signature.signerType,
        signerName: signature.signerName,
        signedAt: signature.signedAt,
        documentHash: signature.documentHash,
      })),
      invitations: invitations.map((invitation) => ({
        _id: invitation._id,
        status: invitation.status,
        certificateNumber: invitation.certificateNumber,
        certificateHash: invitation.certificateHash,
      })),
      timeline,
    };

    return {
      contract: {
        _id: contract._id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        signatureStatus: contract.signatureStatus,
        buyerName: contract.buyer?.name || null,
        totalAmount: Number(contract.totalAmount || 0),
        currencyCode: contract.currencyCode,
        documentHash: contract.signatureDocumentHash || null,
      },
      certificate: {
        certificateNumber: signedInvitation?.certificateNumber || null,
        certificateHash: signedInvitation?.certificateHash || null,
        packetHash: this.hashSecret(JSON.stringify(packetPayload)),
        generatedAt: new Date().toISOString(),
      },
      signatures: signatures.map((signature) => ({
        _id: signature._id,
        signerType: signature.signerType,
        signerName: signature.signerName,
        signerTitle: signature.signerTitle,
        signerEmailMasked: this.maskEmail(signature.signerEmail),
        signedAt: signature.signedAt,
        documentHash: signature.documentHash,
        ipAddress: signature.ipAddress,
        userAgent: signature.userAgent,
      })),
      invitations: invitations.map((invitation) => this.toInvitationResponse(invitation)),
      timeline,
    };
  }

  private buildContractHash(contract: SalesContract) {
    const itemPayload = (contract.items || [])
      .map((item) => `${item.productId}:${item.quantity}:${item.unitPrice}:${item.totalPrice}`)
      .join('|');

    return createHash('sha256')
      .update(
        [
          contract._id,
          contract.contractNumber,
          contract.buyerId,
          contract.currencyCode,
          contract.incoterm,
          contract.totalAmount,
          contract.totalAmountVnd,
          contract.paymentTerms || '',
          contract.deliveryDate || '',
          itemPayload,
        ].join('::'),
      )
      .digest('hex');
  }

  private async applyPricingPolicies(items: any[], contractData: any) {
    const incoterm = contractData.incoterm || Incoterm.FOB;
    const currency = contractData.currencyCode || 'USD';
    const normalizedItems: any[] = [];

    for (const item of items || []) {
      if (Number(item.unitPrice || 0) > 0) {
        normalizedItems.push(item);
        continue;
      }

      const resolved = await this.pricingPoliciesService.resolvePrice({
        productId: item.productId,
        buyerId: contractData.buyerId,
        quantity: Number(item.quantity),
        incoterm,
        currency,
      });

      normalizedItems.push({
        ...item,
        unitPrice: resolved.unitPrice,
      });
    }

    return normalizedItems;
  }

  calculate(dto: any) {
    return this.incotermsService.calculateTotal(dto);
  }

  async create(dto: any, user: any) {
    const existing = await this.contractRepository.findOne({ where: { contractNumber: dto.contractNumber } });
    if (existing) {
      throw new ConflictException(`Sales contract number already exists: ${dto.contractNumber}`);
    }

    return this.dataSource.transaction(async (manager) => {
      const { items, ...data } = dto;
      const normalizedItems = await this.applyPricingPolicies(items || [], data);

      if (data.proformaInvoiceId) {
        const pi = await manager.findOne(ProformaInvoice, { where: { _id: data.proformaInvoiceId } });
        if (pi?.salesContractId) {
          throw new ConflictException(`Proforma Invoice ${pi.piNumber} already has a sales contract.`);
        }
      }

      const contract = manager.create(SalesContract, {
        ...data,
        status: SalesContractStatus.DRAFT,
        signatureStatus: SalesContractSignatureStatus.NOT_SENT,
      });

      const { totalAmount, totalAmountVnd } = this.incotermsService.calculateTotal({
        ...data,
        items: normalizedItems,
      });
      contract.totalAmount = totalAmount;
      contract.totalAmountVnd = totalAmountVnd;

      const saved = await manager.save(contract);

      if (normalizedItems.length > 0) {
        const contractItems = normalizedItems.map((item: any) =>
          manager.create(SalesContractItem, {
            ...item,
            salesContractId: saved._id,
            totalPrice: Number(item.quantity || 0) * Number(item.unitPrice || 0),
          }),
        );

        await manager.save(SalesContractItem, contractItems);
      }

      await this.pricingPoliciesService.recordDocumentHistory({
        sourceType: SalesPriceSourceType.SALES_CONTRACT,
        sourceId: saved._id,
        sourceNumber: saved.contractNumber,
        buyerId: saved.buyerId,
        salesContractId: saved._id,
        incoterm: saved.incoterm,
        currency: saved.currencyCode,
        exchangeRate: saved.exchangeRate,
        createdByUsername: this.getActorUsername(user),
        items: normalizedItems,
      });

      if (data.proformaInvoiceId) {
        await manager.update(ProformaInvoice, { _id: data.proformaInvoiceId }, { salesContractId: saved._id });
      }

      return manager.findOne(SalesContract, {
        where: { _id: saved._id },
        relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      });
    });
  }

  async findAll(query: any) {
    const current = +query.current || 1;
    const pageSize = +query.pageSize || 10;
    const filters = { ...query };
    ['current', 'pageSize', 'limit', 'skip'].forEach((key) => delete filters[key]);

    const [results, total] = await this.contractRepository.findAndCount({
      where: filters,
      relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      skip: (current - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

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
    const contract = await this.contractRepository.findOne({
      where: { _id: recordId },
      relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      order: { signatures: { signedAt: 'ASC' } },
    });
    if (!contract) throw new NotFoundException('Sales contract not found');
    return contract;
  }

  async update(recordId: string, dto: any) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, { where: { _id: recordId } });
      if (!contract) throw new NotFoundException('Sales contract not found');
      if (![SalesContractStatus.DRAFT, SalesContractStatus.REJECTED].includes(contract.status)) {
        throw new BadRequestException('Only DRAFT or REJECTED sales contracts can be updated.');
      }

      const { items, ...data } = dto;
      const calculationInput = { ...contract, ...data };
      calculationInput.items = items || await manager.find(SalesContractItem, { where: { salesContractId: recordId } });

      const { totalAmount, totalAmountVnd } = this.incotermsService.calculateTotal(calculationInput);

      Object.assign(contract, {
        ...data,
        totalAmount,
        totalAmountVnd,
        status: SalesContractStatus.DRAFT,
        approvalWorkflowRequestId: null,
        submittedForApprovalByUsername: null,
        submittedForApprovalAt: null,
        approvedByUsername: null,
        approvedAt: null,
        rejectedByUsername: null,
        rejectedAt: null,
        rejectionReason: null,
      });

      const saved = await manager.save(contract);

      if (items) {
        await manager.delete(SalesContractItem, { salesContractId: recordId });
        const contractItems = items.map((item: any) =>
          manager.create(SalesContractItem, {
            ...item,
            salesContractId: saved._id,
            totalPrice: Number(item.quantity || 0) * Number(item.unitPrice || 0),
          }),
        );
        await manager.save(SalesContractItem, contractItems);
      }

      if (data.logisticsPartnerId || data.bookingNumber) {
        const updateData: any = {};
        if (data.logisticsPartnerId) updateData.logisticsPartnerId = data.logisticsPartnerId;
        if (data.bookingNumber) updateData.bookingNumber = data.bookingNumber;
        await manager.getRepository('Shipment').update({ salesContractId: recordId }, updateData);
      }

      return manager.findOne(SalesContract, {
        where: { _id: saved._id },
        relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      });
    });
  }

  async submitForApproval(recordId: string, user?: { username?: string }) {
    const contract = await this.findOne(recordId);
    if (contract.status === SalesContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Sales contract is already pending approval.');
    }
    if (![SalesContractStatus.DRAFT, SalesContractStatus.REJECTED].includes(contract.status)) {
      throw new BadRequestException('Only DRAFT or REJECTED sales contracts can be submitted for approval.');
    }

    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.SALES_CONTRACT,
      Number(contract.totalAmountVnd || 0),
      contract.currencyCode,
    );

    if (!matchingRule) {
      throw new BadRequestException(
        'Chua co approval rule cho sales contract; khong duoc auto-approve ngoai approval matrix',
      );
    }

    const approvalRequest = await this.approvalMatrixService.createRequest(
      {
        ruleId: matchingRule._id,
        documentType: ApprovalDocumentType.SALES_CONTRACT,
        documentId: contract._id,
        documentNumber: contract.contractNumber,
        title: `Approve Sales Contract ${contract.contractNumber}`,
        currency: contract.currencyCode,
        amount: Number(contract.totalAmount || 0),
        amountVnd: Number(contract.totalAmountVnd || 0),
        metadata: {
          buyerId: contract.buyerId,
          buyerName: contract.buyer?.name || null,
          source: 'sales_contracts.submitForApproval',
        },
      },
      user,
    );

    await this.contractRepository.update(
      { _id: recordId },
      {
        status: SalesContractStatus.PENDING_APPROVAL,
        approvalWorkflowRequestId: approvalRequest?._id || null,
        submittedForApprovalByUsername: this.getActorUsername(user),
        submittedForApprovalAt: new Date(),
        rejectedByUsername: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    );

    return {
      ...(await this.findOne(recordId)),
      approvalRequest,
    };
  }

  async completeApprovalWorkflow(recordId: string, requestId: string, username: string) {
    const contract = await this.contractRepository.findOne({ where: { _id: recordId } });
    if (!contract || contract.status !== SalesContractStatus.PENDING_APPROVAL) return contract;

    contract.status = SalesContractStatus.APPROVED;
    contract.approvalWorkflowRequestId = requestId;
    contract.approvedByUsername = username;
    contract.approvedAt = new Date();
    contract.rejectedByUsername = null;
    contract.rejectedAt = null;
    contract.rejectionReason = null;
    return this.contractRepository.save(contract);
  }

  async rejectApprovalWorkflow(recordId: string, requestId: string, username: string, reason?: string | null) {
    const contract = await this.contractRepository.findOne({ where: { _id: recordId } });
    if (!contract || contract.status !== SalesContractStatus.PENDING_APPROVAL) return contract;

    contract.status = SalesContractStatus.REJECTED;
    contract.approvalWorkflowRequestId = requestId;
    contract.rejectedByUsername = username;
    contract.rejectedAt = new Date();
    contract.rejectionReason = reason || 'Rejected by approval workflow';
    return this.contractRepository.save(contract);
  }

  async requestCancelContract(
    recordId: string,
    dto: { reason: string },
    user?: { username?: string },
  ) {
    const contract = await this.findOne(recordId);
    const cancellableStatuses = [
      SalesContractStatus.APPROVED,
      SalesContractStatus.PENDING_BUYER_SIGNATURE,
      SalesContractStatus.BUYER_SIGNED,
      SalesContractStatus.CONFIRMED,
    ];

    if (contract.status === SalesContractStatus.PENDING_CANCEL_APPROVAL) {
      throw new BadRequestException('Sales contract is already pending cancel approval.');
    }
    if (!cancellableStatuses.includes(contract.status)) {
      throw new BadRequestException('Only approved/signed/confirmed contracts can request cancellation.');
    }

    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Cancellation reason is required.');

    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.SALES_CONTRACT_CANCEL,
      Number(contract.totalAmountVnd || 0),
      contract.currencyCode,
    );
    if (!matchingRule) {
      throw new BadRequestException(
        'Chua co approval rule cho contract cancel; khong duoc huy contract truc tiep',
      );
    }

    const approvalRequest = await this.approvalMatrixService.createRequest(
      {
        ruleId: matchingRule._id,
        documentType: ApprovalDocumentType.SALES_CONTRACT_CANCEL,
        documentId: contract._id,
        documentNumber: contract.contractNumber,
        title: `Approve Sales Contract Cancel ${contract.contractNumber}`,
        currency: contract.currencyCode,
        amount: Number(contract.totalAmount || 0),
        amountVnd: Number(contract.totalAmountVnd || 0),
        metadata: {
          buyerId: contract.buyerId,
          buyerName: contract.buyer?.name || null,
          previousStatus: contract.status,
          reason,
          source: 'sales_contracts.requestCancelContract',
        },
      },
      user,
    );

    await this.contractRepository.update(
      { _id: recordId },
      {
        status: SalesContractStatus.PENDING_CANCEL_APPROVAL,
        approvalWorkflowRequestId: approvalRequest?._id || null,
        submittedForApprovalByUsername: this.getActorUsername(user),
        submittedForApprovalAt: new Date(),
        cancellationReason: reason,
        rejectedByUsername: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    );

    return {
      ...(await this.findOne(recordId)),
      approvalRequest,
    };
  }

  async completeCancelWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract || contract.status !== SalesContractStatus.PENDING_CANCEL_APPROVAL) return contract;

      contract.items = await manager.find(SalesContractItem, { where: { salesContractId: recordId } });
      const previousStatus =
        typeof metadata?.previousStatus === 'string' &&
        Object.values(SalesContractStatus).includes(metadata.previousStatus as SalesContractStatus)
          ? (metadata.previousStatus as SalesContractStatus)
          : null;

      if (previousStatus === SalesContractStatus.CONFIRMED) {
        for (const item of contract.items) {
          await this.inventoryService.releaseStock(item.productId, item.quantity, contract._id, manager);
        }
      }

      contract.status = SalesContractStatus.CANCELLED;
      contract.approvalWorkflowRequestId = requestId;
      contract.cancelledByUsername = username;
      contract.cancelledAt = new Date();
      contract.cancellationReason =
        typeof metadata?.reason === 'string' && metadata.reason.trim()
          ? metadata.reason.trim()
          : contract.cancellationReason;
      contract.rejectedByUsername = null;
      contract.rejectedAt = null;
      contract.rejectionReason = null;

      return manager.save(contract);
    });
  }

  async rejectCancelWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    reason?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    const contract = await this.contractRepository.findOne({ where: { _id: recordId } });
    if (!contract || contract.status !== SalesContractStatus.PENDING_CANCEL_APPROVAL) return contract;

    const previousStatus =
      typeof metadata?.previousStatus === 'string' &&
      Object.values(SalesContractStatus).includes(metadata.previousStatus as SalesContractStatus)
        ? (metadata.previousStatus as SalesContractStatus)
        : SalesContractStatus.APPROVED;

    contract.status = previousStatus;
    contract.approvalWorkflowRequestId = requestId;
    contract.rejectedByUsername = username;
    contract.rejectedAt = new Date();
    contract.rejectionReason = reason || 'Cancel request rejected by approval workflow';
    return this.contractRepository.save(contract);
  }

  async sendForSignature(
    recordId: string,
    dto: RequestSignatureInvitationDto = {},
    user?: { username?: string },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) throw new NotFoundException('Sales contract not found');
      if (contract.status !== SalesContractStatus.APPROVED) {
        throw new BadRequestException('Only APPROVED sales contracts can be sent for signature.');
      }

      const signerName = dto.signerName?.trim() || contract.buyer?.contactName || contract.buyer?.name;
      const signerEmail = dto.signerEmail?.trim() || contract.buyer?.email;
      if (!signerName) throw new BadRequestException('Buyer signer name is required.');
      if (!signerEmail) throw new BadRequestException('Buyer signer email is required for secure signing invitation.');

      const activeStatuses = [
        ContractSignatureInvitationStatus.CREATED,
        ContractSignatureInvitationStatus.SENT,
        ContractSignatureInvitationStatus.OPENED,
        ContractSignatureInvitationStatus.OTP_VERIFIED,
      ];
      const previousInvitations = await manager.find(ContractSignatureInvitation, {
        where: { contractId: recordId, signerType: ContractSignerType.BUYER },
      });
      for (const invitation of previousInvitations.filter((item) => activeStatuses.includes(item.status))) {
        invitation.status = ContractSignatureInvitationStatus.REVOKED;
        invitation.revokedAt = new Date();
        invitation.revokedByUsername = this.getActorUsername(user);
        invitation.revokeReason = 'Superseded by a new buyer signature invitation';
        this.appendInvitationAudit(invitation, 'REVOKED', {
          actorUsername: this.getActorUsername(user),
          note: invitation.revokeReason,
        });
        await manager.save(invitation);
      }

      const now = new Date();
      const rawToken = this.generateSigningToken();
      const rawOtp = this.generateOtp();
      const tokenHash = this.hashSecret(rawToken);
      const expiresInDays = dto.expiresInDays || 7;
      const invitation = manager.create(ContractSignatureInvitation, {
        contractId: recordId,
        signerType: ContractSignerType.BUYER,
        signerName,
        signerTitle: dto.signerTitle?.trim() || 'Authorized Representative',
        signerEmail,
        status: ContractSignatureInvitationStatus.CREATED,
        tokenHash,
        otpHash: this.hashOtp(rawOtp, tokenHash),
        otpExpiresAt: this.addMinutes(now, 15),
        expiresAt: this.addDays(now, expiresInDays),
        sentByUsername: this.getActorUsername(user),
        sentAt: now,
        auditTrail: [],
      });
      this.appendInvitationAudit(invitation, 'INVITATION_CREATED', {
        actorUsername: this.getActorUsername(user),
        note: `Invitation expires in ${expiresInDays} day(s)`,
      });

      const savedInvitation = await manager.save(invitation);
      const signingUrl = this.buildFrontendSigningUrl(rawToken);
      const deliveryStatus = await this.deliverSignatureInvitation(
        savedInvitation,
        contract,
        signingUrl,
        rawOtp,
      );
      savedInvitation.status = ContractSignatureInvitationStatus.SENT;
      this.appendInvitationAudit(savedInvitation, deliveryStatus, {
        actorUsername: this.getActorUsername(user),
        note: deliveryStatus === 'EMAIL_SENT' ? 'Signer invitation email sent' : 'Email delivery failed or SMTP not configured',
      });
      await manager.save(savedInvitation);

      contract.status = SalesContractStatus.PENDING_BUYER_SIGNATURE;
      contract.signatureStatus = SalesContractSignatureStatus.PENDING_BUYER;
      contract.signatureRequestedByUsername = this.getActorUsername(user);
      contract.signatureRequestedAt = now;
      await manager.save(contract);

      const refreshed = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      });

      return {
        contract: refreshed,
        invitation: this.toInvitationResponse(savedInvitation, signingUrl),
        deliveryStatus,
      };
    });
  }

  async getSigningSession(token: string, meta?: RequestMeta): Promise<SigningSessionResponse> {
    const invitation = await this.findInvitationByToken(token);
    await this.ensureInvitationUsable(invitation);

    if (invitation.status === ContractSignatureInvitationStatus.SENT) {
      invitation.status = ContractSignatureInvitationStatus.OPENED;
      invitation.openedAt = new Date();
      this.appendInvitationAudit(invitation, 'OPENED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        note: 'Buyer opened signing portal',
      });
      await this.signatureInvitationRepository.save(invitation);
    }

    return this.toSigningSessionResponse(invitation);
  }

  async verifySignatureOtp(
    token: string,
    dto: VerifySignatureOtpDto,
    meta?: RequestMeta,
  ): Promise<SigningSessionResponse> {
    const invitation = await this.findInvitationByToken(token);
    await this.ensureInvitationUsable(invitation);

    if (invitation.status === ContractSignatureInvitationStatus.OTP_VERIFIED) {
      return this.toSigningSessionResponse(invitation);
    }
    if (invitation.otpAttemptCount >= 5) {
      throw new BadRequestException('OTP attempt limit exceeded. Please request a new signing invitation.');
    }
    if (invitation.otpExpiresAt.getTime() < Date.now()) {
      this.appendInvitationAudit(invitation, 'OTP_EXPIRED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
      });
      await this.signatureInvitationRepository.save(invitation);
      throw new BadRequestException('OTP has expired. Please request a new signing invitation.');
    }

    const incomingHash = this.hashOtp(dto.otp.trim(), invitation.tokenHash);
    if (incomingHash !== invitation.otpHash) {
      invitation.otpAttemptCount = Number(invitation.otpAttemptCount || 0) + 1;
      this.appendInvitationAudit(invitation, 'OTP_FAILED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        note: `Attempt ${invitation.otpAttemptCount}/5`,
      });
      await this.signatureInvitationRepository.save(invitation);
      throw new BadRequestException('OTP is invalid.');
    }

    invitation.status = ContractSignatureInvitationStatus.OTP_VERIFIED;
    invitation.verifiedAt = new Date();
    this.appendInvitationAudit(invitation, 'OTP_VERIFIED', {
      ipAddress: meta?.ipAddress || null,
      userAgent: meta?.userAgent || null,
      note: 'Buyer verified OTP',
    });
    await this.signatureInvitationRepository.save(invitation);

    return this.toSigningSessionResponse(invitation);
  }

  async signContractFromInvitation(
    token: string,
    dto: PortalSignSalesContractDto,
    meta?: RequestMeta,
  ): Promise<{ session: SigningSessionResponse; auditPacket: SignatureAuditPacket }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await this.findInvitationByToken(token, manager, true);
      await this.ensureInvitationUsable(invitation, manager);

      if (dto.otp && invitation.status !== ContractSignatureInvitationStatus.OTP_VERIFIED) {
        const incomingHash = this.hashOtp(dto.otp.trim(), invitation.tokenHash);
        if (incomingHash !== invitation.otpHash || invitation.otpExpiresAt.getTime() < Date.now()) {
          invitation.otpAttemptCount = Number(invitation.otpAttemptCount || 0) + 1;
          this.appendInvitationAudit(invitation, 'OTP_FAILED_AT_SIGNING', {
            ipAddress: meta?.ipAddress || null,
            userAgent: meta?.userAgent || null,
          });
          await manager.save(invitation);
          throw new BadRequestException('OTP is invalid or expired.');
        }
        invitation.status = ContractSignatureInvitationStatus.OTP_VERIFIED;
        invitation.verifiedAt = new Date();
        this.appendInvitationAudit(invitation, 'OTP_VERIFIED', {
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          note: 'OTP verified during signing submit',
        });
      }

      if (invitation.status !== ContractSignatureInvitationStatus.OTP_VERIFIED) {
        throw new BadRequestException('OTP verification is required before signing.');
      }

      const contract = invitation.contract;
      if (contract.status !== SalesContractStatus.PENDING_BUYER_SIGNATURE) {
        throw new BadRequestException('Sales contract is not pending buyer signature.');
      }

      const signatures = await manager.find(ContractSignature, {
        where: { contractId: contract._id },
        order: { signedAt: 'ASC' },
      });
      if (signatures.some((signature) => signature.signerType === ContractSignerType.BUYER)) {
        throw new BadRequestException('Buyer signature already exists.');
      }
      contract.signatures = signatures;

      const documentHash = this.buildContractHash(contract);
      const now = new Date();
      const signature = manager.create(ContractSignature, {
        contractId: contract._id,
        signerType: ContractSignerType.BUYER,
        signerName: dto.signerName.trim(),
        signerTitle: dto.signerTitle?.trim() || invitation.signerTitle || null,
        signerEmail: dto.signerEmail?.trim() || invitation.signerEmail || null,
        signatureImageFileId: dto.signatureImageFileId?.trim() || null,
        signedByUsername: null,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        signedAt: now,
        consentText: dto.consentText.trim(),
        documentHash,
      });
      const savedSignature = await manager.save(signature);

      contract.status = SalesContractStatus.BUYER_SIGNED;
      contract.signatureStatus = SalesContractSignatureStatus.BUYER_SIGNED;
      contract.buyerSignedAt = now;
      contract.signatureDocumentHash = documentHash;
      await manager.save(contract);

      invitation.status = ContractSignatureInvitationStatus.SIGNED;
      invitation.signerName = savedSignature.signerName;
      invitation.signerTitle = savedSignature.signerTitle;
      invitation.signerEmail = savedSignature.signerEmail;
      invitation.signedAt = now;
      invitation.certificateNumber = `SC-CERT-${contract.contractNumber.replace(/[^A-Za-z0-9]/g, '')}-${now.getTime()}`;
      invitation.certificateHash = this.hashSecret([
        invitation._id,
        savedSignature._id,
        documentHash,
        invitation.certificateNumber,
      ].join('::'));
      this.appendInvitationAudit(invitation, 'CONTRACT_SIGNED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        note: `Certificate ${invitation.certificateNumber}`,
      });
      await manager.save(invitation);

      const refreshedInvitation = await manager.findOne(ContractSignatureInvitation, {
        where: { _id: invitation._id },
        relations: this.getSignatureInvitationRelations(),
      });
      if (!refreshedInvitation) throw new NotFoundException('Signature invitation not found.');

      return refreshedInvitation;
    });

    const session = this.toSigningSessionResponse(result);
    return {
      session,
      auditPacket: this.buildSignatureAuditPacket(result.contract),
    };
  }

  async getSignatureAuditPacket(recordId: string): Promise<SignatureAuditPacket> {
    const contract = await this.contractRepository.findOne({
      where: { _id: recordId },
      relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      order: {
        signatures: { signedAt: 'ASC' },
        signatureInvitations: { createdAt: 'ASC' },
      },
    });
    if (!contract) throw new NotFoundException('Sales contract not found');

    return this.buildSignatureAuditPacket(contract);
  }

  private getSignatureAuditPacketPdfDefinition(packet: SignatureAuditPacket) {
    const timelineRows = packet.timeline.length
      ? packet.timeline.map((event) => [
          String(event.action || '-'),
          event.at ? new Date(event.at).toISOString() : '-',
          event.actor || '-',
          event.ipAddress || '-',
          event.note || '-',
        ])
      : [['-', '-', '-', '-', '-']];

    const signatureRows = packet.signatures.length
      ? packet.signatures.map((signature) => [
          signature.signerType,
          signature.signerName,
          signature.signerTitle || '-',
          signature.signedAt ? new Date(signature.signedAt).toISOString() : '-',
          signature.documentHash || '-',
        ])
      : [['-', '-', '-', '-', '-']];

    return {
      content: [
        { text: 'SIGNATURE AUDIT PACKET', style: 'header', alignment: 'center' },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: `Contract: ${packet.contract.contractNumber}`, bold: true },
                { text: `Contract _id: ${packet.contract._id}` },
                { text: `Buyer: ${packet.contract.buyerName || '-'}` },
                { text: `Amount: ${packet.contract.totalAmount} ${packet.contract.currencyCode}` },
              ],
            },
            {
              width: '*',
              stack: [
                { text: `Certificate: ${packet.certificate.certificateNumber || '-'}`, bold: true },
                { text: `Generated: ${packet.certificate.generatedAt}` },
                { text: `Packet hash: ${packet.certificate.packetHash}` },
              ],
            },
          ],
          margin: [0, 0, 0, 16],
        },
        { text: 'Certificate Hash', style: 'subheader' },
        { text: packet.certificate.certificateHash || '-', style: 'mono' },
        { text: 'Document Hash', style: 'subheader' },
        { text: packet.contract.documentHash || '-', style: 'mono' },
        { text: 'Signatures', style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', 'auto', '*'],
            body: [
              ['Type', 'Signer', 'Title', 'Signed At', 'Document Hash'],
              ...signatureRows,
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { text: 'Timeline', style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', '*', 'auto', '*'],
            body: [
              ['Action', 'At', 'Actor', 'IP', 'Note'],
              ...timelineRows,
            ],
          },
          layout: 'lightHorizontalLines',
        },
        {
          text: 'This artifact is generated from the immutable signature audit packet held by Mini ERP.',
          style: 'footer',
          margin: [0, 18, 0, 0],
        },
      ],
      styles: {
        header: { fontSize: 20, bold: true, margin: [0, 0, 0, 14] },
        subheader: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] },
        mono: { font: 'Courier', fontSize: 8 },
        footer: { fontSize: 9, italics: true, alignment: 'center' },
      },
      defaultStyle: { font: 'Helvetica', fontSize: 9 },
    };
  }

  async getSignatureAuditPacketPdf(recordId: string): Promise<Buffer> {
    const packet = await this.getSignatureAuditPacket(recordId);
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
      Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
      },
    };

    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(this.getSignatureAuditPacketPdfDefinition(packet));

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (error: Error) => reject(error));
      pdfDoc.end();
    });
  }

  async signContract(
    recordId: string,
    dto: SignSalesContractDto,
    user?: { username?: string },
    meta?: RequestMeta,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) throw new NotFoundException('Sales contract not found');

      contract.items = await manager.find(SalesContractItem, { where: { salesContractId: recordId } });
      contract.signatures = await manager.find(ContractSignature, {
        where: { contractId: recordId },
        order: { signedAt: 'ASC' },
      });

      const signerType = dto.signerType;
      const hasBuyerSignature = contract.signatures.some((signature) => signature.signerType === ContractSignerType.BUYER);
      const hasInternalSignature = contract.signatures.some((signature) => signature.signerType === ContractSignerType.INTERNAL);

      if (signerType === ContractSignerType.BUYER) {
        if (contract.status !== SalesContractStatus.PENDING_BUYER_SIGNATURE) {
          throw new BadRequestException('Buyer can only sign contracts pending buyer signature.');
        }
        if (hasBuyerSignature) throw new BadRequestException('Buyer signature already exists.');
      }

      if (signerType === ContractSignerType.INTERNAL) {
        if (contract.status !== SalesContractStatus.BUYER_SIGNED) {
          throw new BadRequestException('Internal counter-signature requires buyer-signed status first.');
        }
        if (hasInternalSignature) throw new BadRequestException('Internal signature already exists.');
      }

      const documentHash = this.buildContractHash(contract);
      const now = new Date();
      const signature = manager.create(ContractSignature, {
        contractId: recordId,
        signerType,
        signerName: dto.signerName.trim(),
        signerTitle: dto.signerTitle?.trim() || null,
        signerEmail: dto.signerEmail?.trim() || null,
        signatureImageFileId: dto.signatureImageFileId?.trim() || null,
        signedByUsername: signerType === ContractSignerType.INTERNAL ? this.getActorUsername(user) : user?.username || null,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        signedAt: now,
        consentText: dto.consentText?.trim() || 'Signer confirms agreement to the sales contract terms.',
        documentHash,
      });
      await manager.save(signature);

      if (signerType === ContractSignerType.BUYER) {
        contract.status = SalesContractStatus.BUYER_SIGNED;
        contract.signatureStatus = SalesContractSignatureStatus.BUYER_SIGNED;
        contract.buyerSignedAt = now;
        contract.signatureDocumentHash = documentHash;
        await manager.save(contract);
        return manager.findOne(SalesContract, {
          where: { _id: recordId },
          relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
        });
      }

      contract.counterSignedAt = now;
      contract.signatureStatus = SalesContractSignatureStatus.COMPLETED;
      contract.signatureDocumentHash = documentHash;
      await this.reserveAndConfirm(contract, manager);

      return manager.findOne(SalesContract, {
        where: { _id: recordId },
        relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      });
    });
  }

  private async reserveAndConfirm(contract: SalesContract, manager: EntityManager) {
    if (![SalesContractStatus.APPROVED, SalesContractStatus.BUYER_SIGNED].includes(contract.status)) {
      throw new BadRequestException('Sales contract must be APPROVED or BUYER_SIGNED before confirmation.');
    }

    contract.items = contract.items?.length
      ? contract.items
      : await manager.find(SalesContractItem, { where: { salesContractId: contract._id } });
    if (!contract.items.length) throw new BadRequestException('Sales contract has no items to confirm.');

    // Stock reservation is the irreversible operational handoff from commercial
    // contract to warehouse execution, so it runs only after approval/signature.
    for (const item of contract.items) {
      await this.inventoryService.reserveStock(item.productId, item.quantity, contract._id, manager);
    }

    contract.status = SalesContractStatus.CONFIRMED;
    return manager.save(contract);
  }

  async confirmContract(recordId: string, user?: { username?: string }): Promise<SalesContract> {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!contract) throw new NotFoundException('Sales contract not found');
      contract.items = await manager.find(SalesContractItem, { where: { salesContractId: recordId } });

      await this.reserveAndConfirm(contract, manager);
      if (contract.status === SalesContractStatus.CONFIRMED && contract.approvedByUsername === null) {
        contract.approvedByUsername = this.getActorUsername(user);
        contract.approvedAt = new Date();
        await manager.save(contract);
      }

      return manager.findOne(SalesContract, {
        where: { _id: recordId },
        relations: ['buyer', 'items', 'items.product', 'signatures', 'signatureInvitations'],
      }) as Promise<SalesContract>;
    });
  }

  async shipContract(recordId: string, user?: { username?: string }): Promise<SalesContract> {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!contract) throw new NotFoundException('Sales contract not found');
      contract.items = await manager.find(SalesContractItem, { where: { salesContractId: recordId } });
      contract.buyer = await manager.findOne(Partner, { where: { _id: contract.buyerId } }) as any;

      if (contract.status !== SalesContractStatus.CONFIRMED) {
        throw new BadRequestException('Sales contract must be CONFIRMED before shipment.');
      }

      contract.status = SalesContractStatus.SHIPPED;
      return manager.save(contract);
    });
  }

  async cancelContract(recordId: string): Promise<SalesContract> {
    void recordId;
    throw new BadRequestException(
      'Sales contract cancellation phai di qua approval-matrix request',
    );
  }
}
