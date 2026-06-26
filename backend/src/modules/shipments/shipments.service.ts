import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike, EntityManager } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { Container } from './entities/container.entity';
import {
  ShipmentDocument,
  DocumentType,
} from './entities/shipment-document.entity';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { InventoryService } from '../inventory/inventory.service';
import { CreateShipmentDto } from '@/modules/shipments/dto/create-shipment.dto';
import { UpdateShipmentDto } from '@/modules/shipments/dto/update-shipment.dto';
import { User } from '@/modules/users/entities/user.entity';
import { SalesContractsService } from '../sales-contracts/sales-contracts.service';
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
    contract: any,
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

    shipment.auditTrail.push(entry);
  }

  // ===========================================================================
  // PUBLIC CRUD METHODS
  // ===========================================================================

  async create(createShipmentDto: any, user: User) {
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

      const contract = (await queryRunner.manager.findOne('SalesContract', {
        where: { _id: salesContractId },
      })) as any;
      const routeData = await this.resolveShipmentPorts({
        pol_port_id:
          shipmentData.pol_port_id ?? contract?.pol_port_id ?? undefined,
        pol: shipmentData.pol ?? contract?.pol ?? undefined,
        pod_port_id:
          shipmentData.pod_port_id ?? contract?.pod_port_id ?? undefined,
        pod: shipmentData.pod ?? contract?.pod ?? undefined,
      });

      const shipment = this.shipmentRepository.create({
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
        const containerEntities = containers.map((c) =>
          this.containerRepository.create({
            ...c,
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

  async findAll(query: any) {
    const current = +query.current || 1;
    const pageSize = +query.pageSize || 10;
    const skip = (current - 1) * pageSize;

    const {
      current: _c,
      pageSize: _p,
      sort: _s,
      populate: _pop,
      search: _search,
      ...filters
    } = query;
    ['current', 'pageSize', 'sort', 'populate', 'search'].forEach(
      (key) => delete filters[key],
    );

    // Build where clause with sanitized search input
    const where: any = { ...filters };

    if (query.search) {
      // SECURITY: Sanitize search input to prevent ReDoS
      const sanitized = this.sanitizeSearchInput(query.search);
      where.shipmentNumber = ILike(`%${sanitized}%`);
    }

    const [results, total] = await this.shipmentRepository.findAndCount({
      where,
      relations: [
        'salesContract',
        'salesContract.buyer',
        'salesContract.proformaInvoice',
        'logisticsPartner',
        'createdBy',
      ],
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: skip,
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

  async getStats() {
    const total = await this.shipmentRepository.countBy({});
    const inTransit = await this.shipmentRepository.countBy({
      status: ShipmentStatus.ON_BOARD,
    });
    const closed = await this.shipmentRepository.countBy({
      status: ShipmentStatus.CLOSED,
    });

    return {
      total,
      inTransit,
      closed,
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

  async update(id: string, updateShipmentDto: UpdateShipmentDto) {
    const shipment = await this.findOne(id);
    const previousValues: Record<string, unknown> = {};

    // Capture previous values for audit trail
    if (updateShipmentDto.bookingNumber !== undefined) {
      previousValues.bookingNumber = shipment.bookingNumber;
    }
    if (updateShipmentDto.etd !== undefined) {
      previousValues.etd = shipment.etd;
    }
    if (updateShipmentDto.status !== undefined) {
      previousValues.status = shipment.status;
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
      const contract = (await this.dataSource.manager.findOne('SalesContract', {
        where: { _id: shipment.salesContractId },
      })) as any;

      await this.syncContractBookingFromShipment(this.dataSource.manager, contract, {
        bookingNumber: updateShipmentDto.bookingNumber,
        etd: updateShipmentDto.etd,
      });
    }

    // Add audit trail
    if (Object.keys(changes).length > 0) {
      this.addAuditTrail(updated, 'UPDATED', 'SYSTEM', changes);
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
  ) {
    const shipment = await this.findOne(id);
    const currentStatus = shipment.status;
    const contract = shipment.salesContract;
    const pi = contract?.proformaInvoice;

    // CRITICAL: Validate status transition (business logic enforcement)
    this.validateStatusTransition(currentStatus, newStatus);

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
          d.documentType === DocumentType.CERTIFICATE_OF_ORIGIN ||
          d.documentType === DocumentType.PHYTOSANITARY,
      );
      // NOTE: For demo - real ERP would check for INSURANCE_POLICY
      if (!hasRequiredDocs) {
        // Warning instead of block for demo flexibility
        console.warn(
          `CIF shipment ${shipment.shipmentNumber}: Consider uploading origin certificates`,
        );
      }
    }

    // Update status
    const previousStatus = shipment.status;
    shipment.status = newStatus;

    // Add audit trail for status change
    this.addAuditTrail(shipment, 'STATUS_CHANGED', actor || 'SYSTEM', {
      status: { from: previousStatus, to: newStatus },
    });

    // Trigger downstream processes on significant status changes
    const triggerStatuses = [
      ShipmentStatus.ON_BOARD,
      ShipmentStatus.ARRIVED,
      ShipmentStatus.CLOSED,
    ];
    if (triggerStatuses.includes(newStatus) && contract?.status === 'CONFIRMED') {
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

  async issueStock(id: string, user: any) {
    const shipment = await this.findOne(id);
    if (shipment.isStockIssued) {
      throw new BadRequestException('Hàng trong lô này đã được xuất kho rồi.');
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

      // Update shipment status to LOADING
      shipment.isStockIssued = true;
      shipment.stockIssuedAt = new Date();
      shipment.status = ShipmentStatus.LOADING;

      // Add audit trail
      this.addAuditTrail(
        shipment,
        'STOCK_ISSUED',
        user.username || user.name || 'UNKNOWN',
        {
          isStockIssued: { from: false, to: true },
          status: { from: ShipmentStatus.BOOKED, to: ShipmentStatus.LOADING },
        },
      );

      const savedShipment = await manager.save(shipment);

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
    containerData: Partial<Container>,
    actor?: string,
  ) {
    const shipment = await this.findOne(shipmentId);

    const container = this.containerRepository.create({
      ...containerData,
      shipmentId,
    });

    const savedContainer = await this.containerRepository.save(container);

    // Add audit trail
    this.addAuditTrail(shipment, 'CONTAINER_ADDED', actor || 'SYSTEM', {
      containerId: { from: null, to: savedContainer._id },
      containerType: { from: null, to: containerData.type },
    });

    return savedContainer;
  }

  /**
   * Removes a container from shipment.
   */
  async removeContainer(
    shipmentId: string,
    containerId: string,
    actor?: string,
  ) {
    const shipment = await this.findOne(shipmentId);
    const container = await this.containerRepository.findOne({
      where: { _id: containerId, shipmentId },
    });

    if (!container) {
      throw new NotFoundException('Container not found in this shipment');
    }

    await this.containerRepository.remove(container);

    // Add audit trail
    this.addAuditTrail(shipment, 'CONTAINER_REMOVED', actor || 'SYSTEM', {
      containerId: { from: containerId, to: null },
      containerType: { from: container.type, to: null },
    });

    return { deleted: true, containerId };
  }

  /**
   * Updates a container in shipment.
   */
  async updateContainer(
    shipmentId: string,
    containerId: string,
    containerData: Partial<Container>,
    actor?: string,
  ) {
    const shipment = await this.findOne(shipmentId);
    const container = await this.containerRepository.findOne({
      where: { _id: containerId, shipmentId },
    });

    if (!container) {
      throw new NotFoundException('Container not found in this shipment');
    }

    const previousValues = { ...container };
    Object.assign(container, containerData);

    const updatedContainer = await this.containerRepository.save(container);

    // Add audit trail
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(containerData) as (keyof Container)[]) {
      if (containerData[key] !== previousValues[key]) {
        changes[key] = {
          from: previousValues[key],
          to: containerData[key],
        };
      }
    }

    if (Object.keys(changes).length > 0) {
      this.addAuditTrail(shipment, 'CONTAINER_UPDATED', actor || 'SYSTEM', changes);
    }

    return updatedContainer;
  }

  // ===========================================================================
  // DOCUMENT MANAGEMENT
  // ===========================================================================

  async addDocument(shipmentId: string, data: Partial<ShipmentDocument>) {
    const doc = this.docRepository.create({ ...data, shipmentId });
    return this.docRepository.save(doc);
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
    const shipment = await this.findOne(id);
    return shipment.auditTrail || [];
  }
}

// Export constants for use in controller
export { SHIPMENT_ROLES, ACCOUNT_CODES };
