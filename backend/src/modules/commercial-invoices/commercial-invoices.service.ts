import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { INCOTERM_CONFIG, IncotermCategory } from '@/helpers/incoterm.util';
import { AccountingService } from '@/modules/accounting/accounting.service';
import { AccountReceivablesService } from '@/modules/account-receivables/account-receivables.service';
import {
  CommercialInvoice,
  CommercialInvoiceAuditAction,
  CommercialInvoiceAuditEvent,
  CommercialInvoiceStatus,
} from './entities/commercial-invoice.entity';
import { CommercialInvoiceItem } from './entities/commercial-invoice-item.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { SalesContractStatus } from '@/modules/sales-contracts/entities/sales-contract.entity';
import {
  DocumentChecklistStatus,
  DocumentType,
  ExportDocument,
  ExportDocumentAuditAction,
} from '@/modules/export-documents/entities/export-document.entity';
import {
  CancelCommercialInvoiceDto,
  CreateCommercialInvoiceFromShipmentDto,
  IssueCommercialInvoiceDto,
} from './dto/create-commercial-invoice.dto';

type Actor = { username?: string };

type CommercialInvoiceSnapshotItem = {
  sku: string | null;
  productName: string;
  hsCode: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  netWeight: number | null;
  grossWeight: number | null;
  cbm: number | null;
};

type CommercialInvoiceSnapshot = {
  invoice_id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  shipment_id: string;
  shipmentNumber: string;
  salesContract_id: string;
  contractNumber: string;
  buyer_id: string;
  buyerName: string | null;
  buyerAddress: string | null;
  currency: string;
  exchangeRate: number;
  subtotalForeign: number;
  taxRatePercent: number;
  taxAmountForeign: number;
  totalAmount: number;
  totalAmountVnd: number;
  accountReceivable_id?: string | null;
  incoterm: string | null;
  paymentTerms: string | null;
  pol: string | null;
  pod: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  blNumber: string | null;
  containers: Array<Record<string, unknown>>;
  items: CommercialInvoiceSnapshotItem[];
};

const SOURCE_DOCUMENT_TYPE = 'COMMERCIAL_INVOICE';
const CONTRACT_STATUSES_ALLOWED_FOR_CI = [
  SalesContractStatus.CONFIRMED,
  SalesContractStatus.SHIPPED,
  SalesContractStatus.PAID,
];

@Injectable()
export class CommercialInvoicesService {
  constructor(
    @InjectRepository(CommercialInvoice)
    private readonly invoiceRepository: Repository<CommercialInvoice>,
    @InjectRepository(CommercialInvoiceItem)
    private readonly invoiceItemRepository: Repository<CommercialInvoiceItem>,
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(ExportDocument)
    private readonly exportDocumentRepository: Repository<ExportDocument>,
    private readonly dataSource: DataSource,
    private readonly accountingService: AccountingService,
    private readonly accountReceivablesService: AccountReceivablesService,
  ) {}

  private getActorUsername(user?: Actor | null) {
    return user?.username || 'system';
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private appendAuditEvent(
    invoice: CommercialInvoice,
    action: CommercialInvoiceAuditAction,
    username: string,
    extra: Partial<
      Omit<CommercialInvoiceAuditEvent, 'action' | 'username' | 'at'>
    > = {},
  ) {
    invoice.auditTrail = [
      ...(Array.isArray(invoice.auditTrail) ? invoice.auditTrail : []),
      {
        action,
        username: username || 'system',
        at: new Date().toISOString(),
        ...extra,
      },
    ];
  }

  private parseDueDate(
    invoiceDate: Date,
    paymentTerms?: string | null,
    fallback?: string | Date | null,
  ) {
    if (fallback) return new Date(fallback);

    const match = String(paymentTerms || '').match(/(?:net\s*)?(\d{1,3})/i);
    const days = match ? Number(match[1]) : 30;
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private async generateInvoiceNumber(
    shipment: Shipment,
    manager: EntityManager,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix =
        createOpaqueCode('ci_no').split('_').pop()?.toUpperCase() ||
        Date.now().toString(36).toUpperCase();
      const invoiceNumber = `CI-${shipment.shipmentNumber}-${suffix}`;
      const existing = await manager.findOne(CommercialInvoice, {
        where: { invoiceNumber },
      });
      if (!existing) return invoiceNumber;
    }

    throw new BadRequestException(
      'Cannot generate a unique Commercial Invoice number',
    );
  }

  private async loadShipment(shipment_id: string, manager?: EntityManager) {
    const repository = manager
      ? manager.getRepository(Shipment)
      : this.shipmentRepository;
    const shipment = await repository.findOne({
      where: { _id: shipment_id },
      relations: [
        'salesContract',
        'salesContract.buyer',
        'salesContract.items',
        'salesContract.items.product',
        'containers',
      ],
    });

    if (!shipment?.salesContract) {
      throw new NotFoundException(
        'Shipment or linked sales contract was not found',
      );
    }

    if (
      !CONTRACT_STATUSES_ALLOWED_FOR_CI.includes(shipment.salesContract.status)
    ) {
      throw new BadRequestException(
        'Sales contract must be confirmed before creating Commercial Invoice',
      );
    }

    return shipment;
  }

  private buildInvoiceItemDrafts(shipment: Shipment) {
    const contract = shipment.salesContract;
    return (contract.items || []).map((item) => {
      const product = item.product || null;
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineAmount = new Decimal(quantity)
        .mul(unitPrice)
        .toDecimalPlaces(2)
        .toNumber();
      const piecesPerCarton = Number(product?.piecesPerCarton || 0);
      const cartons =
        piecesPerCarton > 0
          ? new Decimal(quantity).div(piecesPerCarton)
          : new Decimal(0);
      const netWeight =
        cartons.greaterThan(0) && product?.netWeightPerCarton
          ? cartons
              .mul(Number(product.netWeightPerCarton))
              .toDecimalPlaces(4)
              .toNumber()
          : null;
      const grossWeight =
        cartons.greaterThan(0) && product?.grossWeightPerCarton
          ? cartons
              .mul(Number(product.grossWeightPerCarton))
              .toDecimalPlaces(4)
              .toNumber()
          : null;
      const cbm =
        cartons.greaterThan(0) && product?.cbmPerCarton
          ? cartons
              .mul(Number(product.cbmPerCarton))
              .toDecimalPlaces(4)
              .toNumber()
          : null;

      return {
        salesContractItem_id: item._id,
        product_id: item.productId || null,
        sku: product?.sku || null,
        description:
          product?.englishName ||
          product?.vietnameseName ||
          product?.sku ||
          item.productId,
        hsCode: product?.hsCode || null,
        quantity,
        unit: product?.unitOfMeasure || 'PCS',
        unitPriceForeign: unitPrice,
        lineAmountForeign: lineAmount,
        netWeight,
        grossWeight,
        cbm,
      };
    });
  }

  private buildSourceSnapshot(
    invoice: CommercialInvoice,
    shipment: Shipment,
  ): CommercialInvoiceSnapshot {
    const contract = shipment.salesContract;
    const buyer = contract.buyer || null;
    const items = (invoice.items || []).map((item) => ({
      sku: item.sku || null,
      productName: item.description,
      hsCode: item.hsCode || null,
      quantity: Number(item.quantity || 0),
      unit: item.unit || 'PCS',
      unitPrice: Number(item.unitPriceForeign || 0),
      totalPrice: Number(item.lineAmountForeign || 0),
      netWeight: item.netWeight ?? null,
      grossWeight: item.grossWeight ?? null,
      cbm: item.cbm ?? null,
    }));

    return {
      invoice_id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: this.toDateOnly(new Date(invoice.invoiceDate)),
      dueDate: invoice.dueDate
        ? this.toDateOnly(new Date(invoice.dueDate))
        : null,
      shipment_id: shipment._id,
      shipmentNumber: shipment.shipmentNumber,
      salesContract_id: contract._id,
      contractNumber: contract.contractNumber,
      buyer_id: invoice.buyer_id,
      buyerName: buyer?.name || null,
      buyerAddress: buyer?.address || null,
      currency: invoice.currency,
      exchangeRate: Number(invoice.exchangeRate || 1),
      subtotalForeign: Number(invoice.subtotalForeign || 0),
      taxRatePercent: Number(invoice.taxRatePercent || 0),
      taxAmountForeign: Number(invoice.taxAmountForeign || 0),
      totalAmount: Number(invoice.totalAmountForeign || 0),
      totalAmountVnd: Number(invoice.totalAmountVnd || 0),
      incoterm: invoice.incoterm || null,
      paymentTerms: invoice.paymentTerms || null,
      pol: shipment.pol || null,
      pod: shipment.pod || null,
      vesselName: shipment.vesselName || null,
      voyageNumber: shipment.voyageNumber || null,
      blNumber: shipment.blNumber || null,
      containers: (shipment.containers || []).map((container) => ({
        containerNumber: container.containerNumber || null,
        sealNumber: container.sealNumber || null,
        type: container.type,
        weightKg: Number(container.weightKg || 0),
        cbm: Number(container.cbm || 0),
      })),
      items,
    };
  }

  private async markPreviousCommercialInvoiceDocsHistorical(
    shipment_id: string,
    manager: EntityManager,
  ) {
    await manager.update(
      ExportDocument,
      {
        shipmentId: shipment_id,
        documentType: DocumentType.COMMERCIAL_INVOICE,
        isCurrentVersion: true,
      },
      { isCurrentVersion: false },
    );
  }

  private async createExportDocumentFromInvoice(
    invoice: CommercialInvoice,
    snapshot: CommercialInvoiceSnapshot,
    username: string,
    manager: EntityManager,
  ) {
    await this.markPreviousCommercialInvoiceDocsHistorical(
      invoice.shipment_id,
      manager,
    );
    const existingCount = await manager.count(ExportDocument, {
      where: {
        shipmentId: invoice.shipment_id,
        documentType: DocumentType.COMMERCIAL_INVOICE,
      },
    });
    const versionNo = existingCount + 1;
    const doc = manager.create(ExportDocument, {
      shipmentId: invoice.shipment_id,
      documentType: DocumentType.COMMERCIAL_INVOICE,
      documentNumber: invoice.invoiceNumber,
      versionNo,
      isCurrentVersion: true,
      checklistStatus: DocumentChecklistStatus.GENERATED,
      snapshotData: snapshot,
      businessData: {
        sourceDocumentType: SOURCE_DOCUMENT_TYPE,
        sourceDocument_id: invoice._id,
        salesContract_id: invoice.salesContract_id,
        accountReceivable_id: invoice.accountReceivable_id,
      },
      sourceDocumentType: SOURCE_DOCUMENT_TYPE,
      sourceDocument_id: invoice._id,
      auditTrail: [
        {
          action: ExportDocumentAuditAction.VERSION_CREATED,
          username,
          at: new Date().toISOString(),
          versionNo,
          checklistStatus: DocumentChecklistStatus.GENERATED,
          note: 'Generated from issued Commercial Invoice',
        },
        {
          action: ExportDocumentAuditAction.GENERATED,
          username,
          at: new Date().toISOString(),
          versionNo,
          checklistStatus: DocumentChecklistStatus.GENERATED,
          note: 'Commercial Invoice PDF artifact source snapshot is locked',
        },
      ],
      isGenerated: false,
      fileName:
        `${DocumentType.COMMERCIAL_INVOICE}_${invoice.invoiceNumber}_v${versionNo}.pdf`.replace(
          /[^a-zA-Z0-9_.-]/g,
          '_',
        ),
      fileUrl: '',
      issueDate: new Date(invoice.invoiceDate),
    });

    return manager.save(doc);
  }

  private buildRevenueJournalItems(invoice: CommercialInvoice) {
    const incotermConfig = invoice.incoterm
      ? INCOTERM_CONFIG[invoice.incoterm as keyof typeof INCOTERM_CONFIG]
      : null;
    const isSellerLed =
      incotermConfig?.category === IncotermCategory.SELLER_PAYS_FREIGHT;
    const revenueAccount = isSellerLed ? '3387' : '511';
    const amountVnd = Number(invoice.totalAmountVnd || 0);
    if (amountVnd <= 0) {
      throw new BadRequestException(
        'Commercial Invoice total must be greater than zero before issuing',
      );
    }

    return [
      {
        accountCode: '131',
        debit: amountVnd,
        credit: 0,
        partnerId: invoice.buyer_id,
      },
      { accountCode: revenueAccount, debit: 0, credit: amountVnd },
    ];
  }

  async findAll(query: Record<string, string | undefined> = {}) {
    const current = Number(query.current || 1);
    const pageSize = Number(query.pageSize || 20);
    const skip = (current - 1) * pageSize;

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.buyer', 'buyer')
      .leftJoinAndSelect('invoice.salesContract', 'salesContract')
      .leftJoinAndSelect('invoice.shipment', 'shipment')
      .leftJoinAndSelect('invoice.exportDocument', 'exportDocument')
      .orderBy('invoice.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (query.status)
      qb.andWhere('invoice.status = :status', { status: query.status });
    if (query.shipment_id)
      qb.andWhere('invoice.shipment_id = :shipment_id', {
        shipment_id: query.shipment_id,
      });
    if (query.salesContract_id) {
      qb.andWhere('invoice.salesContract_id = :salesContract_id', {
        salesContract_id: query.salesContract_id,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(invoice.invoiceNumber ILIKE :search OR salesContract.contractNumber ILIKE :search OR buyer.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

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

  async findOne(recordId: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { _id: recordId },
      relations: [
        'buyer',
        'salesContract',
        'shipment',
        'shipment.containers',
        'items',
        'items.product',
        'exportDocument',
      ],
      order: { items: { _id: 'ASC' } },
    });
    if (!invoice) throw new NotFoundException('Commercial Invoice not found');
    return invoice;
  }

  async createFromShipment(
    shipment_id: string,
    dto: CreateCommercialInvoiceFromShipmentDto,
    user?: Actor,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const shipment = await this.loadShipment(shipment_id, manager);
      const activeInvoice = await manager.findOne(CommercialInvoice, {
        where: [
          { shipment_id, status: CommercialInvoiceStatus.DRAFT },
          { shipment_id, status: CommercialInvoiceStatus.ISSUED },
        ],
        lock: { mode: 'pessimistic_write' },
      });
      if (activeInvoice) {
        throw new BadRequestException(
          'Shipment already has an active Commercial Invoice',
        );
      }

      const invoiceDate = dto.invoiceDate
        ? new Date(dto.invoiceDate)
        : new Date();
      const dueDate = this.parseDueDate(
        invoiceDate,
        shipment.salesContract.paymentTerms,
        dto.dueDate,
      );
      const itemDrafts = this.buildInvoiceItemDrafts(shipment);
      const subtotal = itemDrafts.reduce(
        (sum, item) => sum.plus(item.lineAmountForeign),
        new Decimal(0),
      );
      const taxRate = new Decimal(dto.taxRatePercent || 0);
      const taxAmount = subtotal.mul(taxRate).div(100).toDecimalPlaces(2);
      const total = subtotal.plus(taxAmount).toDecimalPlaces(2);
      const exchangeRate = new Decimal(
        shipment.salesContract.exchangeRate || 1,
      );
      const username = this.getActorUsername(user);

      const invoice = manager.create(CommercialInvoice, {
        invoiceNumber: await this.generateInvoiceNumber(shipment, manager),
        salesContract_id: shipment.salesContract._id,
        shipment_id: shipment._id,
        buyer_id: shipment.salesContract.buyerId,
        accountReceivable_id: null,
        exportDocument_id: null,
        invoiceDate,
        dueDate,
        currency: shipment.salesContract.currencyCode || 'USD',
        exchangeRate: exchangeRate.toNumber(),
        subtotalForeign: subtotal.toDecimalPlaces(2).toNumber(),
        taxRatePercent: taxRate.toDecimalPlaces(4).toNumber(),
        taxAmountForeign: taxAmount.toNumber(),
        totalAmountForeign: total.toNumber(),
        totalAmountVnd: total.mul(exchangeRate).toDecimalPlaces(2).toNumber(),
        incoterm: shipment.salesContract.incoterm,
        paymentTerms: shipment.salesContract.paymentTerms || null,
        status: CommercialInvoiceStatus.DRAFT,
        sourceSnapshot: null,
        auditTrail: [],
        createdByUsername: username,
        issuedByUsername: null,
        issuedAt: null,
        cancelledByUsername: null,
        cancelledAt: null,
        cancellationReason: null,
        note: dto.note || null,
      });
      this.appendAuditEvent(
        invoice,
        CommercialInvoiceAuditAction.CREATED,
        username,
        {
          referenceType: 'SHIPMENT',
          reference_id: shipment._id,
        },
      );

      const savedInvoice = await manager.save(invoice);
      const items = itemDrafts.map((item) =>
        manager.create(CommercialInvoiceItem, {
          ...item,
          commercialInvoice_id: savedInvoice._id,
        }),
      );
      savedInvoice.items = await manager.save(items);
      savedInvoice.shipment = shipment;
      savedInvoice.salesContract = shipment.salesContract;
      savedInvoice.buyer = shipment.salesContract.buyer;
      savedInvoice.sourceSnapshot = this.buildSourceSnapshot(
        savedInvoice,
        shipment,
      );

      return manager.save(savedInvoice);
    });
  }

  async issue(recordId: string, dto: IssueCommercialInvoiceDto, user?: Actor) {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(CommercialInvoice, {
        where: { _id: recordId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Commercial Invoice not found');
      if (invoice.status !== CommercialInvoiceStatus.DRAFT) {
        throw new BadRequestException(
          'Only draft Commercial Invoice can be issued',
        );
      }

      const shipment = await this.loadShipment(invoice.shipment_id, manager);
      invoice.items = await manager.find(CommercialInvoiceItem, {
        where: { commercialInvoice_id: invoice._id },
        order: { _id: 'ASC' },
      });
      if (!invoice.items.length) {
        throw new BadRequestException(
          'Commercial Invoice must have at least one line',
        );
      }

      if (dto.invoiceDate) invoice.invoiceDate = new Date(dto.invoiceDate);
      if (dto.dueDate) invoice.dueDate = new Date(dto.dueDate);
      if (dto.note !== undefined) invoice.note = dto.note || null;

      const username = this.getActorUsername(user);
      const snapshot = this.buildSourceSnapshot(invoice, shipment);
      invoice.sourceSnapshot = snapshot;

      const revenueJournal = await this.accountingService.createJournalEntry(
        {
          description: `Revenue recognition from Commercial Invoice ${invoice.invoiceNumber}`,
          entryDate: new Date(invoice.invoiceDate),
          referenceType: SOURCE_DOCUMENT_TYPE,
          referenceId: invoice._id,
          createdByUsername: username,
          items: this.buildRevenueJournalItems(invoice),
        },
        manager,
      );

      const receivable =
        await this.accountReceivablesService.createFromCommercialInvoice(
          invoice,
          revenueJournal._id,
          manager,
          username,
        );

      invoice.accountReceivable_id = receivable._id;
      invoice.sourceSnapshot = {
        ...snapshot,
        accountReceivable_id: receivable._id,
      };
      this.appendAuditEvent(
        invoice,
        CommercialInvoiceAuditAction.ACCOUNT_RECEIVABLE_CREATED,
        username,
        {
          referenceType: 'ACCOUNT_RECEIVABLE',
          reference_id: receivable._id,
        },
      );

      const exportDocument = await this.createExportDocumentFromInvoice(
        invoice,
        invoice.sourceSnapshot as CommercialInvoiceSnapshot,
        username,
        manager,
      );

      invoice.exportDocument_id = exportDocument._id;
      invoice.status = CommercialInvoiceStatus.ISSUED;
      invoice.issuedByUsername = username;
      invoice.issuedAt = new Date();
      this.appendAuditEvent(
        invoice,
        CommercialInvoiceAuditAction.EXPORT_DOCUMENT_CREATED,
        username,
        {
          referenceType: 'EXPORT_DOCUMENT',
          reference_id: exportDocument._id,
        },
      );
      this.appendAuditEvent(
        invoice,
        CommercialInvoiceAuditAction.ISSUED,
        username,
        {
          referenceType: 'JOURNAL_ENTRY',
          reference_id: revenueJournal._id,
        },
      );

      const saved = await manager.save(invoice);
      return manager.findOne(CommercialInvoice, {
        where: { _id: saved._id },
        relations: [
          'buyer',
          'salesContract',
          'shipment',
          'items',
          'exportDocument',
        ],
      });
    });
  }

  async cancel(
    recordId: string,
    dto: CancelCommercialInvoiceDto,
    user?: Actor,
  ) {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException('Cancellation reason is required');
    }

    const invoice = await this.invoiceRepository.findOne({
      where: { _id: recordId },
    });
    if (!invoice) throw new NotFoundException('Commercial Invoice not found');
    if (invoice.status !== CommercialInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft Commercial Invoice can be cancelled',
      );
    }

    const username = this.getActorUsername(user);
    invoice.status = CommercialInvoiceStatus.CANCELLED;
    invoice.cancelledByUsername = username;
    invoice.cancelledAt = new Date();
    invoice.cancellationReason = reason;
    this.appendAuditEvent(
      invoice,
      CommercialInvoiceAuditAction.CANCELLED,
      username,
      {
        note: reason,
      },
    );

    return this.invoiceRepository.save(invoice);
  }
}
