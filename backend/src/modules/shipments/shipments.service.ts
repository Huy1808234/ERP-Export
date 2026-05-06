import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { Container } from './entities/container.entity';
import { ShipmentDocument, DocumentType } from './entities/shipment-document.entity';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import { CreateShipmentDto } from '@/modules/shipments/dto/create-shipment.dto';
import { UpdateShipmentDto } from '@/modules/shipments/dto/update-shipment.dto';
import { User } from '@/modules/users/entities/user.entity';
import { SalesContractsService } from '../sales-contracts/sales-contracts.service';
import { AccountingService } from '../accounting/accounting.service';
import { LogisticsAllocationService } from './logistics-allocation.service';
import Decimal from 'decimal.js';

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
  ) {}

  async create(createShipmentDto: any, user: User) {
    const { containers, proformaInvoiceId, ...shipmentData } = createShipmentDto;
    let { salesContractId } = shipmentData;

    // Logic: If creating from PI, find the linked Sales Contract
    if (!salesContractId && proformaInvoiceId) {
      const pi = await this.piRepository.findOne({ 
        where: { id: proformaInvoiceId },
        relations: ['salesContract']
      });
      if (!pi) throw new NotFoundException('Proforma Invoice not found');
      if (!pi.salesContractId) {
        throw new Error('PI này chưa được chuyển đổi thành Hợp đồng (Sales Contract). Vui lòng duyệt hợp đồng trước khi lên lô.');
      }
      salesContractId = pi.salesContractId;
    }

    if (!salesContractId) {
      throw new BadRequestException('Vui lòng cung cấp Sales Contract ID hoặc Proforma Invoice ID hợp lệ.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const shipmentNumber = `SHP-${dateStr}-${randomStr}`;

      const contract = await queryRunner.manager.findOne('SalesContract', { where: { id: salesContractId } }) as any;
      
      const shipment = this.shipmentRepository.create({
        ...shipmentData,
        salesContractId,
        shipmentNumber,
        createdById: user.id,
        status: ShipmentStatus.BOOKED,
        // TECH LEAD INHERIT: Copy logistics info from contract if not provided
        logisticsPartnerId: shipmentData.logisticsPartnerId || contract?.logisticsPartnerId,
        bookingNumber: shipmentData.bookingNumber || contract?.bookingNumber,
      });

      const savedShipment = await queryRunner.manager.save(shipment) as unknown as Shipment;

      if (containers && containers.length > 0) {
        const containerEntities = containers.map(c => this.containerRepository.create({
          ...c,
          shipmentId: savedShipment.id,
        }));
        await queryRunner.manager.save(containerEntities);
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedShipment.id);
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

    const { current: _c, pageSize: _p, sort: _s, populate: _pop, search: _search, ...filters } = query;
    ['current', 'pageSize', 'sort', 'populate', 'search'].forEach(key => delete filters[key]);

    // Enhanced search logic
    const where: any = { ...filters };
    if (query.search) {
      where.shipmentNumber = ILike(`%${query.search}%`);
    }

    const [results, total] = await this.shipmentRepository.findAndCount({
      where,
      relations: ['salesContract', 'salesContract.buyer', 'salesContract.proformaInvoice', 'logisticsPartner', 'createdBy'],
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
    const inTransit = await this.shipmentRepository.countBy({ status: ShipmentStatus.ON_BOARD });
    const closed = await this.shipmentRepository.countBy({ status: ShipmentStatus.CLOSED });

    return {
      total,
      inTransit,
      closed,
    };
  }

  async findOne(id: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { id },
      relations: ['salesContract', 'salesContract.buyer', 'salesContract.items', 'salesContract.items.product', 'salesContract.proformaInvoice', 'createdBy', 'containers', 'logisticsPartner'],
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  async update(id: string, updateShipmentDto: UpdateShipmentDto) {
    const shipment = await this.findOne(id);
    const updated = await this.shipmentRepository.save({ ...shipment, ...updateShipmentDto });
    
    // Nếu lô hàng đã lên tàu (ON_BOARD), việc cập nhật chi phí sẽ kích hoạt tính toán lại công nợ
    if (updated.status === ShipmentStatus.ON_BOARD) {
      const costFields = ['freightCost', 'insuranceCost', 'localChargesVnd', 'truckingCostVnd', 'customsFeeVnd'];
      const hasCostUpdate = Object.keys(updateShipmentDto).some(key => costFields.includes(key));
      
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
      throw new BadRequestException('Không tìm thấy thông tin sản phẩm trong hợp đồng để xuất kho.');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Process each item in the sales contract
      for (const item of shipment.salesContract.items) {
        // First: Release the reservation made during Contract Confirm
        await this.inventoryService.releaseStock(item.productId, item.quantity, shipment.salesContractId, manager);

        // Second: Execute physical stock deduction
        await this.inventoryService.executeInventoryTransaction(
          item.productId,
          -Math.abs(item.quantity), 
          InventoryTransactionType.SALES,
          shipment.id,
          item.unitPrice,
          `Xuất kho cho lô hàng ${shipment.shipmentNumber}`,
          manager,
          undefined, 
          shipment.salesContract.buyerId,
          shipment.shipmentNumber,
          user.email
        );
      }

      // 2. Update shipment status to LOADING (Hàng đang đóng/rời kho)
      shipment.isStockIssued = true;
      shipment.stockIssuedAt = new Date();
      shipment.status = ShipmentStatus.LOADING; 
      
      await manager.save(shipment);

      return shipment;
    });
  }

  async updateStatus(id: string, status: ShipmentStatus) {
    const shipment = await this.findOne(id);
    shipment.status = status;
    
    if (status === ShipmentStatus.ON_BOARD) {
      // TECH LEAD FIX: Khi hàng lên tàu, kích hoạt hạch toán doanh thu và trừ kho thực tế tại Sales Contract
      await this.salesContractService.shipContract(shipment.salesContractId);
      
      // Tự động phân bổ chi phí logistics
      await this.allocateLogisticsCosts(id);
      await this.eventEmitter.emitAsync('shipment.on_board', { shipment });
    }

    return await this.shipmentRepository.save(shipment);
  }

  async addDocument(shipmentId: string, data: Partial<ShipmentDocument>) {
    const doc = this.docRepository.create({ ...data, shipmentId });
    return this.docRepository.save(doc);
  }

  async getDocuments(shipmentId: string) {
    return this.docRepository.find({ where: { shipmentId }, order: { documentType: 'ASC' } });
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
      items: sc.items.map(item => ({
        description: item.product.englishName || item.product.vietnameseName,
        hsCode: item.product.hsCode,
        quantity: item.quantity,
        unit: item.product.unitOfMeasure,
        price: item.unitPrice,
        amount: Number(item.quantity) * Number(item.unitPrice),
        netWeight: Number(item.quantity) * Number(item.product.netWeightPerCarton || 0),
        grossWeight: Number(item.quantity) * Number(item.product.grossWeightPerCarton || 0),
        cbm: Number(item.quantity) * Number(item.product.cbmPerCarton || 0),
      })),
      totalAmount: sc.totalAmount,
      currency: sc.currencyCode
    };
  }

  async allocateLogisticsCosts(id: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { id },
      relations: ['salesContract', 'salesContract.items', 'salesContract.items.product'],
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    // Clean up old logistics journal entries for this shipment to avoid duplicates
    await this.accountingService.deleteJournalEntriesByReference('SHIPMENT', shipment.id, `Logistics Cost Allocation`);

    await this.logisticsAllocationService.allocateCosts(id);

    const exRate = new Decimal(shipment.salesContract?.exchangeRate || 25000);
    const totalFreightVnd = new Decimal(shipment.freightCost || 0).plus(shipment.insuranceCost || 0).times(exRate);
    const totalLocalVnd = new Decimal(shipment.localChargesVnd || 0)
      .plus(shipment.truckingCostVnd || 0)
      .plus(shipment.customsFeeVnd || 0);
    
    const totalLogisticsVnd = totalFreightVnd.plus(totalLocalVnd);
    if (totalLogisticsVnd.isZero()) return;

    // TECH LEAD FIX: Ensure partner exists to avoid "floating" journal entries with null partnerId
    if (!shipment.logisticsPartnerId) {
      throw new BadRequestException(`Lô hàng ${shipment.shipmentNumber} chưa chọn Đơn vị vận tải (Forwarder). Vui lòng chọn trước khi lưu chi phí.`);
    }

    await this.accountingService.createJournalEntry({
      description: `Logistics Cost Allocation for Shipment ${shipment.shipmentNumber}`,
      referenceType: 'SHIPMENT',
      referenceId: shipment.id,
      items: [
        { accountCode: '632', debit: totalLogisticsVnd.toNumber(), credit: 0 },
        { accountCode: '331', debit: 0, credit: totalLogisticsVnd.toNumber(), partnerId: shipment.logisticsPartnerId }
      ]
    });
  }
}
