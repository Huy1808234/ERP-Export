import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike } from 'typeorm';
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
        throw new Error(
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
        // TECH LEAD INHERIT: Copy logistics info from contract if not provided
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
      });

      const savedShipment = (await queryRunner.manager.save(
        shipment,
      )) as unknown as Shipment;

      if (containers && containers.length > 0) {
        const containerEntities = containers.map((c) =>
          this.containerRepository.create({
            ...c,
            shipmentId: savedShipment._id,
          }),
        );
        await queryRunner.manager.save(containerEntities);
      }

      // TECH LEAD FIX: Sync Booking Number and ETD back to Sales Contract
      if (contract) {
        let contractUpdated = false;
        if (
          shipmentData.bookingNumber &&
          contract.bookingNumber !== shipmentData.bookingNumber
        ) {
          contract.bookingNumber = shipmentData.bookingNumber;
          contractUpdated = true;
        }
        if (shipmentData.etd && contract.deliveryDate !== shipmentData.etd) {
          contract.deliveryDate = shipmentData.etd;
          contractUpdated = true;
        }
        if (contractUpdated) {
          await queryRunner.manager.save('SalesContract', contract);
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedShipment._id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
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

    // Enhanced search logic
    const where: any = { ...filters };
    if (query.search) {
      where.shipmentNumber = ILike(`%${query.search}%`);
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
    const total = await this.shipmentRepository.count();
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
    const updated = await this.shipmentRepository.save({
      ...shipment,
      ...updateShipmentDto,
      ...routeData,
    });

    // TECH LEAD FIX: Sync Booking Number and ETD back to Sales Contract on update
    if (
      shipment.salesContractId &&
      (updateShipmentDto.bookingNumber !== undefined ||
        updateShipmentDto.etd !== undefined)
    ) {
      const contract = (await this.dataSource.manager.findOne('SalesContract', {
        where: { _id: shipment.salesContractId },
      })) as any;
      if (contract) {
        let contractUpdated = false;
        if (
          updateShipmentDto.bookingNumber &&
          contract.bookingNumber !== updateShipmentDto.bookingNumber
        ) {
          contract.bookingNumber = updateShipmentDto.bookingNumber;
          contractUpdated = true;
        }
        if (
          updateShipmentDto.etd &&
          contract.deliveryDate !== updateShipmentDto.etd
        ) {
          contract.deliveryDate = updateShipmentDto.etd;
          contractUpdated = true;
        }
        if (contractUpdated) {
          await this.dataSource.manager.save('SalesContract', contract);
        }
      }
    }

    // Nếu lô hàng đã lên tàu (ON_BOARD), việc cập nhật chi phí sẽ kích hoạt tính toán lại công nợ
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
      const exportDelivery =
        await this.inventoryService.issueExportDeliveryForShipment(
          shipment,
          user,
          manager,
        );

      // Update shipment status to LOADING (Hàng đang đóng/rời kho)
      shipment.isStockIssued = true;
      shipment.stockIssuedAt = new Date();
      shipment.status = ShipmentStatus.LOADING;

      const savedShipment = await manager.save(shipment);

      return {
        ...savedShipment,
        exportDelivery,
      };
    });
  }

  async updateStatus(id: string, status: ShipmentStatus) {
    const shipment = await this.findOne(id);
    const contract = shipment.salesContract;
    const pi = contract?.proformaInvoice;

    // SENIOR FINANCIAL GUARDRAIL: Block shipment if payment is required but not received
    // Conditions for Prepayment block:
    // 1. Payment Term contains "Prepayment" or "T/T Advance" (100%)
    // 2. Deposit Percent is 100%
    const isPrepaymentTerm =
      pi?.paymentTerms?.toLowerCase().includes('prepayment') ||
      pi?.paymentTerms?.toLowerCase().includes('advance') ||
      Number(pi?.depositPercent) === 100;

    if (isPrepaymentTerm && !pi?.isPaid) {
      if (
        status === ShipmentStatus.LOADING ||
        status === ShipmentStatus.ON_BOARD
      ) {
        throw new BadRequestException(
          `CHẶN TÀI CHÍNH: Hợp đồng ${contract.contractNumber} áp dụng điều khoản TRẢ TRƯỚC 100%, ` +
            `nhưng PI ${pi.piNumber} chưa được xác nhận thanh toán. Không thể giao hàng!`,
        );
      }
    }

    // TECH LEAD COMPLIANCE: Check for required documents before moving status
    if (
      status === ShipmentStatus.ON_BOARD &&
      contract?.incoterm === Incoterm.CIF
    ) {
      const docs = await this.getDocuments(id);
      const hasInsurance = docs.some(
        (d) =>
          d.documentType === DocumentType.CERTIFICATE_OF_ORIGIN ||
          d.documentType === DocumentType.PHYTOSANITARY,
      );
      // NOTE: For this demo, let's say CIF needs any document uploaded to signify activity
      // Real ERP: docs.some(d => d.documentType === DocumentType.INSURANCE_POLICY)
    }

    shipment.status = status;

    // Fix: Trigger accounting/debt recognition even if user skips ON_BOARD step
    const triggerStatuses = [
      ShipmentStatus.ON_BOARD,
      ShipmentStatus.ARRIVED,
      ShipmentStatus.CLOSED,
    ];
    if (triggerStatuses.includes(status) && contract?.status === 'CONFIRMED') {
      await this.salesContractService.shipContract(shipment.salesContractId);
      await this.allocateLogisticsCosts(id);
      await this.eventEmitter.emitAsync('shipment.on_board', { shipment });
    }

    // TECH LEAD LOGIC: Finalize Revenue for DDP/DAP on Arrival
    if (status === ShipmentStatus.ARRIVED && contract) {
      const incotermConfig = INCOTERM_CONFIG[contract.incoterm];
      if (incotermConfig?.category === IncotermCategory.SELLER_PAYS_FREIGHT) {
        // Move from 3387 to 511
        await this.accountingService.createJournalEntry({
          description: `Revenue Realized on Arrival (${contract.incoterm}): ${contract.contractNumber}`,
          referenceType: 'SHIPMENT',
          referenceId: shipment._id,
          items: [
            {
              accountCode: '3387',
              debit: Number(contract.totalAmountVnd),
              credit: 0,
            },
            {
              accountCode: '511',
              debit: 0,
              credit: Number(contract.totalAmountVnd),
            },
          ],
        });
      }
    }

    return await this.shipmentRepository.save(shipment);
  }

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

    // Clean up old logistics journal entries for this shipment to avoid duplicates
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

    // TECH LEAD FIX: Ensure partner exists to avoid "floating" journal entries with null partnerId
    if (!shipment.logisticsPartnerId) {
      throw new BadRequestException(
        `Lô hàng ${shipment.shipmentNumber} chưa chọn Đơn vị vận tải (Forwarder). Vui lòng chọn trước khi lưu chi phí.`,
      );
    }

    await this.accountingService.createJournalEntry({
      description: `Logistics Cost Allocation for Shipment ${shipment.shipmentNumber}`,
      referenceType: 'SHIPMENT',
      referenceId: shipment._id,
      items: [
        { accountCode: '632', debit: totalLogisticsVnd.toNumber(), credit: 0 },
        {
          accountCode: '331',
          debit: 0,
          credit: totalLogisticsVnd.toNumber(),
          partnerId: shipment.logisticsPartnerId,
        },
      ],
    });
  }

  async tracking(number: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: [
        { shipmentNumber: ILike(`%${number}%`) },
        { blNumber: ILike(`%${number}%`) },
        { bookingNumber: ILike(`%${number}%`) },
      ],
      relations: [
        'salesContract',
        'salesContract.buyer',
        'logisticsPartner',
        'containers',
      ],
    });
    if (!shipment)
      throw new NotFoundException('Không tìm thấy thông tin vận đơn này.');
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
}
