import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike, EntityManager } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { Container, ContainerType } from './entities/container.entity';
import {
  ShipmentDocument,
  DocumentType,
} from './entities/shipment-document.entity';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { InventoryService } from '../inventory/inventory.service';
import {
  CreateShipmentDto,
  ShipmentContainerDto,
} from '@/modules/shipments/dto/create-shipment.dto';
import { UpdateShipmentDto } from '@/modules/shipments/dto/update-shipment.dto';
import { QueryShipmentDto } from '@/modules/shipments/dto/query-shipment.dto';
import { CreateContainerDto } from '@/modules/shipments/dto/create-container.dto';
import { UpsertShipmentDocumentDto } from '@/modules/shipments/dto/upsert-shipment-document.dto';
import { User } from '@/modules/users/entities/user.entity';
import { SalesContractsService } from '../sales-contracts/sales-contracts.service';
import {
  SalesContract,
  SalesContractStatus,
} from '../sales-contracts/entities/sales-contract.entity';
import { INCOTERM_CONFIG, IncotermCategory } from '@/helpers/incoterm.util';
import { Incoterm } from '../quotations/entities/quotation.entity';
import { AccountingService } from '../accounting/accounting.service';
import { LogisticsAllocationService } from './logistics-allocation.service';
import Decimal from 'decimal.js';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { PortsService } from '../ports/ports.service';

// =============================================================================
// CONSTANTS - Extracted from hardcoded values for maintainability
// =============================================================================

/**
 * Valid status transitions for shipments.
 * This ensures business logic integrity - shipments must progress through
 * stages in correct order: BOOKED → LOADING → ON_BOARD → ARRIVED → CLOSED
 */
const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.BOOKED]: [ShipmentStatus.LOADING],
  [ShipmentStatus.LOADING]: [ShipmentStatus.CUSTOMS_CLEARED, ShipmentStatus.ON_BOARD],
  [ShipmentStatus.CUSTOMS_CLEARED]: [ShipmentStatus.ON_BOARD],
  [ShipmentStatus.ON_BOARD]: [ShipmentStatus.ARRIVED],
  [ShipmentStatus.ARRIVED]: [ShipmentStatus.CLOSED],
  [ShipmentStatus.CLOSED]: [], // Terminal state - no transitions allowed
};

/**
 * Account codes for accounting entries.
 * Centralized here for easy maintenance and to prevent typos.
 */
const ACCOUNT_CODES = {
  COGS: '632',              // Cost of Goods Sold - Freight & Logistics
  PAYABLE: '331',           // Accounts Payable - Logistics Partner
  ADVANCE: '3387',          // Advance from Customers (for DDP/DAP)
  REVENUE: '511',           // Revenue from Sales
} as const;

/**
 * Roles that can perform issue-stock operation.
 * Prevents unauthorized users from releasing inventory.
 */
const ISSUE_STOCK_ROLES = ['ADMIN', 'MANAGER', 'WAREHOUSE', 'LOGISTICS'] as const;

/**
 * Roles that can perform shipment operations.
 */
const SHIPMENT_ROLES = {
  CREATE: ['ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT'] as const,
  UPDATE: ['ADMIN', 'MANAGER', 'LOGISTICS'] as const,
  STATUS: ['ADMIN', 'MANAGER', 'LOGISTICS'] as const,
  ISSUE_STOCK: ISSUE_STOCK_ROLES,
} as const;

// =============================================================================
// TYPES
// =============================================================================

type ShipmentRouteInput = {
  pol?: string | null;
  pol_port_id?: string | null;
  pod?: string | null;
  pod_port_id?: string | null;
};

type ShipmentRoutePatchInput = ShipmentRouteInput & {
  currentPol?: string | null;
  currentPolPortId?: string | null;
  currentPod?: string | null;
  currentPodPortId?: string | null;
  hasPol: boolean;
  hasPolPortId: boolean;
  hasPod: boolean;
  hasPodPortId: boolean;
};

/**
 * Audit trail entry for tracking changes to shipments.
 */
type AuditTrailEntry = {
  action: string;
  actor: string;
  at: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
};

type ShipmentContainerInput = ShipmentContainerDto | CreateContainerDto;

type NormalizedContainerInput = {
  containerNumber?: string;
  sealNumber?: string;
  type: ContainerType;
  weightKg: number;
  cbm: number;
};

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectRepository(ProformaInvoice)
    private piRepository: Repository<ProformaInvoice>,
    @InjectRepository(ShipmentDocument)
    private docRepository: Repository<ShipmentDocument>,
    private salesContractService: SalesContractsService,
    private accountingService: AccountingService,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private logisticsAllocationService: LogisticsAllocationService,
    private portsService: PortsService,
  ) {}

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private async resolveShipmentPorts(
    data: ShipmentRouteInput,
  ): Promise<ShipmentRouteInput> {
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

  private async resolveShipmentPortsForUpdate(
    data: ShipmentRoutePatchInput,
  ): Promise<ShipmentRouteInput> {
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

  /**
   * Validates and applies status transition.
   * Enforces business logic: shipments must progress through stages in order.
   *
   * @throws BadRequestException if transition is not allowed
   */
  private validateStatusTransition(
    currentStatus: ShipmentStatus,
    newStatus: ShipmentStatus,
  ): void {
    const allowedTransitions = SHIPMENT_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: Cannot move from '${currentStatus}' to '${newStatus}'. ` +
        `Allowed transitions from '${currentStatus}': ${allowedTransitions?.join(', ') || 'none'}`,
      );
    }
  }

  /**
   * Sanitizes search input to prevent ReDoS attacks.
   * Escapes SQL LIKE wildcards.
   */
  private sanitizeSearchInput(search: string): string {
    // Escape % and _ which are LIKE wildcards
    return search.replace(/[%_\\]/g, '\\$&');
  }

  /**
   * Syncs booking number and ETD from shipment to sales contract.
   * Extracted to avoid duplicate logic in create() and update().
   */
  private async syncContractBookingFromShipment(
    manager: EntityManager,
    contract: SalesContract | null,
    data: { bookingNumber?: string; etd?: string },
  ): Promise<boolean> {
    if (!contract) return false;

    let updated = false;

    if (data.bookingNumber && contract.bookingNumber !== data.bookingNumber) {
      contract.bookingNumber = data.bookingNumber;
      updated = true;
    }

    if (data.etd && contract.deliveryDate !== data.etd) {
      contract.deliveryDate = data.etd;
      updated = true;
    }

    if (updated) {
      await manager.save('SalesContract', contract);
    }

    return updated;
  }

  /**
   * Checks if payment is required before shipment (100% prepayment terms).
   */
  private isPrepaymentRequired(pi: ProformaInvoice | null | undefined): boolean {
    if (!pi) return false;

    const paymentTerms = pi.paymentTerms?.toLowerCase() || '';
    const depositPercent = Number(pi.depositPercent);

    return (
      paymentTerms.includes('prepayment') ||
      paymentTerms.includes('advance') ||
      depositPercent === 100
    );
  }

  /**
   * Adds an audit trail entry to shipment.
   */
  private addAuditTrail(
    shipment: Shipment,
    action: string,
    actor: string,
    changes?: Record<string, { from: unknown; to: unknown }>,
    reason?: string,
  ): void {
    if (!shipment.auditTrail) {
      shipment.auditTrail = [];
    }

    const entry: AuditTrailEntry = {
      action,
      actor,
      at: new Date().toISOString(),
    };

    if (changes) {
      entry.changes = changes;
    }
    if (reason) {
      entry.reason = reason;
    }

    shipment.auditTrail.push(entry);
  }

  private normalizeContainerInput(
    data: ShipmentContainerInput,
  ): NormalizedContainerInput {
    return {
      containerNumber: data.containerNumber?.trim() || undefined,
      sealNumber: data.sealNumber?.trim() || undefined,
      type:
        data.type ??
        (data.containerType
          ? (data.containerType as string as ContainerType)
          : ContainerType.C20DC),
      weightKg: Number(data.weightKg ?? data.grossWeightKg ?? 0),
      cbm: Number(data.cbm ?? data.volumeCbm ?? 0),
    };
  }

  private async findOneWithAudit(id: string): Promise<Shipment> {
    const shipment = await this.shipmentRepository
      .createQueryBuilder('shipment')
      .leftJoinAndSelect('shipment.salesContract', 'salesContract')
      .leftJoinAndSelect('salesContract.buyer', 'buyer')
      .leftJoinAndSelect('salesContract.items', 'salesContractItems')
      .leftJoinAndSelect('salesContractItems.product', 'product')
      .leftJoinAndSelect('salesContract.proformaInvoice', 'proformaInvoice')
      .leftJoinAndSelect('shipment.createdBy', 'createdBy')
      .leftJoinAndSelect('shipment.containers', 'containers')
      .leftJoinAndSelect('shipment.logisticsPartner', 'logisticsPartner')
      .addSelect('shipment.auditTrail')
      .where('shipment._id = :id', { id })
      .getOne();

    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  private async findOneWithAuditForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<Shipment> {
    const shipment = await manager
      .createQueryBuilder(Shipment, 'shipment')
      .addSelect('shipment.auditTrail')
      .where('shipment._id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  private validateStatusReadiness(
    shipment: Shipment,
    newStatus: ShipmentStatus,
  ): void {
    if (newStatus === ShipmentStatus.LOADING) {
      const missing: string[] = [];
      if (!shipment.isStockIssued) missing.push('stock issue confirmation');
      if (!shipment.bookingNumber) missing.push('booking number');
      if (!shipment.etd) missing.push('ETD');
      if (!shipment.containers?.length) missing.push('container/loading unit');

      if (missing.length > 0) {
        throw new BadRequestException(
          `Shipment is not ready for LOADING. Missing: ${missing.join(', ')}`,
        );
      }
    }

    if (newStatus === ShipmentStatus.ON_BOARD) {
      const missing: string[] = [];
      if (!shipment.isStockIssued) missing.push('stock issue confirmation');
      if (!shipment.logisticsPartnerId) missing.push('forwarder');
      if (!shipment.bookingNumber) missing.push('booking number');
      if (!shipment.pol) missing.push('POL');
      if (!shipment.pod) missing.push('POD');
      if (!shipment.etd) missing.push('ETD');
      if (!shipment.vesselName) missing.push('vessel/flight');
      if (!shipment.containers?.length) missing.push('container/loading unit');

      const incompleteContainers = (shipment.containers || []).filter(
        (container) =>
          container.type !== ContainerType.LCL &&
          (!container.containerNumber || !container.sealNumber),
      );
      if (incompleteContainers.length > 0) {
        missing.push('container number and seal for FCL containers');
      }

      if (missing.length > 0) {
        throw new BadRequestException(
          `Shipment is not ready for ON_BOARD. Missing: ${missing.join(', ')}`,
        );
      }
    }

    if (newStatus === ShipmentStatus.ARRIVED && !shipment.eta) {
      throw new BadRequestException('ETA is required before marking ARRIVED');
    }
  }

  // ===========================================================================
  // PUBLIC CRUD METHODS
  // ===========================================================================

  async create(createShipmentDto: CreateShipmentDto, user: User) {
    const { containers, proformaInvoiceId, ...shipmentData } =
      createShipmentDto;
    let { salesContractId } = shipmentData;

    // Logic: If creating from PI, find the linked Sales Contract
    if (!salesContractId && proformaInvoiceId) {
      const pi = await this.piRepository.findOne({
        where: { _id: proformaInvoiceId },
        relations: ['salesContract'],
      });
      if (!pi) throw new NotFoundException('Proforma Invoice not found');
      if (!pi.salesContractId) {
        throw new BadRequestException(
          'PI này chưa được chuyển đổi thành Hợp đồng (Sales Contract). Vui lòng duyệt hợp đồng trước khi lên lô.',
        );
      }
      salesContractId = pi.salesContractId;
    }

    if (!salesContractId) {
      throw new BadRequestException(
        'Vui lòng cung cấp Sales Contract ID hoặc Proforma Invoice ID hợp lệ.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = createOpaqueCode('shp_no').split('_').pop()?.toUpperCase();
      const shipmentNumber = `SHP-${dateStr}-${suffix}`;

      const contract = await queryRunner.manager.findOne(SalesContract, {
        where: { _id: salesContractId },
      });
      if (!contract) throw new NotFoundException('Sales contract not found');
      if (contract.status !== SalesContractStatus.CONFIRMED) {
        throw new BadRequestException(
          'Sales contract must be CONFIRMED before creating shipment',
        );
      }
      const routeData = await this.resolveShipmentPorts({
        pol_port_id:
          shipmentData.pol_port_id ?? contract?.pol_port_id ?? undefined,
        pol: shipmentData.pol ?? contract?.pol ?? undefined,
        pod_port_id:
          shipmentData.pod_port_id ?? contract?.pod_port_id ?? undefined,
        pod: shipmentData.pod ?? contract?.pod ?? undefined,
      });

      const shipment = this.shipmentRepository.create();
      Object.assign(shipment, {
        ...shipmentData,
        salesContractId,
        shipmentNumber,
        createdByUsername: user.username,
        status: ShipmentStatus.BOOKED,
        // Inherit logistics info from contract if not provided
        logisticsPartnerId:
          shipmentData.logisticsPartnerId || contract?.logisticsPartnerId,
        bookingNumber: shipmentData.bookingNumber || contract?.bookingNumber,
        ...routeData,
        freightCost: shipmentData.freightCost || contract?.seaFreight || 0,
        insuranceCost:
          shipmentData.insuranceCost || contract?.insuranceCost || 0,
        truckingCostVnd:
          shipmentData.truckingCostVnd || contract?.domesticTransportCost || 0,
        localChargesVnd:
          shipmentData.localChargesVnd || contract?.portCharges || 0,
        freightCurrency: contract?.currencyCode || 'USD',
        insuranceCurrency: contract?.currencyCode || 'USD',
        auditTrail: [],
      });

      const savedShipment = (await queryRunner.manager.save(
        shipment,
      )) as unknown as Shipment;

      // Add audit trail for creation
      this.addAuditTrail(savedShipment, 'CREATED', user.username);

      if (containers && containers.length > 0) {
        const containerEntities = containers.map((container) =>
          this.containerRepository.create({
            ...this.normalizeContainerInput(container),
            shipmentId: savedShipment._id,
          }),
        );
        await queryRunner.manager.save(containerEntities);

        // Audit trail for containers
        this.addAuditTrail(
          savedShipment,
          'CONTAINERS_ADDED',
          user.username,
          { count: { from: 0, to: containers.length } },
        );
      }

      // Sync Booking Number and ETD back to Sales Contract
      await this.syncContractBookingFromShipment(queryRunner.manager, contract, {
        bookingNumber: shipmentData.bookingNumber,
        etd: shipmentData.etd,
      });
      await queryRunner.manager.save(savedShipment);

      await queryRunner.commitTransaction();
      return this.findOne(savedShipment._id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unknown error occurred',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: QueryShipmentDto) {
    const current = Math.max(1, Number(query.current || 1));
    const pageSize = Math.min(Math.max(1, Number(query.pageSize || 10)), 100);
    const skip = (current - 1) * pageSize;

    const qb = this.shipmentRepository
      .createQueryBuilder('shipment')
      .leftJoinAndSelect('shipment.salesContract', 'salesContract')
      .leftJoinAndSelect('salesContract.buyer', 'buyer')
      .leftJoinAndSelect('salesContract.proformaInvoice', 'proformaInvoice')
      .leftJoinAndSelect('shipment.logisticsPartner', 'logisticsPartner')
      .leftJoinAndSelect('shipment.createdBy', 'createdBy')
      .leftJoinAndSelect('shipment.containers', 'containers')
      .skip(skip)
      .take(pageSize);

    if (query.status) {
      qb.andWhere('shipment.status = :status', { status: query.status });
    }
    if (query.pol) {
      qb.andWhere('shipment.pol ILIKE :pol', {
        pol: `%${this.sanitizeSearchInput(query.pol)}%`,
      });
    }
    if (query.pod) {
      qb.andWhere('shipment.pod ILIKE :pod', {
        pod: `%${this.sanitizeSearchInput(query.pod)}%`,
      });
    }
    if (query.bookingNumber) {
      qb.andWhere('shipment.bookingNumber ILIKE :bookingNumber', {
        bookingNumber: `%${this.sanitizeSearchInput(query.bookingNumber)}%`,
      });
    }
    if (query.salesContractId) {
      qb.andWhere('shipment.salesContractId = :salesContractId', {
        salesContractId: query.salesContractId,
      });
    }
    if (query.logisticsPartnerId) {
      qb.andWhere('shipment.logisticsPartnerId = :logisticsPartnerId', {
        logisticsPartnerId: query.logisticsPartnerId,
      });
    }

    if (query.search) {
      const sanitized = `%${this.sanitizeSearchInput(query.search)}%`;
      qb.andWhere(
        '(shipment.shipmentNumber ILIKE :search OR shipment.bookingNumber ILIKE :search OR shipment.blNumber ILIKE :search)',
        { search: sanitized },
      );
    }

    const sortDirection = query.sort === 'createdAt' ? 'ASC' : 'DESC';
    qb.orderBy('shipment.createdAt', sortDirection);

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

  async getStats() {
    const total = await this.shipmentRepository.countBy({});
    const rawStatusCounts = await this.shipmentRepository
      .createQueryBuilder('shipment')
      .select('shipment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('shipment.status')
      .getRawMany<{ status: ShipmentStatus; count: string }>();

    const statusCounts = Object.values(ShipmentStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<ShipmentStatus, number>,
    );

    rawStatusCounts.forEach((item) => {
      statusCounts[item.status] = Number(item.count);
    });

    const inTransit =
      statusCounts[ShipmentStatus.LOADING] +
      statusCounts[ShipmentStatus.CUSTOMS_CLEARED] +
      statusCounts[ShipmentStatus.ON_BOARD] +
      statusCounts[ShipmentStatus.ARRIVED];

    const delayed = await this.shipmentRepository
      .createQueryBuilder('shipment')
      .where('shipment.status IN (:...statuses)', {
        statuses: [
          ShipmentStatus.BOOKED,
          ShipmentStatus.LOADING,
          ShipmentStatus.CUSTOMS_CLEARED,
        ],
      })
      .andWhere('shipment.etd IS NOT NULL')
      .andWhere('shipment.etd < :now', { now: new Date() })
      .getCount();

    const closed = statusCounts[ShipmentStatus.CLOSED];

    return {
      total,
      inTransit,
      closed,
      delayed,
      statusCounts,
    };
  }

  async findOne(id: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { _id: id },
      relations: [
        'salesContract',
        'salesContract.buyer',
        'salesContract.items',
        'salesContract.items.product',
        'salesContract.proformaInvoice',
        'createdBy',
        'containers',
        'logisticsPartner',
      ],
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  async update(id: string, updateShipmentDto: UpdateShipmentDto, user: User) {
    if (updateShipmentDto.containers !== undefined) {
      throw new BadRequestException(
        'Use shipment container endpoints for container changes',
      );
    }
    if (updateShipmentDto.status !== undefined) {
      throw new BadRequestException(
        'Use shipment status endpoint for status changes',
      );
    }

    const shipment = await this.findOneWithAudit(id);
    const previousValues: Record<string, unknown> = {};

    // Capture previous values for audit trail
    if (updateShipmentDto.bookingNumber !== undefined) {
      previousValues.bookingNumber = shipment.bookingNumber;
    }
    if (updateShipmentDto.etd !== undefined) {
      previousValues.etd = shipment.etd;
    }

    const hasPolPortId = Object.prototype.hasOwnProperty.call(
      updateShipmentDto,
      'pol_port_id',
    );
    const hasPol = Object.prototype.hasOwnProperty.call(
      updateShipmentDto,
      'pol',
    );
    const hasPodPortId = Object.prototype.hasOwnProperty.call(
      updateShipmentDto,
      'pod_port_id',
    );
    const hasPod = Object.prototype.hasOwnProperty.call(
      updateShipmentDto,
      'pod',
    );
    const routeData = await this.resolveShipmentPortsForUpdate({
      pol_port_id: updateShipmentDto.pol_port_id,
      pol: updateShipmentDto.pol,
      pod_port_id: updateShipmentDto.pod_port_id,
      pod: updateShipmentDto.pod,
      currentPolPortId: shipment.pol_port_id,
      currentPol: shipment.pol,
      currentPodPortId: shipment.pod_port_id,
      currentPod: shipment.pod,
      hasPolPortId,
      hasPol,
      hasPodPortId,
      hasPod,
    });

    // Build changes for audit trail
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (updateShipmentDto.bookingNumber !== undefined) {
      changes.bookingNumber = {
        from: previousValues.bookingNumber,
        to: updateShipmentDto.bookingNumber,
      };
    }
    if (updateShipmentDto.etd !== undefined) {
      changes.etd = { from: previousValues.etd, to: updateShipmentDto.etd };
    }

    const updated = await this.shipmentRepository.save({
      ...shipment,
      ...updateShipmentDto,
      ...routeData,
    });

    // Sync Booking Number and ETD back to Sales Contract (extracted logic)
    if (
      shipment.salesContractId &&
      (updateShipmentDto.bookingNumber !== undefined ||
        updateShipmentDto.etd !== undefined)
    ) {
      const contract = await this.dataSource.manager.findOne(SalesContract, {
        where: { _id: shipment.salesContractId },
      });

      await this.syncContractBookingFromShipment(this.dataSource.manager, contract, {
        bookingNumber: updateShipmentDto.bookingNumber,
        etd: updateShipmentDto.etd,
      });
    }

    // Add audit trail
    if (Object.keys(changes).length > 0) {
      this.addAuditTrail(updated, 'UPDATED', user.username, changes);
      await this.shipmentRepository.save(updated);
    }

    // Recalculate logistics costs if shipment is on board and costs changed
    if (updated.status === ShipmentStatus.ON_BOARD) {
      const costFields = [
        'freightCost',
        'insuranceCost',
        'localChargesVnd',
        'truckingCostVnd',
        'customsFeeVnd',
      ];
      const hasCostUpdate = Object.keys(updateShipmentDto).some((key) =>
        costFields.includes(key),
      );

      if (hasCostUpdate) {
        await this.allocateLogisticsCosts(id);
      }
    }

    return updated;
  }

  async remove(id: string, actor: string) {
    const shipment = await this.findOneWithAudit(id);
    if (shipment.isStockIssued || shipment.status !== ShipmentStatus.BOOKED) {
      throw new BadRequestException(
        'Only BOOKED shipments without issued stock can be deleted',
      );
    }

    this.addAuditTrail(shipment, 'DELETED', actor);
    await this.shipmentRepository.save(shipment);
    await this.shipmentRepository.softDelete({ _id: id });

    return { _id: id, deleted: true };
  }

  // ===========================================================================
  // STATUS MANAGEMENT
  // ===========================================================================

  /**
   * Updates shipment status with full validation.
   *
   * Validations performed:
   * 1. Status transition is valid (business logic)
   * 2. Payment requirements met (prepayment check)
   * 3. Required documents present (for ON_BOARD with CIF)
   * 4. Audit trail recorded
   *
   * @throws BadRequestException if validation fails
   */
  async updateStatus(
    id: string,
    newStatus: ShipmentStatus,
    actor?: string,
    reason?: string,
  ) {
    const shipment = await this.findOneWithAudit(id);
    const currentStatus = shipment.status;
    const contract = shipment.salesContract;
    const pi = contract?.proformaInvoice;

    // CRITICAL: Validate status transition (business logic enforcement)
    this.validateStatusTransition(currentStatus, newStatus);
    this.validateStatusReadiness(shipment, newStatus);

    // SENIOR FINANCIAL GUARDRAIL: Block shipment if payment is required but not received
    if (this.isPrepaymentRequired(pi) && !pi?.isPaid) {
      if (
        newStatus === ShipmentStatus.LOADING ||
        newStatus === ShipmentStatus.ON_BOARD
      ) {
        throw new BadRequestException(
          `CHẶN TÀI CHÍNH: Hợp đồng ${contract.contractNumber} áp dụng điều khoản TRẢ TRƯỚC 100%, ` +
            `nhưng PI ${pi.piNumber} chưa được xác nhận thanh toán. Không thể giao hàng!`,
        );
      }
    }

    // TECH LEAD COMPLIANCE: Check for required documents before moving to ON_BOARD
    if (
      newStatus === ShipmentStatus.ON_BOARD &&
      contract?.incoterm === Incoterm.CIF
    ) {
      const docs = await this.getDocuments(id);
      const hasRequiredDocs = docs.some(
        (d) =>
          d.status === 'DONE' &&
          (d.documentType === DocumentType.CERTIFICATE_OF_ORIGIN ||
            d.documentType === DocumentType.PHYTOSANITARY),
      );
      if (!hasRequiredDocs) {
        throw new BadRequestException(
          `CIF shipment ${shipment.shipmentNumber} requires origin or phytosanitary documents before ON_BOARD`,
        );
      }
    }

    // Update status
    const previousStatus = shipment.status;
    shipment.status = newStatus;

    // Add audit trail for status change
    this.addAuditTrail(
      shipment,
      'STATUS_CHANGED',
      actor || 'SYSTEM',
      {
        status: { from: previousStatus, to: newStatus },
      },
      reason,
    );

    // Trigger downstream processes on significant status changes
    if (
      newStatus === ShipmentStatus.ON_BOARD &&
      contract?.status === SalesContractStatus.CONFIRMED
    ) {
      await this.salesContractService.shipContract(shipment.salesContractId);
      await this.allocateLogisticsCosts(id);
      await this.eventEmitter.emitAsync('shipment.on_board', { shipment });
    }

    // TECH LEAD LOGIC: Finalize Revenue for DDP/DAP on Arrival
    if (newStatus === ShipmentStatus.ARRIVED && contract) {
      const incotermConfig = INCOTERM_CONFIG[contract.incoterm];
      if (incotermConfig?.category === IncotermCategory.SELLER_PAYS_FREIGHT) {
        await this.accountingService.createJournalEntry({
          description: `Revenue Realized on Arrival (${contract.incoterm}): ${contract.contractNumber}`,
          referenceType: 'SHIPMENT',
          referenceId: shipment._id,
          items: [
            {
              accountCode: ACCOUNT_CODES.ADVANCE,
              debit: Number(contract.totalAmountVnd),
              credit: 0,
            },
            {
              accountCode: ACCOUNT_CODES.REVENUE,
              debit: 0,
              credit: Number(contract.totalAmountVnd),
            },
          ],
        });
      }
    }

    return await this.shipmentRepository.save(shipment);
  }

  // ===========================================================================
  // STOCK & INVENTORY
  // ===========================================================================

  async issueStock(id: string, user: User) {
    const shipment = await this.findOneWithAudit(id);
    if (shipment.isStockIssued) {
      throw new BadRequestException('Hàng trong lô này đã được xuất kho rồi.');
    }

    if (shipment.status !== ShipmentStatus.BOOKED) {
      throw new BadRequestException(
        'Only BOOKED shipments can be issued from stock',
      );
    }

    if (!shipment.salesContract || !shipment.salesContract.items) {
      throw new BadRequestException(
        'Không tìm thấy thông tin sản phẩm trong hợp đồng để xuất kho.',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // Pass manager to nested service for proper transaction handling
      const exportDelivery =
        await this.inventoryService.issueExportDeliveryForShipment(
          shipment,
          user,
          manager,
        );

      const managedShipment = await this.findOneWithAuditForUpdate(
        manager,
        id,
      );

      this.addAuditTrail(
        managedShipment,
        'STOCK_ISSUED',
        user.username,
        {
          isStockIssued: { from: false, to: true },
          status: { from: shipment.status, to: managedShipment.status },
        },
      );

      const savedShipment = await manager.save(managedShipment);

      return {
        ...savedShipment,
        exportDelivery,
      };
    });
  }

  // ===========================================================================
  // CONTAINER MANAGEMENT
  // ===========================================================================

  /**
   * Adds a container to shipment.
   * Provides atomic container addition without full array replacement.
   */
  async addContainer(
    shipmentId: string,
    containerData: CreateContainerDto,
    actor?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const shipment = await this.findOneWithAuditForUpdate(
        manager,
        shipmentId,
      );
      if ([ShipmentStatus.ARRIVED, ShipmentStatus.CLOSED].includes(shipment.status)) {
        throw new BadRequestException(
          'Cannot add container after shipment has arrived or closed',
        );
      }
      const normalizedContainerData = this.normalizeContainerInput(containerData);
      if (normalizedContainerData.containerNumber) {
        const duplicateContainer = await manager.findOne(Container, {
          where: {
            shipmentId,
            containerNumber: normalizedContainerData.containerNumber,
          },
        });
        if (duplicateContainer) {
          throw new ConflictException(
            `Container ${normalizedContainerData.containerNumber} already exists in this shipment`,
          );
        }
      }

      const container = manager.create(Container, {
        ...normalizedContainerData,
        shipmentId,
      });

      const savedContainer = await manager.save(Container, container);

      this.addAuditTrail(shipment, 'CONTAINER_ADDED', actor || 'SYSTEM', {
        containerId: { from: null, to: savedContainer._id },
        containerType: { from: null, to: savedContainer.type },
      });
      await manager.save(Shipment, shipment);

      return savedContainer;
    });
  }

  /**
   * Removes a container from shipment.
   */
  async removeContainer(
    shipmentId: string,
    containerId: string,
    actor?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const shipment = await this.findOneWithAuditForUpdate(
        manager,
        shipmentId,
      );
      if (
        [ShipmentStatus.ON_BOARD, ShipmentStatus.ARRIVED, ShipmentStatus.CLOSED].includes(
          shipment.status,
        )
      ) {
        throw new BadRequestException(
          'Cannot remove container after shipment is on board',
        );
      }

      const container = await manager.findOne(Container, {
        where: { _id: containerId, shipmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!container) {
        throw new NotFoundException('Container not found in this shipment');
      }

      await manager.remove(Container, container);

      this.addAuditTrail(shipment, 'CONTAINER_REMOVED', actor || 'SYSTEM', {
        containerId: { from: containerId, to: null },
        containerType: { from: container.type, to: null },
      });
      await manager.save(Shipment, shipment);

      return { deleted: true, containerId };
    });
  }

  /**
   * Updates a container in shipment.
   */
  async updateContainer(
    shipmentId: string,
    containerId: string,
    containerData: CreateContainerDto,
    actor?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const shipment = await this.findOneWithAuditForUpdate(
        manager,
        shipmentId,
      );
      if ([ShipmentStatus.ARRIVED, ShipmentStatus.CLOSED].includes(shipment.status)) {
        throw new BadRequestException(
          'Cannot update container after shipment has arrived or closed',
        );
      }

      const container = await manager.findOne(Container, {
        where: { _id: containerId, shipmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!container) {
        throw new NotFoundException('Container not found in this shipment');
      }

      const previousValues = { ...container };
      const normalizedContainerData = this.normalizeContainerInput(containerData);
      if (
        normalizedContainerData.containerNumber &&
        normalizedContainerData.containerNumber !== container.containerNumber
      ) {
        const duplicateContainer = await manager.findOne(Container, {
          where: {
            shipmentId,
            containerNumber: normalizedContainerData.containerNumber,
          },
        });
        if (duplicateContainer && duplicateContainer._id !== containerId) {
          throw new ConflictException(
            `Container ${normalizedContainerData.containerNumber} already exists in this shipment`,
          );
        }
      }
      Object.assign(container, normalizedContainerData);

      const updatedContainer = await manager.save(Container, container);

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of Object.keys(
        normalizedContainerData,
      ) as (keyof NormalizedContainerInput)[]) {
        if (normalizedContainerData[key] !== previousValues[key]) {
          changes[key] = {
            from: previousValues[key],
            to: normalizedContainerData[key],
          };
        }
      }

      if (Object.keys(changes).length > 0) {
        this.addAuditTrail(
          shipment,
          'CONTAINER_UPDATED',
          actor || 'SYSTEM',
          changes,
        );
        await manager.save(Shipment, shipment);
      }

      return updatedContainer;
    });
  }

  // ===========================================================================
  // DOCUMENT MANAGEMENT
  // ===========================================================================

  async addDocument(
    shipmentId: string,
    data: UpsertShipmentDocumentDto,
    actor?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const shipment = await this.findOneWithAuditForUpdate(
        manager,
        shipmentId,
      );
      const existing = await manager.findOne(ShipmentDocument, {
        where: { shipmentId, documentType: data.documentType },
        lock: { mode: 'pessimistic_write' },
      });

      const documentData = {
        documentNumber: data.documentNumber?.trim() || undefined,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        fileUrl: data.fileUrl?.trim() || undefined,
        status: data.status || 'PENDING',
      };

      const doc = existing
        ? manager.merge(ShipmentDocument, existing, documentData)
        : manager.create(ShipmentDocument, {
            ...documentData,
            shipmentId,
            documentType: data.documentType,
          });

      const savedDocument = await manager.save(ShipmentDocument, doc);
      shipment.documentChecklist = {
        ...(shipment.documentChecklist || {}),
        [data.documentType]: savedDocument.status,
      };
      this.addAuditTrail(shipment, 'DOCUMENT_UPSERTED', actor || 'SYSTEM', {
        [data.documentType]: {
          from: existing?.status || null,
          to: savedDocument.status,
        },
      });
      await manager.save(Shipment, shipment);

      return savedDocument;
    });
  }

  async getDocuments(shipmentId: string) {
    return this.docRepository.find({
      where: { shipmentId },
      order: { documentType: 'ASC' },
    });
  }

  // ===========================================================================
  // COMMERCIAL INVOICE & REPORTING
  // ===========================================================================

  async getCommercialInvoiceData(id: string) {
    const shipment = await this.findOne(id);
    const sc = shipment.salesContract;

    return {
      invoiceNumber: shipment.shipmentNumber,
      date: new Date(),
      exporter: { name: 'Your Company Name', address: 'Your Address' },
      consignee: sc.buyer,
      vessel: shipment.vesselName,
      voyage: shipment.voyageNumber,
      pol: shipment.pol,
      pod: shipment.pod,
      incoterms: sc.incoterm,
      items: sc.items.map((item) => ({
        description: item.product.englishName || item.product.vietnameseName,
        hsCode: item.product.hsCode,
        quantity: item.quantity,
        unit: item.product.unitOfMeasure,
        price: item.unitPrice,
        amount: Number(item.quantity) * Number(item.unitPrice),
        netWeight:
          Number(item.quantity) * Number(item.product.netWeightPerCarton || 0),
        grossWeight:
          Number(item.quantity) *
          Number(item.product.grossWeightPerCarton || 0),
        cbm: Number(item.quantity) * Number(item.product.cbmPerCarton || 0),
      })),
      totalAmount: sc.totalAmount,
      currency: sc.currencyCode,
    };
  }

  // ===========================================================================
  // COST ALLOCATION & ACCOUNTING
  // ===========================================================================

  async allocateLogisticsCosts(id: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { _id: id },
      relations: [
        'salesContract',
        'salesContract.items',
        'salesContract.items.product',
      ],
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    // Clean up old logistics journal entries for this shipment
    await this.accountingService.deleteJournalEntriesByReference(
      'SHIPMENT',
      shipment._id,
      `Logistics Cost Allocation`,
    );

    await this.logisticsAllocationService.allocateCosts(id);

    const exRate = new Decimal(shipment.salesContract?.exchangeRate || 25000);
    const totalFreightVnd = new Decimal(shipment.freightCost || 0)
      .plus(shipment.insuranceCost || 0)
      .times(exRate);
    const totalLocalVnd = new Decimal(shipment.localChargesVnd || 0)
      .plus(shipment.truckingCostVnd || 0)
      .plus(shipment.customsFeeVnd || 0);

    const totalLogisticsVnd = totalFreightVnd.plus(totalLocalVnd);
    if (totalLogisticsVnd.isZero()) return;

    // Ensure partner exists to avoid floating journal entries
    if (!shipment.logisticsPartnerId) {
      throw new BadRequestException(
        `Lô hàng ${shipment.shipmentNumber} chưa chọn Đơn vị vận tải (Forwarder). Vui lòng chọn trước khi lưu chi phí.`,
      );
    }

    // Use extracted constants for account codes
    await this.accountingService.createJournalEntry({
      description: `Logistics Cost Allocation for Shipment ${shipment.shipmentNumber}`,
      referenceType: 'SHIPMENT',
      referenceId: shipment._id,
      items: [
        {
          accountCode: ACCOUNT_CODES.COGS,
          debit: totalLogisticsVnd.toNumber(),
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.PAYABLE,
          debit: 0,
          credit: totalLogisticsVnd.toNumber(),
          partnerId: shipment.logisticsPartnerId,
        },
      ],
    });
  }

  // ===========================================================================
  // PUBLIC TRACKING (Guest Access)
  // ===========================================================================

  async tracking(number: string) {
    // SECURITY: Sanitize input to prevent ReDoS
    const sanitized = this.sanitizeSearchInput(number);

    const shipment = await this.shipmentRepository.findOne({
      where: [
        { shipmentNumber: ILike(`%${sanitized}%`) },
        { blNumber: ILike(`%${sanitized}%`) },
        { bookingNumber: ILike(`%${sanitized}%`) },
      ],
      relations: [
        'salesContract',
        'salesContract.buyer',
        'logisticsPartner',
        'containers',
      ],
    });

    if (!shipment) {
      throw new NotFoundException('Không tìm thấy thông tin vận đơn này.');
    }

    return {
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
      pol: shipment.pol,
      pod: shipment.pod,
      etd: shipment.etd,
      eta: shipment.eta,
      vesselName: shipment.vesselName,
      voyageNumber: shipment.voyageNumber,
      shippingLine: shipment.shippingLine,
      bookingNumber: shipment.bookingNumber,
      logisticsPartner: shipment.logisticsPartner?.name,
      containers: shipment.containers,
      lastUpdated: shipment.updatedAt,
    };
  }

  // ===========================================================================
  // AUDIT TRAIL ACCESS
  // ===========================================================================

  /**
   * Returns audit trail for a shipment.
   */
  async getAuditTrail(id: string) {
    const shipment = await this.findOneWithAudit(id);
    return shipment.auditTrail || [];
  }
}

// Export constants for use in controller
export { SHIPMENT_ROLES, ACCOUNT_CODES };
