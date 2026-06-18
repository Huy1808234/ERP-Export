import { BadRequestException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { InventoryService } from '../inventory/inventory.service';
import { Partner } from '../partners/entities/partner.entity';
import { PortsService } from '../ports/ports.service';
import { PricingPoliciesService } from '../pricing-policies/pricing-policies.service';
import { Incoterm } from '../quotations/entities/quotation.entity';
import {
  ContractSignature,
  ContractSignerType,
} from './entities/contract-signature.entity';
import {
  ContractSignatureActorType,
  ContractSignatureEvent,
  ContractSignatureEventType,
} from './entities/contract-signature-event.entity';
import {
  ContractSignatureInvitation,
  ContractSignatureInvitationStatus,
} from './entities/contract-signature-invitation.entity';
import {
  SalesContract,
  SalesContractSignatureStatus,
  SalesContractStatus,
} from './entities/sales-contract.entity';
import { SalesContractItem } from './entities/sales-contract-item.entity';
import { IncotermsService } from './incoterms.service';
import { SalesContractsService } from './sales-contracts.service';

type MockRepository<T extends object> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
  find: jest.Mock<Promise<T[]>, [unknown]>;
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [T]>;
  update: jest.Mock<Promise<unknown>, [unknown, Partial<T>]>;
};

type MockManager = {
  findOne: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  find: jest.Mock<Promise<unknown[]>, [unknown, unknown]>;
  create: jest.Mock<unknown, [unknown, unknown]>;
  save: jest.Mock<Promise<unknown>, [unknown, unknown?]>;
  update: jest.Mock<Promise<unknown>, [unknown, unknown, unknown]>;
  getRepository: jest.Mock<MockRepository<object>, [unknown]>;
};

type TransactionCallback = (manager: EntityManager) => Promise<unknown>;

type TestContext = {
  service: SalesContractsService;
  manager: MockManager;
  mailerService: {
    sendMail: jest.Mock<Promise<void>, [unknown]>;
  };
  signatureInvitationRepository: MockRepository<ContractSignatureInvitation>;
  signatureEventRepository: MockRepository<ContractSignatureEvent>;
  eventSaves: ContractSignatureEvent[];
};

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `_${prefix}_${String(sequence).padStart(4, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureEntityId<T extends object>(
  prefix: string,
  value: Partial<T>,
): T {
  const record = value as Record<string, unknown>;
  return {
    ...value,
    _id: typeof record._id === 'string' ? record._id : nextId(prefix),
  } as T;
}

function createMockRepository<T extends object>(
  prefix: string,
): MockRepository<T> {
  return {
    findOne: jest.fn<Promise<T | null>, [unknown]>().mockResolvedValue(null),
    find: jest.fn<Promise<T[]>, [unknown]>().mockResolvedValue([]),
    create: jest.fn<T, [Partial<T>]>((value) => ensureEntityId(prefix, value)),
    save: jest.fn<Promise<T>, [T]>((value) => Promise.resolve(value)),
    update: jest.fn<Promise<unknown>, [unknown, Partial<T>]>(() =>
      Promise.resolve({ affected: 1 }),
    ),
  };
}

function createEntityForManager(target: unknown, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => createEntityForManager(target, item));
  }
  if (!isRecord(value)) return value;

  const prefix =
    target === ContractSignatureInvitation
      ? 'sc_invite'
      : target === ContractSignature
        ? 'sc_sign'
        : target === ContractSignatureEvent
          ? 'sc_evt'
          : 'entity';

  return {
    ...value,
    _id: typeof value._id === 'string' ? value._id : nextId(prefix),
  };
}

function createContractItem(
  overrides: Partial<SalesContractItem> = {},
): SalesContractItem {
  return Object.assign(new SalesContractItem(), {
    _id: '_sc_item_test',
    salesContractId: '_sc_test',
    productId: '_product_test',
    product: {
      _id: '_product_test',
      sku: 'SKU-001',
      vietnameseName: 'Robusta Coffee',
      englishName: 'Robusta Coffee',
    } as SalesContractItem['product'],
    quantity: 10,
    unitPrice: 100,
    totalPrice: 1000,
    ...overrides,
  });
}

function createBuyer(overrides: Partial<Partner> = {}): Partner {
  return {
    _id: '_partner_buyer',
    name: 'ACME Buyer',
    contactName: 'Jane Buyer',
    email: 'buyer@example.test',
    country: 'VN',
    ...overrides,
  } as Partner;
}

function createContract(overrides: Partial<SalesContract> = {}): SalesContract {
  return Object.assign(new SalesContract(), {
    _id: '_sc_test',
    contractNumber: 'SC-2026-001',
    buyerId: '_partner_buyer',
    buyer: createBuyer(),
    proformaInvoiceId: null,
    status: SalesContractStatus.APPROVED,
    incoterm: Incoterm.FOB,
    currencyCode: 'USD',
    exchangeRate: 25000,
    totalAmount: 1000,
    totalAmountVnd: 25000000,
    deliveryDate: '2026-07-01',
    validUntil: null,
    domesticTransportCost: 0,
    portCharges: 0,
    seaFreight: 0,
    insuranceCost: 0,
    logisticsFee: 0,
    otherFee: 0,
    paymentTerms: 'T/T 30 days',
    notes: 'Frozen snapshot test',
    items: [createContractItem()],
    signatures: [],
    signatureInvitations: [],
    createdByUsername: 'sales.admin',
    approvalWorkflowRequestId: null,
    submittedForApprovalByUsername: null,
    submittedForApprovalAt: null,
    approvedByUsername: 'manager',
    approvedAt: new Date('2026-06-01T00:00:00.000Z'),
    rejectedByUsername: null,
    rejectedAt: null,
    rejectionReason: null,
    cancellationReason: null,
    cancelledByUsername: null,
    cancelledAt: null,
    signatureStatus: SalesContractSignatureStatus.NOT_SENT,
    signatureRequestedByUsername: null,
    signatureRequestedAt: null,
    buyerSignedAt: null,
    counterSignedAt: null,
    signatureDocumentHash: null,
    logisticsPartnerId: null,
    bookingNumber: 'BK-001',
    pol: 'Ho Chi Minh',
    pol_port_id: '_port_sgn',
    pod: 'Los Angeles',
    pod_port_id: '_port_lax',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-02T00:00:00.000Z'),
    ...overrides,
  });
}

function futureDate(days = 7): Date {
  const date = new Date('2026-06-12T08:00:00.000Z');
  date.setDate(date.getDate() + days);
  return date;
}

function createInvitation(
  overrides: Partial<ContractSignatureInvitation> = {},
): ContractSignatureInvitation {
  return Object.assign(new ContractSignatureInvitation(), {
    _id: nextId('sc_invite'),
    contractId: '_sc_test',
    signerType: ContractSignerType.BUYER,
    signerName: 'Jane Buyer',
    signerTitle: 'Director',
    signerEmail: 'buyer@example.test',
    status: ContractSignatureInvitationStatus.SENT,
    tokenHash: 'token-hash',
    otpHash: 'otp-hash',
    otpExpiresAt: futureDate(1),
    otpAttemptCount: 0,
    expiresAt: futureDate(7),
    sentByUsername: 'sales.admin',
    sentAt: new Date('2026-06-12T08:00:00.000Z'),
    openedAt: null,
    verifiedAt: null,
    signedAt: null,
    revokedAt: null,
    revokedByUsername: null,
    revokeReason: null,
    certificateNumber: null,
    certificateHash: null,
    auditTrail: [],
    createdAt: new Date('2026-06-12T08:00:00.000Z'),
    updatedAt: new Date('2026-06-12T08:00:00.000Z'),
    ...overrides,
  });
}

function createSignature(
  overrides: Partial<ContractSignature> = {},
): ContractSignature {
  return Object.assign(new ContractSignature(), {
    _id: nextId('sc_sign'),
    contractId: '_sc_test',
    signerType: ContractSignerType.BUYER,
    signerName: 'Jane Buyer',
    signerTitle: 'Director',
    signerEmail: 'buyer@example.test',
    signedByUsername: null,
    signatureImageFileId: null,
    ipAddress: '203.0.113.10',
    userAgent: 'Jest',
    signedAt: new Date('2026-06-12T08:10:00.000Z'),
    consentText: 'I agree to sign this sales contract.',
    documentHash: 'frozen-hash',
    createdAt: new Date('2026-06-12T08:10:00.000Z'),
    ...overrides,
  });
}

function createManager(
  invitationRepository: MockRepository<ContractSignatureInvitation>,
  eventRepository: MockRepository<ContractSignatureEvent>,
): MockManager {
  return {
    findOne: jest
      .fn<Promise<unknown>, [unknown, unknown]>()
      .mockResolvedValue(null),
    find: jest
      .fn<Promise<unknown[]>, [unknown, unknown]>()
      .mockResolvedValue([]),
    create: jest.fn<unknown, [unknown, unknown]>((target, value) =>
      createEntityForManager(target, value),
    ),
    save: jest.fn<Promise<unknown>, [unknown, unknown?]>(
      (targetOrEntity, entity) => {
        const value = entity ?? targetOrEntity;
        if (Array.isArray(value)) return Promise.resolve(value as unknown[]);
        const savedValue =
          isRecord(value) && typeof value._id !== 'string'
            ? { ...value, _id: nextId('entity') }
            : value;
        return Promise.resolve(savedValue);
      },
    ),
    update: jest.fn<Promise<unknown>, [unknown, unknown, unknown]>(() =>
      Promise.resolve({ affected: 1 }),
    ),
    getRepository: jest.fn<MockRepository<object>, [unknown]>((target) => {
      if (target === ContractSignatureInvitation) {
        return invitationRepository as unknown as MockRepository<object>;
      }
      if (target === ContractSignatureEvent) {
        return eventRepository as unknown as MockRepository<object>;
      }
      throw new Error('Unexpected repository requested by test manager');
    }),
  };
}

function createAuditPacket(contract: SalesContract) {
  return {
    contract: {
      _id: contract._id,
      contractNumber: contract.contractNumber,
      status: contract.status,
      signatureStatus: contract.signatureStatus,
      buyerName: contract.buyer?.name || null,
      totalAmount: contract.totalAmount,
      currencyCode: contract.currencyCode,
      documentHash: contract.signatureDocumentHash,
    },
    certificate: {
      certificateNumber: null,
      certificateHash: null,
      packetHash: 'packet-hash',
      generatedAt: new Date('2026-06-12T08:00:00.000Z').toISOString(),
    },
    signatures: [],
    invitations: [],
    timeline: [],
  };
}

function createTestContext(): TestContext {
  const contractRepository = createMockRepository<SalesContract>('sc');
  const signatureInvitationRepository =
    createMockRepository<ContractSignatureInvitation>('sc_invite');
  const signatureEventRepository =
    createMockRepository<ContractSignatureEvent>('sc_evt');
  const eventSaves: ContractSignatureEvent[] = [];

  signatureEventRepository.save.mockImplementation((event) => {
    eventSaves.push(event);
    return Promise.resolve(event);
  });

  const manager = createManager(
    signatureInvitationRepository,
    signatureEventRepository,
  );
  const dataSource = {
    transaction: jest.fn<Promise<unknown>, [TransactionCallback]>((callback) =>
      callback(manager as unknown as EntityManager),
    ),
  };
  const mailerService = {
    sendMail: jest.fn<Promise<void>, [unknown]>(() =>
      Promise.resolve(undefined),
    ),
  };
  const inventoryService = {
    reserveStock: jest.fn<
      Promise<void>,
      [string, number, string, EntityManager]
    >(() => Promise.resolve(undefined)),
  };
  const incotermsService = {
    calculateTotal: jest.fn(() => ({ totalAmount: 0, totalAmountVnd: 0 })),
  };
  const pricingPoliciesService = {
    resolvePrice: jest.fn(),
    recordDocumentHistory: jest.fn(),
  };
  const approvalMatrixService = {
    submit: jest.fn(),
  };
  const portsService = {
    resolvePortSnapshot: jest.fn(),
    resolvePortSnapshotPatch: jest.fn(),
  };

  const usersService = {
    findByUsername: jest.fn(),
  };

  return {
    service: new SalesContractsService(
      contractRepository as unknown as Repository<SalesContract>,
      signatureInvitationRepository as unknown as Repository<ContractSignatureInvitation>,
      signatureEventRepository as unknown as Repository<ContractSignatureEvent>,
      dataSource as unknown as DataSource,
      mailerService as unknown as MailerService,
      inventoryService as unknown as InventoryService,
      incotermsService as unknown as IncotermsService,
      pricingPoliciesService as unknown as PricingPoliciesService,
      approvalMatrixService as unknown as ApprovalMatrixService,
      portsService as unknown as PortsService,
      usersService as unknown as any,
    ),
    manager,
    mailerService,
    signatureInvitationRepository,
    signatureEventRepository,
    eventSaves,
  };
}

function getContractUpdatePayload(
  manager: MockManager,
): Record<string, unknown> {
  const call = manager.update.mock.calls.find(
    ([target]) => target === SalesContract,
  );
  const payload = call?.[2];
  if (!isRecord(payload)) {
    throw new Error('Expected a SalesContract update payload');
  }
  return payload;
}

describe('SalesContractsService signature workflow', () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    sequence = 0;
    jest.useFakeTimers().setSystemTime(new Date('2026-06-12T08:00:00.000Z'));
    process.env.FRONTEND_URL = 'https://erp.example.test';
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.FRONTEND_URL = previousFrontendUrl;
    jest.restoreAllMocks();
  });

  it('rejects buyer signatures outside the secure portal', async () => {
    const { service, manager } = createTestContext();
    manager.findOne.mockResolvedValueOnce(
      createContract({
        status: SalesContractStatus.BUYER_SIGNED,
        signatureStatus: SalesContractSignatureStatus.BUYER_SIGNED,
      }),
    );
    manager.find.mockResolvedValue([]);

    await expect(
      service.signContract(
        '_sc_test',
        {
          signerType: ContractSignerType.BUYER,
          signerName: 'Jane Buyer',
          consentText: 'I agree.',
        },
        { username: 'sales.admin' },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('freezes the document, revokes active buyer invitations, and sends a new portal link', async () => {
    const { service, manager, mailerService, eventSaves } = createTestContext();
    const activeInvitation = createInvitation({ _id: '_invite_active' });
    const signedInvitation = createInvitation({
      _id: '_invite_signed',
      status: ContractSignatureInvitationStatus.SIGNED,
    });
    const contract = createContract({
      status: SalesContractStatus.APPROVED,
      signatureInvitations: [activeInvitation, signedInvitation],
    });
    const refreshed = createContract({
      ...contract,
      status: SalesContractStatus.PENDING_BUYER_SIGNATURE,
      signatureStatus: SalesContractSignatureStatus.PENDING_BUYER,
      signatureInvitations: [activeInvitation, signedInvitation],
    });

    manager.findOne
      .mockResolvedValueOnce(contract)
      .mockResolvedValueOnce(contract)
      .mockResolvedValueOnce(refreshed);
    manager.find.mockResolvedValue([activeInvitation, signedInvitation]);

    const result = await service.sendForSignature(
      '_sc_test',
      {
        signerName: ' Jane Buyer ',
        signerTitle: ' CEO ',
        signerEmail: ' buyer@example.test ',
        expiresInDays: 3,
      },
      { username: 'sales.admin' },
    );

    const contractUpdate = getContractUpdatePayload(manager);

    expect(activeInvitation.status).toBe(
      ContractSignatureInvitationStatus.REVOKED,
    );
    expect(signedInvitation.status).toBe(
      ContractSignatureInvitationStatus.SIGNED,
    );
    expect(contractUpdate).toEqual(
      expect.objectContaining({
        status: SalesContractStatus.PENDING_BUYER_SIGNATURE,
        signatureStatus: SalesContractSignatureStatus.PENDING_BUYER,
        signatureRequestedByUsername: 'sales.admin',
      }),
    );
    expect(contractUpdate.signatureDocumentHash).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(result.deliveryStatus).toBe('EMAIL_SENT');
    expect(result.invitation.signingUrl).toMatch(
      /^https:\/\/erp\.example\.test\/vi\/portal\/sign\//,
    );
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.test',
      }),
    );
    expect(eventSaves.map((event) => event.eventType)).toEqual([
      ContractSignatureEventType.REVOKED,
      ContractSignatureEventType.CONTRACT_FROZEN,
      ContractSignatureEventType.INVITATION_CREATED,
      ContractSignatureEventType.EMAIL_SENT,
    ]);
  });

  it('resends by revoking active links while preserving the frozen document hash', async () => {
    const { service, manager, eventSaves } = createTestContext();
    const olderInvitation = createInvitation({
      _id: '_invite_older',
      status: ContractSignatureInvitationStatus.SENT,
      signerName: 'Older Buyer',
      signerEmail: 'older@example.test',
      createdAt: new Date('2026-06-10T08:00:00.000Z'),
    });
    const latestInvitation = createInvitation({
      _id: '_invite_latest',
      status: ContractSignatureInvitationStatus.OPENED,
      signerName: 'Latest Buyer',
      signerTitle: 'Legal Director',
      signerEmail: 'latest@example.test',
      createdAt: new Date('2026-06-11T08:00:00.000Z'),
    });
    const frozenContract = createContract({
      status: SalesContractStatus.PENDING_BUYER_SIGNATURE,
      signatureStatus: SalesContractSignatureStatus.PENDING_BUYER,
      signatureDocumentHash: 'frozen-hash',
      signatureInvitations: [olderInvitation, latestInvitation],
    });

    manager.findOne
      .mockResolvedValueOnce(frozenContract)
      .mockResolvedValueOnce(frozenContract)
      .mockResolvedValueOnce(frozenContract);

    const result = await service.resendSignatureInvitation('_sc_test', {
      username: 'sales.admin',
    });

    const contractUpdate = getContractUpdatePayload(manager);

    expect(olderInvitation.status).toBe(
      ContractSignatureInvitationStatus.REVOKED,
    );
    expect(latestInvitation.status).toBe(
      ContractSignatureInvitationStatus.REVOKED,
    );
    expect(contractUpdate.signatureDocumentHash).toBe('frozen-hash');
    expect(result.invitation.signerName).toBe('Latest Buyer');
    expect(result.invitation.signingUrl).toMatch(
      /^https:\/\/erp\.example\.test\/vi\/portal\/sign\//,
    );
    expect(eventSaves.map((event) => event.eventType)).not.toContain(
      ContractSignatureEventType.CONTRACT_FROZEN,
    );
    expect(eventSaves.map((event) => event.eventType)).toEqual([
      ContractSignatureEventType.REVOKED,
      ContractSignatureEventType.REVOKED,
      ContractSignatureEventType.INVITATION_CREATED,
      ContractSignatureEventType.EMAIL_SENT,
    ]);
  });

  it('revokes all active buyer links and returns the contract to approved/not-sent state', async () => {
    const { service, manager, eventSaves } = createTestContext();
    const targetInvitation = createInvitation({
      _id: '_invite_target',
      status: ContractSignatureInvitationStatus.OTP_VERIFIED,
    });
    const siblingInvitation = createInvitation({
      _id: '_invite_sibling',
      status: ContractSignatureInvitationStatus.OPENED,
    });
    const signedInvitation = createInvitation({
      _id: '_invite_signed',
      status: ContractSignatureInvitationStatus.SIGNED,
    });
    const pendingContract = createContract({
      status: SalesContractStatus.PENDING_BUYER_SIGNATURE,
      signatureStatus: SalesContractSignatureStatus.PENDING_BUYER,
      signatureDocumentHash: 'frozen-hash',
      signatureInvitations: [
        targetInvitation,
        siblingInvitation,
        signedInvitation,
      ],
    });
    const approvedContract = createContract({
      ...pendingContract,
      status: SalesContractStatus.APPROVED,
      signatureStatus: SalesContractSignatureStatus.NOT_SENT,
      signatureDocumentHash: null,
      signatureInvitations: [
        targetInvitation,
        siblingInvitation,
        signedInvitation,
      ],
    });

    manager.findOne
      .mockResolvedValueOnce(pendingContract)
      .mockResolvedValueOnce(targetInvitation)
      .mockResolvedValueOnce(approvedContract);
    manager.find.mockResolvedValue([
      targetInvitation,
      siblingInvitation,
      signedInvitation,
    ]);

    const result = await service.revokeSignatureInvitation(
      '_sc_test',
      '_invite_target',
      { reason: 'Buyer requested a new signer' },
      { username: 'sales.admin' },
    );

    const contractUpdate = getContractUpdatePayload(manager);

    expect(targetInvitation.status).toBe(
      ContractSignatureInvitationStatus.REVOKED,
    );
    expect(siblingInvitation.status).toBe(
      ContractSignatureInvitationStatus.REVOKED,
    );
    expect(signedInvitation.status).toBe(
      ContractSignatureInvitationStatus.SIGNED,
    );
    expect(contractUpdate).toEqual(
      expect.objectContaining({
        status: SalesContractStatus.APPROVED,
        signatureStatus: SalesContractSignatureStatus.NOT_SENT,
        signatureRequestedByUsername: null,
        signatureRequestedAt: null,
        signatureDocumentHash: null,
        buyerSignedAt: null,
      }),
    );
    expect(result?.status).toBe(SalesContractStatus.APPROVED);
    expect(eventSaves.map((event) => event.eventType)).toEqual([
      ContractSignatureEventType.REVOKED,
      ContractSignatureEventType.REVOKED,
    ]);
  });

  it('uses the frozen document hash when the buyer signs through the portal', async () => {
    const { service, manager, signatureInvitationRepository, eventSaves } =
      createTestContext();
    const contract = createContract({
      status: SalesContractStatus.PENDING_BUYER_SIGNATURE,
      signatureStatus: SalesContractSignatureStatus.PENDING_BUYER,
      signatureDocumentHash: 'frozen-hash',
    });
    const invitation = createInvitation({
      _id: '_invite_verified',
      status: ContractSignatureInvitationStatus.OTP_VERIFIED,
      contract,
      verifiedAt: new Date('2026-06-12T08:01:00.000Z'),
    });
    const buyerSignature = createSignature({ documentHash: 'frozen-hash' });
    const signedContract = createContract({
      ...contract,
      status: SalesContractStatus.BUYER_SIGNED,
      signatureStatus: SalesContractSignatureStatus.BUYER_SIGNED,
      signatureDocumentHash: 'frozen-hash',
      signatures: [buyerSignature],
      signatureInvitations: [invitation],
    });
    const signedInvitation = createInvitation({
      ...invitation,
      status: ContractSignatureInvitationStatus.SIGNED,
      contract: signedContract,
      signedAt: new Date('2026-06-12T08:00:00.000Z'),
    });

    contract.signatureInvitations = [invitation];
    signatureInvitationRepository.findOne
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce(invitation);
    manager.findOne.mockResolvedValueOnce(signedInvitation);
    manager.find.mockResolvedValue([]);
    jest
      .spyOn(service, 'getSignatureAuditPacket')
      .mockResolvedValue(createAuditPacket(signedContract));

    const result = await service.signContractFromInvitation(
      'raw-token',
      {
        signerName: 'Jane Buyer',
        signerTitle: 'Director',
        signerEmail: 'buyer@example.test',
        consentText: 'I agree to sign this sales contract.',
      },
      {
        ipAddress: '203.0.113.10',
        userAgent: 'Jest',
      },
    );

    const savedSignatureCall = manager.save.mock.calls.find(
      ([entity]) =>
        isRecord(entity) && entity.signerType === ContractSignerType.BUYER,
    );
    const savedSignature = savedSignatureCall?.[0];
    const contractUpdate = getContractUpdatePayload(manager);

    expect(isRecord(savedSignature) ? savedSignature.documentHash : null).toBe(
      'frozen-hash',
    );
    expect(contractUpdate).toEqual(
      expect.objectContaining({
        status: SalesContractStatus.BUYER_SIGNED,
        signatureStatus: SalesContractSignatureStatus.BUYER_SIGNED,
        signatureDocumentHash: 'frozen-hash',
      }),
    );
    expect(result.session.documentHash).toBe('frozen-hash');
    const lockedFindOptions = signatureInvitationRepository.findOne.mock
      .calls[0][0] as {
      where?: { tokenHash?: unknown };
      lock?: { mode?: unknown };
      relations?: unknown;
    };
    const relationFindOptions = signatureInvitationRepository.findOne.mock
      .calls[1][0] as {
      where?: { _id?: unknown };
      relations?: unknown;
      lock?: unknown;
    };

    expect(lockedFindOptions.where?.tokenHash).toEqual(expect.any(String));
    expect(lockedFindOptions.lock).toEqual({ mode: 'pessimistic_write' });
    expect(lockedFindOptions).not.toHaveProperty('relations');
    expect(relationFindOptions.where).toEqual({ _id: invitation._id });
    expect(relationFindOptions.lock).toBeUndefined();
    expect(relationFindOptions.relations).toEqual(
      expect.arrayContaining(['contract', 'contract.buyer']),
    );
    expect(eventSaves.map((event) => event.eventType)).not.toContain(
      ContractSignatureEventType.CONTRACT_FROZEN,
    );
    expect(eventSaves).toEqual([
      expect.objectContaining({
        eventType: ContractSignatureEventType.BUYER_SIGNED,
        actorType: ContractSignatureActorType.BUYER,
        documentHash: 'frozen-hash',
      }),
    ]);
  });
});
