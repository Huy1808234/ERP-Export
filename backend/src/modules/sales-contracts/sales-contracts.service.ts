import { createHash, randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import {
  SalesContract,
  SalesContractSignatureStatus,
  SalesContractStatus,
} from './entities/sales-contract.entity';
import { SalesContractItem } from './entities/sales-contract-item.entity';
import {
  ContractSignature,
  ContractSignerType,
} from './entities/contract-signature.entity';
import {
  ContractSignatureInvitation,
  ContractSignatureInvitationAuditEvent,
  ContractSignatureInvitationStatus,
} from './entities/contract-signature-invitation.entity';
import {
  ContractSignatureActorType,
  ContractSignatureEvent,
  ContractSignatureEventType,
} from './entities/contract-signature-event.entity';
import { SignSalesContractDto } from './dto/sign-sales-contract.dto';
import { RequestSignatureInvitationDto } from './dto/request-signature-invitation.dto';
import { VerifySignatureOtpDto } from './dto/verify-signature-otp.dto';
import { PortalSignSalesContractDto } from './dto/portal-sign-sales-contract.dto';
import {
  CreateSalesContractDto,
  SalesContractItemDto,
} from './dto/create-sales-contract.dto';
import { UpdateSalesContractDto } from './dto/update-sales-contract.dto';
import { CalculateSalesContractDto } from './dto/calculate-sales-contract.dto';
import { InventoryService } from '../inventory/inventory.service';
import { IncotermsService } from './incoterms.service';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Incoterm } from '../quotations/entities/quotation.entity';
import { PricingPoliciesService } from '../pricing-policies/pricing-policies.service';
import { SalesPriceSourceType } from '../pricing-policies/entities/sales-price-history.entity';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import { renderPdfBuffer } from '@/common/pdfmake-server.util';
import { PortsService } from '../ports/ports.service';
import { UsersService } from '../users/users.service';
import { AccountReceivablesService } from '../account-receivables/account-receivables.service';
import { comparePasswordHelper } from '@/helpers/util';

import { UnauthorizedException } from '@nestjs/common';

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type RequestUser = {
  username?: string;
};

type SalesContractRouteInput = {
  pol?: string | null;
  pol_port_id?: string | null;
  pod?: string | null;
  pod_port_id?: string | null;
};

type SalesContractRoutePatchInput = SalesContractRouteInput & {
  hasPol: boolean;
  hasPolPortId: boolean;
  hasPod: boolean;
  hasPodPortId: boolean;
  currentPol?: string | null;
  currentPolPortId?: string | null;
  currentPod?: string | null;
  currentPodPortId?: string | null;
};

type SalesContractPricingContext = {
  buyerId?: string;
  incoterm?: Incoterm;
  currencyCode?: string;
  pol_port_id?: string | null;
  pod_port_id?: string | null;
};

type SalesContractListQuery = Record<
  string,
  string | number | boolean | undefined
>;

type SignaturePacketEvent = {
  action: string;
  at: string | Date;
  actor: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  note?: string | null;
};

type SignatureDeliveryStatus = 'EMAIL_SENT' | 'EMAIL_FAILED' | 'EMAIL_SKIPPED';

type RecordSignatureEventInput = {
  contractId: string;
  invitationId?: string | null;
  signatureId?: string | null;
  eventType: ContractSignatureEventType;
  actorType: ContractSignatureActorType;
  actorUsername?: string | null;
  signerEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  documentHash?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CreateBuyerSignatureInvitationInput = {
  manager: EntityManager;
  contract: SalesContract;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  actorUsername: string;
  expiresInDays: number;
  documentHash: string;
  note?: string | null;
};

type SignatureInvitationResponse = {
  _id: string;
  signerType: ContractSignerType;
  signerName: string;
  signerTitle: string | null;
  signerEmailMasked: string | null;
  status: ContractSignatureInvitationStatus;
  expiresAt: Date;
  otpExpiresAt: Date | null;
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
    @InjectRepository(ContractSignatureEvent)
    private readonly signatureEventRepository: Repository<ContractSignatureEvent>,
    private readonly dataSource: DataSource,
    private readonly mailerService: MailerService,
    private readonly inventoryService: InventoryService,
    private readonly incotermsService: IncotermsService,
    private readonly pricingPoliciesService: PricingPoliciesService,
    private readonly approvalMatrixService: ApprovalMatrixService,
    private readonly portsService: PortsService,
    private readonly usersService: UsersService,
    private readonly arService: AccountReceivablesService,
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

  private async resolveContractPorts(
    data: SalesContractRouteInput,
  ): Promise<SalesContractRouteInput> {
    const loading = await this.portsService.resolvePortSnapshot(
      data.pol_port_id,
      data.pol,
    );
    const discharge = await this.portsService.resolvePortSnapshot(
      data.pod_port_id,
      data.pod,
    );

    return {
      pol_port_id: loading.port_id,
      pol: loading.label,
      pod_port_id: discharge.port_id,
      pod: discharge.label,
    };
  }

  private async resolveContractPortsForUpdate(
    data: SalesContractRoutePatchInput,
  ): Promise<SalesContractRouteInput> {
    const loading = await this.portsService.resolvePortSnapshotPatch({
      incomingPortRef: data.pol_port_id,
      incomingLabel: data.pol,
      currentPortRef: data.currentPolPortId,
      currentLabel: data.currentPol,
      hasIncomingPortRef: data.hasPolPortId,
      hasIncomingLabel: data.hasPol,
    });
    const discharge = await this.portsService.resolvePortSnapshotPatch({
      incomingPortRef: data.pod_port_id,
      incomingLabel: data.pod,
      currentPortRef: data.currentPodPortId,
      currentLabel: data.currentPod,
      hasIncomingPortRef: data.hasPodPortId,
      hasIncomingLabel: data.hasPod,
    });

    return {
      pol_port_id: loading.port_id,
      pol: loading.label,
      pod_port_id: discharge.port_id,
      pod: discharge.label,
    };
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
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      'http://localhost:3000';
    return `${frontendUrl.replace(/\/$/g, '')}/vi/portal/sign/${token}`;
  }

  private getActiveInvitationStatuses(): ContractSignatureInvitationStatus[] {
    return [
      ContractSignatureInvitationStatus.CREATED,
      ContractSignatureInvitationStatus.SENT,
      ContractSignatureInvitationStatus.OPENED,
      ContractSignatureInvitationStatus.OTP_VERIFIED,
    ];
  }

  private isActiveInvitationStatus(status: ContractSignatureInvitationStatus) {
    return this.getActiveInvitationStatuses().includes(status);
  }

  private async recordSignatureEvent(
    input: RecordSignatureEventInput,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager
      ? manager.getRepository(ContractSignatureEvent)
      : this.signatureEventRepository;

    await repository.save(
      repository.create({
        contractId: input.contractId,
        invitationId: input.invitationId || null,
        signatureId: input.signatureId || null,
        eventType: input.eventType,
        actorType: input.actorType,
        actorUsername: input.actorUsername || null,
        signerEmailMasked: this.maskEmail(input.signerEmail),
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        documentHash: input.documentHash || null,
        note: input.note || null,
        metadata: input.metadata || null,
      }),
    );
  }

  private appendInvitationAudit(
    invitation: ContractSignatureInvitation,
    action: string,
    meta?: RequestMeta & {
      actorUsername?: string | null;
      note?: string | null;
    },
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

  private async persistSignatureInvitation(
    invitation: ContractSignatureInvitation,
    manager?: EntityManager,
  ): Promise<void> {
    const contractId = invitation.contractId || invitation.contract?._id;
    if (!contractId) {
      throw new BadRequestException(
        'Signature invitation is missing contract reference.',
      );
    }

    invitation.contractId = contractId;
    const repository = manager
      ? manager.getRepository(ContractSignatureInvitation)
      : this.signatureInvitationRepository;

    await repository.update(
      { _id: invitation._id },
      {
        contractId,
        signerName: invitation.signerName,
        signerTitle: invitation.signerTitle,
        signerEmail: invitation.signerEmail,
        status: invitation.status,
        otpHash: invitation.otpHash,
        otpExpiresAt: invitation.otpExpiresAt,
        otpAttemptCount: invitation.otpAttemptCount,
        expiresAt: invitation.expiresAt,
        sentByUsername: invitation.sentByUsername,
        sentAt: invitation.sentAt,
        openedAt: invitation.openedAt,
        verifiedAt: invitation.verifiedAt,
        signedAt: invitation.signedAt,
        revokedAt: invitation.revokedAt,
        revokedByUsername: invitation.revokedByUsername,
        revokeReason: invitation.revokeReason,
        certificateNumber: invitation.certificateNumber,
        certificateHash: invitation.certificateHash,
        auditTrail: invitation.auditTrail,
      },
    );
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
      otpExpiresAt: invitation.otpExpiresAt,
      sentAt: invitation.sentAt,
      openedAt: invitation.openedAt,
      verifiedAt: invitation.verifiedAt,
      signedAt: invitation.signedAt,
      certificateNumber: invitation.certificateNumber,
      certificateHash: invitation.certificateHash,
      ...(signingUrl ? { signingUrl } : {}),
    };
  }

  private toSigningSessionResponse(
    invitation: ContractSignatureInvitation,
  ): SigningSessionResponse {
    const contract = invitation.contract;
    return {
      invitation: {
        ...this.toInvitationResponse(invitation),
        otpVerified:
          invitation.status === ContractSignatureInvitationStatus.OTP_VERIFIED,
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
          productName:
            item.product?.vietnameseName || item.product?.englishName || null,
          sku: item.product?.sku || null,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          totalPrice: Number(item.totalPrice || 0),
        })),
      },
      documentHash:
        contract.signatureDocumentHash || this.buildContractHash(contract),
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

  private getContractSignatureRelations() {
    return [
      'buyer',
      'items',
      'items.product',
      'signatures',
      'signatureInvitations',
    ];
  }

  private async findContractWithSignatureRelations(
    manager: EntityManager,
    recordId: string,
  ): Promise<SalesContract> {
    const contract = await manager.findOne(SalesContract, {
      where: { _id: recordId },
      relations: this.getContractSignatureRelations(),
    });
    if (!contract) throw new NotFoundException('Sales contract not found');
    return contract;
  }

  private async findBuyerInvitations(
    manager: EntityManager,
    contractId: string,
  ): Promise<ContractSignatureInvitation[]> {
    return manager.find(ContractSignatureInvitation, {
      where: { contractId, signerType: ContractSignerType.BUYER },
    });
  }

  private getActiveBuyerInvitations(
    invitations: ContractSignatureInvitation[] = [],
  ): ContractSignatureInvitation[] {
    return invitations
      .filter(
        (item) =>
          item.signerType === ContractSignerType.BUYER &&
          this.isActiveInvitationStatus(item.status),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  private async findInvitationByToken(
    token: string,
    manager?: EntityManager,
    lock = false,
  ): Promise<ContractSignatureInvitation> {
    const repository = manager
      ? manager.getRepository(ContractSignatureInvitation)
      : this.signatureInvitationRepository;

    // Decode URL-encoded token (Next.js/NestJS may double-encode special chars)
    const decodedToken = decodeURIComponent(token);

    if (lock) {
      const lockedInvitation = await repository.findOne({
        where: { tokenHash: this.hashSecret(decodedToken) },
        lock: { mode: 'pessimistic_write' as const },
      });

      if (!lockedInvitation) {
        throw new NotFoundException('Signature invitation not found.');
      }

      const invitationWithRelations = await repository.findOne({
        where: { _id: lockedInvitation._id },
        relations: this.getSignatureInvitationRelations(),
      });

      if (!invitationWithRelations) {
        throw new NotFoundException('Signature invitation not found.');
      }

      return invitationWithRelations;
    }

    const invitation = await repository.findOne({
      where: { tokenHash: this.hashSecret(decodedToken) },
      relations: this.getSignatureInvitationRelations(),
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
      throw new BadRequestException(
        'Signature invitation has already been signed.',
      );
    }
    if (
      invitation.status === ContractSignatureInvitationStatus.EXPIRED ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      if (invitation.status !== ContractSignatureInvitationStatus.EXPIRED) {
        invitation.status = ContractSignatureInvitationStatus.EXPIRED;
        this.appendInvitationAudit(invitation, 'EXPIRED', {
          note: 'Invitation expired before signing',
        });
        await this.persistSignatureInvitation(invitation, manager);
        await this.recordSignatureEvent(
          {
            contractId: invitation.contractId,
            invitationId: invitation._id,
            eventType: ContractSignatureEventType.EXPIRED,
            actorType: ContractSignatureActorType.SYSTEM,
            signerEmail: invitation.signerEmail,
            documentHash: invitation.contract?.signatureDocumentHash || null,
            note: 'Invitation expired before signing',
          },
          manager,
        );
      }
      throw new BadRequestException('Signature invitation has expired.');
    }
  }

  private async deliverInvitationEmail(
    invitation: ContractSignatureInvitation,
    contract: SalesContract,
    signingUrl: string,
  ): Promise<SignatureDeliveryStatus> {
    if (!invitation.signerEmail) return 'EMAIL_SKIPPED';

    const expiryDate = new Date(invitation.expiresAt);
    const formattedExpiry = expiryDate.toLocaleDateString('vi-VN', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }) + ' (GMT+7)';

    try {
      await this.mailerService.sendMail({
        to: invitation.signerEmail,
        subject: `Yêu cầu ký hợp đồng: ${contract.contractNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a56db; padding: 20px 24px; color: white;">
              <h2 style="margin: 0;">Yêu cầu ký hợp đồng</h2>
            </div>
            <div style="padding: 24px; background: #f9fafb;">
              <p>Xin chào <strong>${invitation.signerName}</strong>,</p>
              <p>Bạn được mời ký hợp đồng <strong>${contract.contractNumber}</strong>.</p>
              <p>Vui lòng bấm vào đường dẫn bên dưới để xem và ký hợp đồng.</p>
              <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
                <a href="${signingUrl}" style="display: inline-block; background: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ký hợp đồng ngay</a>
                <p style="margin: 12px 0 0; font-size: 12px; color: #6b7280;">
                  Link có hiệu lực đến: ${formattedExpiry}
                </p>
              </div>
              <p style="font-size: 13px; color: #6b7280;">
                Lưu ý: Mã xác thực (OTP) sẽ được gửi đến email này khi bạn bắt đầu quy trình ký.
              </p>
            </div>
          </div>
        `,
      });
      return 'EMAIL_SENT';
    } catch {
      return 'EMAIL_FAILED';
    }
  }

  private async deliverOtpOnlyEmail(
    invitation: ContractSignatureInvitation,
    contract: SalesContract,
    otp: string,
  ): Promise<SignatureDeliveryStatus> {
    if (!invitation.signerEmail) return 'EMAIL_SKIPPED';

    try {
      await this.mailerService.sendMail({
        to: invitation.signerEmail,
        subject: `Mã xác thực ký hợp đồng: ${contract.contractNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #059669; padding: 20px 24px; color: white;">
              <h2 style="margin: 0;">Mã xác thực ký hợp đồng</h2>
            </div>
            <div style="padding: 24px; background: #f9fafb;">
              <p>Xin chào <strong>${invitation.signerName}</strong>,</p>
              <p>Mã xác thực ký hợp đồng <strong>${contract.contractNumber}</strong> của bạn là:</p>
              <div style="background: white; border: 2px solid #059669; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${otp}</span>
                <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">
                  Mã có hiệu lực trong <strong>15 phút</strong>.
                </p>
              </div>
              <p style="font-size: 13px; color: #dc2626;">
                Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua.
              </p>
            </div>
          </div>
        `,
      });
      return 'EMAIL_SENT';
    } catch {
      return 'EMAIL_FAILED';
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

  private async createBuyerSignatureInvitation(
    input: CreateBuyerSignatureInvitationInput,
  ): Promise<{
    invitation: ContractSignatureInvitation;
    signingUrl: string;
    deliveryStatus: SignatureDeliveryStatus;
  }> {
    const now = new Date();
    const rawToken = this.generateSigningToken();
    const tokenHash = this.hashSecret(rawToken);
    const invitation = input.manager.create(ContractSignatureInvitation, {
      contractId: input.contract._id,
      signerType: ContractSignerType.BUYER,
      signerName: input.signerName,
      signerTitle: input.signerTitle,
      signerEmail: input.signerEmail,
      status: ContractSignatureInvitationStatus.CREATED,
      tokenHash,
      expiresAt: this.addDays(now, input.expiresInDays),
      sentByUsername: input.actorUsername,
      sentAt: now,
      auditTrail: [],
    });

    this.appendInvitationAudit(invitation, 'INVITATION_CREATED', {
      actorUsername: input.actorUsername,
      note: input.note || `Invitation expires in ${input.expiresInDays} day(s)`,
    });

    const savedInvitation = await input.manager.save(invitation);
    await this.recordSignatureEvent(
      {
        contractId: input.contract._id,
        invitationId: savedInvitation._id,
        eventType: ContractSignatureEventType.INVITATION_CREATED,
        actorType: ContractSignatureActorType.INTERNAL,
        actorUsername: input.actorUsername,
        signerEmail: savedInvitation.signerEmail,
        documentHash: input.documentHash,
        note: input.note || null,
        metadata: { expiresInDays: input.expiresInDays },
      },
      input.manager,
    );

    const signingUrl = this.buildFrontendSigningUrl(rawToken);
    const deliveryStatus = await this.deliverInvitationEmail(
      savedInvitation,
      input.contract,
      signingUrl,
    );
    const deliveryEventType: Record<
      SignatureDeliveryStatus,
      ContractSignatureEventType
    > = {
      EMAIL_SENT: ContractSignatureEventType.EMAIL_SENT,
      EMAIL_FAILED: ContractSignatureEventType.EMAIL_FAILED,
      EMAIL_SKIPPED: ContractSignatureEventType.EMAIL_SKIPPED,
    };

    savedInvitation.status = ContractSignatureInvitationStatus.SENT;
    this.appendInvitationAudit(savedInvitation, deliveryStatus, {
      actorUsername: input.actorUsername,
      note:
        deliveryStatus === 'EMAIL_SENT'
          ? 'Signer invitation email sent'
          : 'Email delivery failed or SMTP not configured',
    });
    await this.persistSignatureInvitation(savedInvitation, input.manager);
    await this.recordSignatureEvent(
      {
        contractId: input.contract._id,
        invitationId: savedInvitation._id,
        eventType: deliveryEventType[deliveryStatus],
        actorType:
          deliveryStatus === 'EMAIL_SKIPPED'
            ? ContractSignatureActorType.SYSTEM
            : ContractSignatureActorType.INTERNAL,
        actorUsername:
          deliveryStatus === 'EMAIL_SKIPPED' ? null : input.actorUsername,
        signerEmail: savedInvitation.signerEmail,
        documentHash: input.documentHash,
        note:
          deliveryStatus === 'EMAIL_SENT'
            ? 'Signer invitation email sent'
            : 'Email delivery failed or SMTP not configured',
        metadata: { deliveryStatus },
      },
      input.manager,
    );

    return { invitation: savedInvitation, signingUrl, deliveryStatus };
  }

  private async revokeSignatureInvitationEntity(
    manager: EntityManager,
    invitation: ContractSignatureInvitation,
    actorUsername: string,
    reason: string,
    documentHash?: string | null,
  ): Promise<void> {
    invitation.status = ContractSignatureInvitationStatus.REVOKED;
    invitation.revokedAt = new Date();
    invitation.revokedByUsername = actorUsername;
    invitation.revokeReason = reason;
    this.appendInvitationAudit(invitation, 'REVOKED', {
      actorUsername,
      note: reason,
    });
    await this.persistSignatureInvitation(invitation, manager);
    await this.recordSignatureEvent(
      {
        contractId: invitation.contractId,
        invitationId: invitation._id,
        eventType: ContractSignatureEventType.REVOKED,
        actorType: ContractSignatureActorType.INTERNAL,
        actorUsername,
        signerEmail: invitation.signerEmail,
        documentHash: documentHash || null,
        note: reason,
      },
      manager,
    );
  }

  private buildSignatureAuditPacket(
    contract: SalesContract,
    signatureEvents: ContractSignatureEvent[] = [],
  ): SignatureAuditPacket {
    const invitations = [...(contract.signatureInvitations || [])].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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

    if (signatureEvents.length) {
      const eventSignatureIds = new Set(
        signatureEvents
          .map((event) => event.signatureId)
          .filter((signatureId): signatureId is string => Boolean(signatureId)),
      );
      for (const event of signatureEvents) {
        timeline.push({
          action: event.eventType,
          at: event.createdAt,
          actor: event.actorUsername || event.actorType || null,
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
          note: event.note || null,
        });
      }
      for (const signature of signatures.filter(
        (item) => !eventSignatureIds.has(item._id),
      )) {
        timeline.push({
          action: `${signature.signerType}_SIGNED`,
          at: signature.signedAt,
          actor: signature.signedByUsername,
          ipAddress: signature.ipAddress,
          userAgent: signature.userAgent,
          note: signature.signerName,
        });
      }
    } else {
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
    }

    timeline.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
    const signedInvitation = [...invitations]
      .reverse()
      .find((item) => item.status === ContractSignatureInvitationStatus.SIGNED);
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
      invitations: invitations.map((invitation) =>
        this.toInvitationResponse(invitation),
      ),
      timeline,
    };
  }

  private buildContractHash(contract: SalesContract) {
    const itemPayload = (contract.items || [])
      .sort((a, b) =>
        String(a._id || a.productId).localeCompare(
          String(b._id || b.productId),
        ),
      )
      .map(
        (item) =>
          `${item._id || ''}:${item.productId}:${item.quantity}:${item.unitPrice}:${item.totalPrice}`,
      )
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
          contract.pol_port_id || '',
          contract.pol || '',
          contract.pod_port_id || '',
          contract.pod || '',
          contract.bookingNumber || '',
          contract.notes || '',
          itemPayload,
        ].join('::'),
      )
      .digest('hex');
  }

  private async applyPricingPolicies(
    items: SalesContractItemDto[],
    contractData: SalesContractPricingContext,
  ): Promise<SalesContractItemDto[]> {
    const incoterm = contractData.incoterm || Incoterm.FOB;
    const currency = contractData.currencyCode || 'USD';
    const normalizedItems: SalesContractItemDto[] = [];

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
        origin_port_id: contractData.pol_port_id || undefined,
        destination_port_id: contractData.pod_port_id || undefined,
      });

      normalizedItems.push({
        ...item,
        unitPrice: resolved.unitPrice,
      });
    }

    return normalizedItems;
  }

  calculate(dto: CalculateSalesContractDto) {
    return this.incotermsService.calculateTotal(dto);
  }

  async create(dto: CreateSalesContractDto, user: RequestUser) {
    const existing = await this.contractRepository.findOne({
      where: { contractNumber: dto.contractNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Sales contract number already exists: ${dto.contractNumber}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const { items, ...data } = dto;
      let sourcePi: ProformaInvoice | null = null;

      if (data.proformaInvoiceId) {
        sourcePi = await manager.findOne(ProformaInvoice, {
          where: { _id: data.proformaInvoiceId },
        });
        if (sourcePi?.salesContractId) {
          throw new ConflictException(
            `Proforma Invoice ${sourcePi.piNumber} already has a sales contract.`,
          );
        }
      }

      if (!data.paymentTerms) {
        if (sourcePi?.paymentTerms) {
          data.paymentTerms = sourcePi.paymentTerms;
        } else if (data.buyerId) {
          const partner = await manager.findOne(Partner, {
            where: { _id: data.buyerId },
          });
          if (partner?.defaultPaymentTerm) {
            data.paymentTerms = partner.defaultPaymentTerm;
          }
        }
      }

      Object.assign(
        data,
        await this.resolveContractPorts({
          pol_port_id:
            data.pol_port_id ?? sourcePi?.portOfLoading_port_id ?? undefined,
          pol: data.pol ?? sourcePi?.portOfLoading ?? undefined,
          pod_port_id:
            data.pod_port_id ?? sourcePi?.portOfDischarge_port_id ?? undefined,
          pod: data.pod ?? sourcePi?.portOfDischarge ?? undefined,
        }),
      );
      const normalizedItems = await this.applyPricingPolicies(
        items || [],
        data,
      );

      const contract = manager.create(SalesContract, {
        ...data,
        status: SalesContractStatus.DRAFT,
        signatureStatus: SalesContractSignatureStatus.NOT_SENT,
      });

      const { totalAmount, totalAmountVnd } =
        this.incotermsService.calculateTotal({
          ...data,
          items: normalizedItems,
        });
      contract.totalAmount = totalAmount;
      contract.totalAmountVnd = totalAmountVnd;

      const saved = await manager.save(contract);

      if (normalizedItems.length > 0) {
        const contractItems = normalizedItems.map((item) =>
          manager.create(SalesContractItem, {
            ...item,
            salesContractId: saved._id,
            totalPrice:
              Number(item.quantity || 0) * Number(item.unitPrice || 0),
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
        origin_port_id: saved.pol_port_id,
        destination_port_id: saved.pod_port_id,
        items: normalizedItems,
      });

      if (data.proformaInvoiceId) {
        await manager.update(
          ProformaInvoice,
          { _id: data.proformaInvoiceId },
          { salesContractId: saved._id },
        );
      }

      return manager.findOne(SalesContract, {
        where: { _id: saved._id },
        relations: [
          'buyer',
          'items',
          'items.product',
          'signatures',
          'signatureInvitations',
        ],
      });
    });
  }

  async findAll(query: SalesContractListQuery) {
    const current = Number(query.current) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const filters = { ...query };
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filters[key],
    );

    const [results, total] = await this.contractRepository.findAndCount({
      where: filters as FindOptionsWhere<SalesContract>,
      relations: [
        'buyer',
        'items',
        'items.product',
        'signatures',
        'signatureInvitations',
      ],
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
      relations: [
        'buyer',
        'items',
        'items.product',
        'signatures',
        'signatureInvitations',
      ],
      order: { signatures: { signedAt: 'ASC' } },
    });
    if (!contract) throw new NotFoundException('Sales contract not found');

    if (contract.approvedByUsername) {
      const user = await this.usersService.findByUsername(
        contract.approvedByUsername,
      );
      if (user) {
        (contract as any).approvedByName = user.name;
      }
    }

    if (contract.submittedForApprovalByUsername) {
      const user = await this.usersService.findByUsername(
        contract.submittedForApprovalByUsername,
      );
      if (user) {
        (contract as any).submittedForApprovalByName = user.name;
      }
    }

    return contract;
  }

  async update(recordId: string, dto: UpdateSalesContractDto) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
      });
      if (!contract) throw new NotFoundException('Sales contract not found');
      if (
        ![SalesContractStatus.DRAFT, SalesContractStatus.REJECTED].includes(
          contract.status,
        )
      ) {
        throw new BadRequestException(
          'Only DRAFT or REJECTED sales contracts can be updated.',
        );
      }

      const { items, ...data } = dto;
      const hasPolPortId = Object.prototype.hasOwnProperty.call(
        data,
        'pol_port_id',
      );
      const hasPol = Object.prototype.hasOwnProperty.call(data, 'pol');
      const hasPodPortId = Object.prototype.hasOwnProperty.call(
        data,
        'pod_port_id',
      );
      const hasPod = Object.prototype.hasOwnProperty.call(data, 'pod');
      Object.assign(
        data,
        await this.resolveContractPortsForUpdate({
          pol_port_id: data.pol_port_id,
          pol: data.pol,
          pod_port_id: data.pod_port_id,
          pod: data.pod,
          currentPolPortId: contract.pol_port_id,
          currentPol: contract.pol,
          currentPodPortId: contract.pod_port_id,
          currentPod: contract.pod,
          hasPolPortId,
          hasPol,
          hasPodPortId,
          hasPod,
        }),
      );
      const pricingContext = { ...contract, ...data };
      const existingItems = items
        ? []
        : await manager.find(SalesContractItem, {
            where: { salesContractId: recordId },
          });
      const calculationItems = items
        ? await this.applyPricingPolicies(items, pricingContext)
        : existingItems.map((item) => ({
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
          }));

      const { totalAmount, totalAmountVnd } =
        this.incotermsService.calculateTotal({
          ...pricingContext,
          items: calculationItems,
        });

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
        const contractItems = calculationItems.map((item) =>
          manager.create(SalesContractItem, {
            ...item,
            salesContractId: saved._id,
            totalPrice:
              Number(item.quantity || 0) * Number(item.unitPrice || 0),
          }),
        );
        await manager.save(SalesContractItem, contractItems);
      }

      if (
        data.logisticsPartnerId ||
        data.bookingNumber ||
        data.pol !== undefined ||
        data.pod !== undefined ||
        data.pol_port_id !== undefined ||
        data.pod_port_id !== undefined
      ) {
        const updateData: {
          logisticsPartnerId?: string | null;
          bookingNumber?: string | null;
          pol?: string | null;
          pod?: string | null;
          pol_port_id?: string | null;
          pod_port_id?: string | null;
        } = {};
        if (data.logisticsPartnerId)
          updateData.logisticsPartnerId = data.logisticsPartnerId;
        if (data.bookingNumber) updateData.bookingNumber = data.bookingNumber;
        if (data.pol !== undefined) updateData.pol = data.pol;
        if (data.pod !== undefined) updateData.pod = data.pod;
        if (data.pol_port_id !== undefined)
          updateData.pol_port_id = data.pol_port_id;
        if (data.pod_port_id !== undefined)
          updateData.pod_port_id = data.pod_port_id;
        await manager
          .getRepository('Shipment')
          .update({ salesContractId: recordId }, updateData);
      }

      return manager.findOne(SalesContract, {
        where: { _id: saved._id },
        relations: [
          'buyer',
          'items',
          'items.product',
          'signatures',
          'signatureInvitations',
        ],
      });
    });
  }

  async submitForApproval(recordId: string, user?: { username?: string }) {
    const contract = await this.findOne(recordId);
    if (contract.status === SalesContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Sales contract is already pending approval.',
      );
    }
    if (
      ![SalesContractStatus.DRAFT, SalesContractStatus.REJECTED].includes(
        contract.status,
      )
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED sales contracts can be submitted for approval.',
      );
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

  async completeApprovalWorkflow(
    recordId: string,
    requestId: string,
    username: string,
  ) {
    const contract = await this.contractRepository.findOne({
      where: { _id: recordId },
    });
    if (!contract || contract.status !== SalesContractStatus.PENDING_APPROVAL)
      return contract;

    contract.status = SalesContractStatus.APPROVED;
    contract.approvalWorkflowRequestId = requestId;
    contract.approvedByUsername = username;
    contract.approvedAt = new Date();
    contract.rejectedByUsername = null;
    contract.rejectedAt = null;
    contract.rejectionReason = null;
    return this.contractRepository.save(contract);
  }

  async rejectApprovalWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    reason?: string | null,
  ) {
    const contract = await this.contractRepository.findOne({
      where: { _id: recordId },
    });
    if (!contract || contract.status !== SalesContractStatus.PENDING_APPROVAL)
      return contract;

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
      throw new BadRequestException(
        'Sales contract is already pending cancel approval.',
      );
    }
    if (!cancellableStatuses.includes(contract.status)) {
      throw new BadRequestException(
        'Only approved/signed/confirmed contracts can request cancellation.',
      );
    }

    const reason = dto.reason?.trim();
    if (!reason)
      throw new BadRequestException('Cancellation reason is required.');

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
      if (
        !contract ||
        contract.status !== SalesContractStatus.PENDING_CANCEL_APPROVAL
      )
        return contract;

      contract.items = await manager.find(SalesContractItem, {
        where: { salesContractId: recordId },
      });
      const previousStatus =
        typeof metadata?.previousStatus === 'string' &&
        Object.values(SalesContractStatus).includes(
          metadata.previousStatus as SalesContractStatus,
        )
          ? (metadata.previousStatus as SalesContractStatus)
          : null;

      if (previousStatus === SalesContractStatus.CONFIRMED) {
        for (const item of contract.items) {
          await this.inventoryService.releaseStock(
            item.productId,
            item.quantity,
            contract._id,
            manager,
          );
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
    const contract = await this.contractRepository.findOne({
      where: { _id: recordId },
    });
    if (
      !contract ||
      contract.status !== SalesContractStatus.PENDING_CANCEL_APPROVAL
    )
      return contract;

    const previousStatus =
      typeof metadata?.previousStatus === 'string' &&
      Object.values(SalesContractStatus).includes(
        metadata.previousStatus as SalesContractStatus,
      )
        ? (metadata.previousStatus as SalesContractStatus)
        : SalesContractStatus.APPROVED;

    contract.status = previousStatus;
    contract.approvalWorkflowRequestId = requestId;
    contract.rejectedByUsername = username;
    contract.rejectedAt = new Date();
    contract.rejectionReason =
      reason || 'Cancel request rejected by approval workflow';
    return this.contractRepository.save(contract);
  }

  async sendForSignature(
    recordId: string,
    dto: RequestSignatureInvitationDto = {},
    user?: { username?: string },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const lockedContract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedContract)
        throw new NotFoundException('Sales contract not found');

      const contract = await this.findContractWithSignatureRelations(
        manager,
        lockedContract._id,
      );
      const allowedStatuses = [
        SalesContractStatus.APPROVED,
        SalesContractStatus.PENDING_BUYER_SIGNATURE,
      ];
      console.log(`[SalesContracts] sendForSignature - contract: ${recordId}, status: ${contract.status}, allowed: ${allowedStatuses.join(',')}`);
      if (!allowedStatuses.includes(contract.status)) {
        console.warn(`[SalesContracts] Contract ${recordId} has invalid status for signature: ${contract.status}`);
        throw new BadRequestException(
          `Only APPROVED or PENDING_BUYER_SIGNATURE sales contracts can be sent for signature. Current status: ${contract.status}`,
        );
      }

      const signerName =
        dto.signerName?.trim() ||
        contract.buyer?.contactName ||
        contract.buyer?.name;
      const signerEmail = dto.signerEmail?.trim() || contract.buyer?.email;
      if (!signerName)
        throw new BadRequestException('Buyer signer name is required.');
      if (!signerEmail)
        throw new BadRequestException(
          'Buyer signer email is required for secure signing invitation.',
        );

      const actorUsername = this.getActorUsername(user);
      const documentHash = this.buildContractHash(contract);
      const previousInvitations = await this.findBuyerInvitations(
        manager,
        recordId,
      );
      for (const invitation of this.getActiveBuyerInvitations(
        previousInvitations,
      )) {
        await this.revokeSignatureInvitationEntity(
          manager,
          invitation,
          actorUsername,
          'Superseded by a new buyer signature invitation',
          documentHash,
        );
      }

      const now = new Date();
      const expiresInDays = dto.expiresInDays || 7;

      // Only update contract status if it's APPROVED (first time sending)
      // If already PENDING_BUYER_SIGNATURE, keep it as is (resending invitation)
      const isFirstTimeSending = contract.status === SalesContractStatus.APPROVED;
      if (isFirstTimeSending) {
        contract.status = SalesContractStatus.PENDING_BUYER_SIGNATURE;
        contract.signatureStatus = SalesContractSignatureStatus.PENDING_BUYER;
        contract.signatureRequestedByUsername = actorUsername;
        contract.signatureRequestedAt = now;
        contract.signatureDocumentHash = documentHash;
      }
      await this.recordSignatureEvent(
        {
          contractId: contract._id,
          eventType: ContractSignatureEventType.CONTRACT_FROZEN,
          actorType: ContractSignatureActorType.INTERNAL,
          actorUsername,
          signerEmail,
          documentHash,
          note: 'Sales contract snapshot frozen before buyer signature invitation',
        },
        manager,
      );

      const {
        invitation: savedInvitation,
        signingUrl,
        deliveryStatus,
      } = await this.createBuyerSignatureInvitation({
        manager,
        contract,
        signerName,
        signerTitle: dto.signerTitle?.trim() || 'Authorized Representative',
        signerEmail,
        actorUsername,
        expiresInDays,
        documentHash,
      });

      // Only update contract fields if it's the first time sending (was APPROVED)
      if (isFirstTimeSending) {
        await manager.update(
          SalesContract,
          { _id: contract._id },
          {
            status: SalesContractStatus.PENDING_BUYER_SIGNATURE,
            signatureStatus: SalesContractSignatureStatus.PENDING_BUYER,
            signatureRequestedByUsername: actorUsername,
            signatureRequestedAt: now,
            signatureDocumentHash: documentHash,
          },
        );
      }

      const refreshed = await this.findContractWithSignatureRelations(
        manager,
        recordId,
      );

      return {
        contract: refreshed,
        invitation: this.toInvitationResponse(savedInvitation, signingUrl),
        deliveryStatus,
      };
    });
  }

  async getSigningSession(
    token: string,
    meta?: RequestMeta,
  ): Promise<SigningSessionResponse> {
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
      await this.persistSignatureInvitation(invitation);
      await this.recordSignatureEvent({
        contractId: invitation.contractId,
        invitationId: invitation._id,
        eventType: ContractSignatureEventType.OPENED,
        actorType: ContractSignatureActorType.BUYER,
        signerEmail: invitation.signerEmail,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        documentHash: invitation.contract?.signatureDocumentHash || null,
        note: 'Buyer opened signing portal',
      });
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

    if (!invitation.otpHash) {
      throw new BadRequestException(
        'OTP has not been requested yet. Please click "Sign contract now" to request an OTP.',
      );
    }

    if (invitation.status === ContractSignatureInvitationStatus.OTP_VERIFIED) {
      return this.toSigningSessionResponse(invitation);
    }
    if (invitation.otpAttemptCount >= 5) {
      throw new BadRequestException(
        'OTP attempt limit exceeded. Please request a new signing invitation.',
      );
    }
    if (invitation.otpExpiresAt && invitation.otpExpiresAt.getTime() < Date.now()) {
      this.appendInvitationAudit(invitation, 'OTP_EXPIRED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
      });
      await this.persistSignatureInvitation(invitation);
      await this.recordSignatureEvent({
        contractId: invitation.contractId,
        invitationId: invitation._id,
        eventType: ContractSignatureEventType.OTP_EXPIRED,
        actorType: ContractSignatureActorType.BUYER,
        signerEmail: invitation.signerEmail,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        documentHash: invitation.contract?.signatureDocumentHash || null,
      });
      throw new BadRequestException(
        'OTP has expired. Please request a new signing invitation.',
      );
    }

    const incomingHash = this.hashOtp(dto.otp.trim(), invitation.tokenHash);
    if (incomingHash !== invitation.otpHash) {
      invitation.otpAttemptCount = Number(invitation.otpAttemptCount || 0) + 1;
      this.appendInvitationAudit(invitation, 'OTP_FAILED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        note: `Attempt ${invitation.otpAttemptCount}/5`,
      });
      await this.persistSignatureInvitation(invitation);
      await this.recordSignatureEvent({
        contractId: invitation.contractId,
        invitationId: invitation._id,
        eventType: ContractSignatureEventType.OTP_FAILED,
        actorType: ContractSignatureActorType.BUYER,
        signerEmail: invitation.signerEmail,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        documentHash: invitation.contract?.signatureDocumentHash || null,
        note: `Attempt ${invitation.otpAttemptCount}/5`,
        metadata: { otpAttemptCount: invitation.otpAttemptCount },
      });
      throw new BadRequestException('OTP is invalid.');
    }

    invitation.status = ContractSignatureInvitationStatus.OTP_VERIFIED;
    invitation.verifiedAt = new Date();
    this.appendInvitationAudit(invitation, 'OTP_VERIFIED', {
      ipAddress: meta?.ipAddress || null,
      userAgent: meta?.userAgent || null,
      note: 'Buyer verified OTP',
    });
    await this.persistSignatureInvitation(invitation);
    await this.recordSignatureEvent({
      contractId: invitation.contractId,
      invitationId: invitation._id,
      eventType: ContractSignatureEventType.OTP_VERIFIED,
      actorType: ContractSignatureActorType.BUYER,
      signerEmail: invitation.signerEmail,
      ipAddress: meta?.ipAddress || null,
      userAgent: meta?.userAgent || null,
      documentHash: invitation.contract?.signatureDocumentHash || null,
      note: 'Buyer verified OTP',
    });

    return this.toSigningSessionResponse(invitation);
  }

  async signContractFromInvitation(
    token: string,
    dto: PortalSignSalesContractDto,
    meta?: RequestMeta,
  ): Promise<{
    session: SigningSessionResponse;
    auditPacket: SignatureAuditPacket;
  }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await this.findInvitationByToken(token, manager, true);
      await this.ensureInvitationUsable(invitation, manager);

      if (
        dto.otp &&
        invitation.status !== ContractSignatureInvitationStatus.OTP_VERIFIED
      ) {
        const incomingHash = this.hashOtp(dto.otp.trim(), invitation.tokenHash);
        if (
          incomingHash !== invitation.otpHash ||
          (invitation.otpExpiresAt && invitation.otpExpiresAt.getTime() < Date.now())
        ) {
          invitation.otpAttemptCount =
            Number(invitation.otpAttemptCount || 0) + 1;
          this.appendInvitationAudit(invitation, 'OTP_FAILED_AT_SIGNING', {
            ipAddress: meta?.ipAddress || null,
            userAgent: meta?.userAgent || null,
          });
          await this.persistSignatureInvitation(invitation, manager);
          await this.recordSignatureEvent(
            {
              contractId: invitation.contractId,
              invitationId: invitation._id,
              eventType: ContractSignatureEventType.OTP_FAILED,
              actorType: ContractSignatureActorType.BUYER,
              signerEmail: invitation.signerEmail,
              ipAddress: meta?.ipAddress || null,
              userAgent: meta?.userAgent || null,
              documentHash: invitation.contract?.signatureDocumentHash || null,
              note: 'OTP failed during signing submit',
              metadata: { otpAttemptCount: invitation.otpAttemptCount },
            },
            manager,
          );
          throw new BadRequestException('OTP is invalid or expired.');
        }
        invitation.status = ContractSignatureInvitationStatus.OTP_VERIFIED;
        invitation.verifiedAt = new Date();
        this.appendInvitationAudit(invitation, 'OTP_VERIFIED', {
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          note: 'OTP verified during signing submit',
        });
        await this.recordSignatureEvent(
          {
            contractId: invitation.contractId,
            invitationId: invitation._id,
            eventType: ContractSignatureEventType.OTP_VERIFIED,
            actorType: ContractSignatureActorType.BUYER,
            signerEmail: invitation.signerEmail,
            ipAddress: meta?.ipAddress || null,
            userAgent: meta?.userAgent || null,
            documentHash: invitation.contract?.signatureDocumentHash || null,
            note: 'OTP verified during signing submit',
          },
          manager,
        );
      }

      if (
        invitation.status !== ContractSignatureInvitationStatus.OTP_VERIFIED
      ) {
        throw new BadRequestException(
          'OTP verification is required before signing.',
        );
      }

      const contract = invitation.contract;
      if (contract.status !== SalesContractStatus.PENDING_BUYER_SIGNATURE) {
        throw new BadRequestException(
          'Sales contract is not pending buyer signature.',
        );
      }

      const signatures = await manager.find(ContractSignature, {
        where: { contractId: contract._id },
        order: { signedAt: 'ASC' },
      });
      if (
        signatures.some(
          (signature) => signature.signerType === ContractSignerType.BUYER,
        )
      ) {
        throw new BadRequestException('Buyer signature already exists.');
      }
      contract.signatures = signatures;

      let documentHash = contract.signatureDocumentHash || null;
      if (!documentHash) {
        documentHash = this.buildContractHash(contract);
        await this.recordSignatureEvent(
          {
            contractId: contract._id,
            invitationId: invitation._id,
            eventType: ContractSignatureEventType.CONTRACT_FROZEN,
            actorType: ContractSignatureActorType.SYSTEM,
            signerEmail: invitation.signerEmail,
            documentHash,
            note: 'Legacy pending contract snapshot frozen at buyer signing',
          },
          manager,
        );
      }
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
      await this.recordSignatureEvent(
        {
          contractId: contract._id,
          invitationId: invitation._id,
          signatureId: savedSignature._id,
          eventType: ContractSignatureEventType.BUYER_SIGNED,
          actorType: ContractSignatureActorType.BUYER,
          signerEmail: savedSignature.signerEmail,
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          documentHash,
          note: savedSignature.signerName,
          metadata: {
            signerName: savedSignature.signerName,
            signerTitle: savedSignature.signerTitle,
          },
        },
        manager,
      );

      contract.status = SalesContractStatus.BUYER_SIGNED;
      contract.signatureStatus = SalesContractSignatureStatus.BUYER_SIGNED;
      contract.buyerSignedAt = now;
      contract.signatureDocumentHash = documentHash;
      await manager.update(
        SalesContract,
        { _id: contract._id },
        {
          status: contract.status,
          signatureStatus: contract.signatureStatus,
          buyerSignedAt: contract.buyerSignedAt,
          signatureDocumentHash: contract.signatureDocumentHash,
        },
      );

      invitation.status = ContractSignatureInvitationStatus.SIGNED;
      invitation.signerName = savedSignature.signerName;
      invitation.signerTitle = savedSignature.signerTitle;
      invitation.signerEmail = savedSignature.signerEmail;
      invitation.signedAt = now;
      invitation.certificateNumber = `SC-CERT-${contract.contractNumber.replace(/[^A-Za-z0-9]/g, '')}-${now.getTime()}`;
      invitation.certificateHash = this.hashSecret(
        [
          invitation._id,
          savedSignature._id,
          documentHash,
          invitation.certificateNumber,
        ].join('::'),
      );
      this.appendInvitationAudit(invitation, 'CONTRACT_SIGNED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        note: `Certificate ${invitation.certificateNumber}`,
      });
      await this.persistSignatureInvitation(invitation, manager);

      const refreshedInvitation = await manager.findOne(
        ContractSignatureInvitation,
        {
          where: { _id: invitation._id },
          relations: this.getSignatureInvitationRelations(),
        },
      );
      if (!refreshedInvitation)
        throw new NotFoundException('Signature invitation not found.');

      return refreshedInvitation;
    });

    const session = this.toSigningSessionResponse(result);
    return {
      session,
      auditPacket: await this.getSignatureAuditPacket(result.contract._id),
    };
  }

  async requestSigningOtp(token: string, meta?: RequestMeta): Promise<{
    message: string;
    expiresAt: Date;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.findInvitationByToken(token, manager, true);
      await this.ensureInvitationUsable(invitation, manager);

      if (invitation.otpHash && invitation.otpExpiresAt && invitation.otpExpiresAt.getTime() > Date.now()) {
        return {
          message: `A valid OTP is already active. Check your email or wait for it to expire.`,
          expiresAt: invitation.otpExpiresAt,
        };
      }

      const now = new Date();
      const rawOtp = this.generateOtp();
      const newOtpHash = this.hashOtp(rawOtp, invitation.tokenHash);

      invitation.otpHash = newOtpHash;
      invitation.otpExpiresAt = this.addMinutes(now, 15);
      invitation.otpAttemptCount = 0;

      this.appendInvitationAudit(invitation, 'OTP_REQUESTED', {
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        note: `OTP requested by buyer`,
      });

      await this.persistSignatureInvitation(invitation, manager);

      const contract = invitation.contract;
      const documentHash = contract?.signatureDocumentHash || this.buildContractHash(contract);
      await this.recordSignatureEvent(
        {
          contractId: invitation.contractId,
          invitationId: invitation._id,
          eventType: ContractSignatureEventType.EMAIL_SENT,
          actorType: ContractSignatureActorType.BUYER,
          signerEmail: invitation.signerEmail,
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          documentHash,
          note: `OTP sent to buyer email`,
        },
        manager,
      );

      await this.deliverOtpOnlyEmail(invitation, contract, rawOtp);

      return {
        message: `OTP sent to ${invitation.signerEmail}`,
        expiresAt: invitation.otpExpiresAt,
      };
    });
  }

  async resendSigningOtpByToken(token: string): Promise<{
    message: string;
    expiresAt: Date;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await this.findInvitationByToken(token, manager, true);

      if (invitation.status === ContractSignatureInvitationStatus.REVOKED) {
        throw new BadRequestException(
          'Signature invitation has been revoked. Please contact the sender for a new link.',
        );
      }
      if (invitation.status === ContractSignatureInvitationStatus.SIGNED) {
        throw new BadRequestException(
          'This invitation has already been signed.',
        );
      }
      if (
        invitation.status === ContractSignatureInvitationStatus.EXPIRED ||
        invitation.expiresAt.getTime() < Date.now()
      ) {
        throw new BadRequestException(
          'This signing link has expired. Please contact the sender for a new link.',
        );
      }
      if (!invitation.signerEmail) {
        throw new BadRequestException(
          'No email address is associated with this invitation.',
        );
      }

      const now = new Date();
      const rawOtp = this.generateOtp();
      const newOtpHash = this.hashOtp(rawOtp, invitation.tokenHash);

      invitation.otpHash = newOtpHash;
      invitation.otpExpiresAt = this.addMinutes(now, 15);
      invitation.otpAttemptCount = 0;

      this.appendInvitationAudit(invitation, 'OTP_RESENT', {
        note: `OTP resent to ${invitation.signerEmail}`,
      });

      await this.persistSignatureInvitation(invitation, manager);

      const contract = invitation.contract;
      const documentHash =
        contract?.signatureDocumentHash ||
        this.buildContractHash(contract);
      await this.recordSignatureEvent(
        {
          contractId: invitation.contractId,
          invitationId: invitation._id,
          eventType: ContractSignatureEventType.EMAIL_SENT,
          actorType: ContractSignatureActorType.SYSTEM,
          signerEmail: invitation.signerEmail,
          documentHash,
          note: `OTP resent to buyer email`,
        },
        manager,
      );

      const frontendBaseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const signingUrl = `${frontendBaseUrl}/portal/sign/${token}`;

      await this.deliverSignatureInvitation(
        invitation,
        contract,
        signingUrl,
        rawOtp,
      );

      return {
        message: `A new OTP has been sent to ${invitation.signerEmail}`,
        expiresAt: invitation.otpExpiresAt,
      };
    });
  }

  async getSignatureAuditPacket(
    recordId: string,
  ): Promise<SignatureAuditPacket> {
    const contract = await this.contractRepository.findOne({
      where: { _id: recordId },
      relations: this.getContractSignatureRelations(),
      order: {
        signatures: { signedAt: 'ASC' },
        signatureInvitations: { createdAt: 'ASC' },
      },
    });
    if (!contract) throw new NotFoundException('Sales contract not found');

    const signatureEvents = await this.signatureEventRepository.find({
      where: { contractId: recordId },
      order: { createdAt: 'ASC' },
    });

    return this.buildSignatureAuditPacket(contract, signatureEvents);
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
        {
          text: 'SIGNATURE AUDIT PACKET',
          style: 'header',
          alignment: 'center',
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: `Contract: ${packet.contract.contractNumber}`,
                  bold: true,
                },
                { text: `Contract _id: ${packet.contract._id}` },
                { text: `Buyer: ${packet.contract.buyerName || '-'}` },
                {
                  text: `Amount: ${packet.contract.totalAmount} ${packet.contract.currencyCode}`,
                },
              ],
            },
            {
              width: '*',
              stack: [
                {
                  text: `Certificate: ${packet.certificate.certificateNumber || '-'}`,
                  bold: true,
                },
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
            body: [['Action', 'At', 'Actor', 'IP', 'Note'], ...timelineRows],
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
    return renderPdfBuffer(this.getSignatureAuditPacketPdfDefinition(packet));
  }

  async revokeSignatureInvitation(
    recordId: string,
    invitationId: string,
    dto: { reason?: string | null } = {},
    user?: { username?: string },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) throw new NotFoundException('Sales contract not found');
      if (contract.status !== SalesContractStatus.PENDING_BUYER_SIGNATURE) {
        throw new BadRequestException(
          'Only pending buyer signature contracts can have invitations revoked.',
        );
      }

      const targetInvitation = await manager.findOne(
        ContractSignatureInvitation,
        {
          where: {
            _id: invitationId,
            contractId: recordId,
            signerType: ContractSignerType.BUYER,
          },
        },
      );
      if (!targetInvitation)
        throw new NotFoundException('Signature invitation not found.');
      if (!this.isActiveInvitationStatus(targetInvitation.status)) {
        throw new BadRequestException(
          'Only active buyer signature invitations can be revoked.',
        );
      }

      const actorUsername = this.getActorUsername(user);
      const revokeReason =
        dto.reason?.trim() ||
        'Buyer signature invitation revoked by internal user';
      const buyerInvitations = await this.findBuyerInvitations(
        manager,
        recordId,
      );
      for (const invitation of this.getActiveBuyerInvitations(
        buyerInvitations,
      )) {
        await this.revokeSignatureInvitationEntity(
          manager,
          invitation,
          actorUsername,
          invitation._id === invitationId
            ? revokeReason
            : `Revoked with invitation ${invitationId}`,
          contract.signatureDocumentHash,
        );
      }

      await manager.update(
        SalesContract,
        { _id: recordId },
        {
          status: SalesContractStatus.APPROVED,
          signatureStatus: SalesContractSignatureStatus.NOT_SENT,
          signatureRequestedByUsername: null,
          signatureRequestedAt: null,
          signatureDocumentHash: null,
          buyerSignedAt: null,
        },
      );

      return this.findContractWithSignatureRelations(manager, recordId);
    });
  }

  async resendSignatureInvitation(
    recordId: string,
    user?: { username?: string },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const lockedContract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedContract)
        throw new NotFoundException('Sales contract not found');

      const contract = await this.findContractWithSignatureRelations(
        manager,
        recordId,
      );
      if (contract.status !== SalesContractStatus.PENDING_BUYER_SIGNATURE) {
        throw new BadRequestException(
          'Only pending buyer signature contracts can be resent.',
        );
      }

      const activeInvitations = this.getActiveBuyerInvitations(
        contract.signatureInvitations,
      );
      const currentInvitation = activeInvitations[0];
      if (!currentInvitation) {
        throw new BadRequestException(
          'No active buyer signature invitation found to resend.',
        );
      }
      if (!currentInvitation.signerEmail) {
        throw new BadRequestException(
          'Buyer signer email is required to resend signature invitation.',
        );
      }

      const actorUsername = this.getActorUsername(user);
      let documentHash = contract.signatureDocumentHash || null;
      if (!documentHash) {
        documentHash = this.buildContractHash(contract);
        await this.recordSignatureEvent(
          {
            contractId: contract._id,
            eventType: ContractSignatureEventType.CONTRACT_FROZEN,
            actorType: ContractSignatureActorType.INTERNAL,
            actorUsername,
            signerEmail: currentInvitation.signerEmail,
            documentHash,
            note: 'Legacy pending contract snapshot frozen before resend',
          },
          manager,
        );
        await manager.update(
          SalesContract,
          { _id: recordId },
          { signatureDocumentHash: documentHash },
        );
        contract.signatureDocumentHash = documentHash;
      }

      for (const invitation of activeInvitations) {
        await this.revokeSignatureInvitationEntity(
          manager,
          invitation,
          actorUsername,
          'Superseded by resent buyer signature invitation',
          documentHash,
        );
      }

      const {
        invitation: savedInvitation,
        signingUrl,
        deliveryStatus,
      } = await this.createBuyerSignatureInvitation({
        manager,
        contract,
        signerName: currentInvitation.signerName,
        signerTitle:
          currentInvitation.signerTitle || 'Authorized Representative',
        signerEmail: currentInvitation.signerEmail,
        actorUsername,
        expiresInDays: 7,
        documentHash,
        note: `Resent from invitation ${currentInvitation._id}`,
      });

      await manager.update(
        SalesContract,
        { _id: recordId },
        {
          signatureRequestedByUsername: actorUsername,
          signatureRequestedAt: new Date(),
          signatureDocumentHash: documentHash,
        },
      );

      const refreshed = await this.findContractWithSignatureRelations(
        manager,
        recordId,
      );

      return {
        contract: refreshed,
        invitation: this.toInvitationResponse(savedInvitation, signingUrl),
        deliveryStatus,
      };
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

      contract.items = await manager.find(SalesContractItem, {
        where: { salesContractId: recordId },
      });
      contract.signatures = await manager.find(ContractSignature, {
        where: { contractId: recordId },
        order: { signedAt: 'ASC' },
      });

      const signerType = dto.signerType;
      const hasInternalSignature = contract.signatures.some(
        (signature) => signature.signerType === ContractSignerType.INTERNAL,
      );

      if (signerType === ContractSignerType.BUYER) {
        throw new BadRequestException(
          'Buyer signatures must be completed through the secure signing portal invitation.',
        );
      }

      if (signerType === ContractSignerType.INTERNAL) {
        if (contract.status !== SalesContractStatus.BUYER_SIGNED) {
          throw new BadRequestException(
            'Internal counter-signature requires buyer-signed status first.',
          );
        }
        if (hasInternalSignature)
          throw new BadRequestException('Internal signature already exists.');
        if (!dto.password) {
          throw new BadRequestException(
            'Password is required for internal signing.',
          );
        }
        const username = this.getActorUsername(user);
        const internalUser = await this.usersService.findByUsername(username);
        if (!internalUser) {
          throw new UnauthorizedException('User not found.');
        }
        const isValidPassword = await comparePasswordHelper(
          dto.password,
          internalUser.password,
        );
        if (!isValidPassword) {
          throw new UnauthorizedException('Invalid password.');
        }
      }

      const documentHash =
        contract.signatureDocumentHash || this.buildContractHash(contract);
      const now = new Date();
      const signature = manager.create(ContractSignature, {
        contractId: recordId,
        signerType,
        signerName: dto.signerName.trim(),
        signerTitle: dto.signerTitle?.trim() || null,
        signerEmail: dto.signerEmail?.trim() || null,
        signatureImageFileId: dto.signatureImageFileId?.trim() || null,
        signedByUsername:
          signerType === ContractSignerType.INTERNAL
            ? this.getActorUsername(user)
            : user?.username || null,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        signedAt: now,
        consentText:
          dto.consentText?.trim() ||
          'Signer confirms agreement to the sales contract terms.',
        documentHash,
      });
      const savedSignature = await manager.save(signature);
      if (contract.signatures) {
        contract.signatures.push(savedSignature);
      }

      await this.recordSignatureEvent(
        {
          contractId: recordId,
          signatureId: savedSignature._id,
          eventType: ContractSignatureEventType.INTERNAL_SIGNED,
          actorType: ContractSignatureActorType.INTERNAL,
          actorUsername: this.getActorUsername(user),
          signerEmail: savedSignature.signerEmail,
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          documentHash,
          note: savedSignature.signerName,
          metadata: {
            signerName: savedSignature.signerName,
            signerTitle: savedSignature.signerTitle,
          },
        },
        manager,
      );

      contract.counterSignedAt = now;
      contract.signatureStatus = SalesContractSignatureStatus.COMPLETED;
      contract.signatureDocumentHash = documentHash;
      await this.reserveAndConfirm(contract, manager);

      return this.findContractWithSignatureRelations(manager, recordId);
    });
  }

  private async reserveAndConfirm(
    contract: SalesContract,
    manager: EntityManager,
  ) {
    if (
      ![
        SalesContractStatus.APPROVED,
        SalesContractStatus.BUYER_SIGNED,
      ].includes(contract.status)
    ) {
      throw new BadRequestException(
        'Sales contract must be APPROVED or BUYER_SIGNED before confirmation.',
      );
    }

    contract.items = contract.items?.length
      ? contract.items
      : await manager.find(SalesContractItem, {
          where: { salesContractId: contract._id },
        });
    if (!contract.items.length)
      throw new BadRequestException('Sales contract has no items to confirm.');

    // Stock reservation is the irreversible operational handoff from commercial
    // contract to warehouse execution, so it runs only after approval/signature.
    for (const item of contract.items) {
      await this.inventoryService.reserveStock(
        item.productId,
        item.quantity,
        contract._id,
        manager,
      );
    }

    contract.status = SalesContractStatus.CONFIRMED;
    return manager.save(contract);
  }

  async confirmContract(
    recordId: string,
    user?: { username?: string },
  ): Promise<SalesContract> {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!contract) throw new NotFoundException('Sales contract not found');
      contract.items = await manager.find(SalesContractItem, {
        where: { salesContractId: recordId },
      });

      await this.reserveAndConfirm(contract, manager);
      if (
        contract.status === SalesContractStatus.CONFIRMED &&
        contract.approvedByUsername === null
      ) {
        contract.approvedByUsername = this.getActorUsername(user);
        contract.approvedAt = new Date();
        await manager.save(contract);
      }

      await this.arService.createFromSalesContract(
        contract,
        null,
        manager,
        this.getActorUsername(user),
      );

      return manager.findOne(SalesContract, {
        where: { _id: recordId },
        relations: [
          'buyer',
          'items',
          'items.product',
          'signatures',
          'signatureInvitations',
        ],
      }) as Promise<SalesContract>;
    });
  }

  async shipContract(
    recordId: string,
    user?: { username?: string },
  ): Promise<SalesContract> {
    void user;
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!contract) throw new NotFoundException('Sales contract not found');
      contract.items = await manager.find(SalesContractItem, {
        where: { salesContractId: recordId },
      });
      const buyer = await manager.findOne(Partner, {
        where: { _id: contract.buyerId },
      });
      if (buyer) {
        contract.buyer = buyer;
      }

      if (contract.status !== SalesContractStatus.CONFIRMED) {
        throw new BadRequestException(
          'Sales contract must be CONFIRMED before shipment.',
        );
      }

      contract.status = SalesContractStatus.SHIPPED;
      return manager.save(contract);
    });
  }

  async cancelContract(recordId: string): Promise<SalesContract> {
    void recordId;
    await Promise.resolve();
    throw new BadRequestException(
      'Sales contract cancellation phai di qua approval-matrix request',
    );
  }
}
