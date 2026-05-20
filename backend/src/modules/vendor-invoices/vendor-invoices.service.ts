import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, EntityManager } from 'typeorm';
import { VendorInvoice, VendorInvoiceStatus } from './entities/vendor-invoice.entity';
import { VendorInvoiceItem } from './entities/vendor-invoice-item.entity';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/entities/purchase-order.entity';
import { AccountPayable, APStatus } from '../account-payables/entities/account-payable.entity';
import { AccountingService } from '../accounting/accounting.service';
import { GoodsReceiptItem } from '../goods-receipts/entities/goods-receipt-item.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';
import type { QueryParams } from '@/common/types/authenticated-user.type';

const MONEY_EPSILON = 0.01;
const QTY_EPSILON = 0.0001;
const INVOICE_ELIGIBLE_PO_STATUSES = [
  PurchaseOrderStatus.PARTIAL_RECEIPT,
  PurchaseOrderStatus.RECEIVED,
];

type PurchaseOrderItemGroups = {
  by_id: Map<string, PurchaseOrderItem>;
  byProductId: Map<string, PurchaseOrderItem[]>;
};

@Injectable()
export class VendorInvoicesService {
  constructor(
    @InjectRepository(VendorInvoice)
    private invoiceRepository: Repository<VendorInvoice>,
    @InjectRepository(VendorInvoiceItem)
    private itemRepository: Repository<VendorInvoiceItem>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    private dataSource: DataSource,
    private accountingService: AccountingService,
  ) {}

  private groupPurchaseOrderItems(poItems: PurchaseOrderItem[]): PurchaseOrderItemGroups {
    const by_id = new Map<string, PurchaseOrderItem>();
    const byProductId = new Map<string, PurchaseOrderItem[]>();

    for (const item of poItems) {
      by_id.set(item._id, item);
      byProductId.set(item.productId, [
        ...(byProductId.get(item.productId) || []),
        item,
      ]);
    }

    return { by_id, byProductId };
  }

  private resolvePurchaseOrderItemForInvoiceLine(
    groups: PurchaseOrderItemGroups,
    productId: string,
    purchaseOrderItem_id?: string | null,
  ) {
    if (purchaseOrderItem_id) {
      const poItem = groups.by_id.get(purchaseOrderItem_id);
      if (!poItem) {
        throw new BadRequestException(`Dong PO ${purchaseOrderItem_id} khong thuoc PO nay`);
      }
      if (poItem.productId !== productId) {
        throw new BadRequestException(`Product tren invoice line khong khop dong PO ${purchaseOrderItem_id}`);
      }
      return poItem;
    }

    const candidates = groups.byProductId.get(productId) || [];
    if (candidates.length === 0) {
      throw new BadRequestException(`San pham ${productId} khong co trong PO`);
    }
    if (candidates.length > 1) {
      throw new BadRequestException(
        `PO co nhieu dong cho san pham ${productId}; can truyen purchaseOrderItem_id de doi chieu invoice dung dong`,
      );
    }
    return candidates[0];
  }

  private resolveLegacyLineKey(
    groups: PurchaseOrderItemGroups,
    productId: string,
    purchaseOrderItem_id?: string | null,
  ) {
    if (purchaseOrderItem_id && groups.by_id.has(purchaseOrderItem_id)) {
      return purchaseOrderItem_id;
    }

    const candidates = groups.byProductId.get(productId) || [];
    return candidates.length === 1 ? candidates[0]._id : null;
  }

  private async findPurchaseOrderForInvoice(
    manager: EntityManager,
    purchaseOrderId: string,
  ): Promise<PurchaseOrder> {
    const po = await manager.findOne(PurchaseOrder, {
      where: { _id: purchaseOrderId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!po) throw new NotFoundException('Khong tim thay PO');

    // PostgreSQL cannot apply FOR UPDATE to the nullable side of a LEFT JOIN.
    // Lock the PO header first, then lock its lines separately in the same transaction.
    po.items = await manager
      .getRepository(PurchaseOrderItem)
      .createQueryBuilder('item')
      .where('item."purchaseOrderId" = :purchaseOrderId', { purchaseOrderId })
      .setLock('pessimistic_write')
      .getMany();

    return po;
  }

  async create(createVendorInvoiceDto: CreateVendorInvoiceDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { items = [], ...invoiceData } = createVendorInvoiceDto;
      const invoiceItemsInput = items
        .map((item) => ({
          productId: item.productId,
          purchaseOrderItem_id: item.purchaseOrderItem_id ?? null,
          goodsReceiptItem_id: item.goodsReceiptItem_id ?? null,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          amount: Number(item.amount || 0),
          note: item.note ?? null,
        }))
        .filter((item) => item.quantity > 0);

      if (invoiceItemsInput.length === 0) {
        throw new BadRequestException('Hoa don phai co it nhat mot dong hang da nhap kho');
      }

      const existing = await queryRunner.manager.findOne(VendorInvoice, {
        where: { invoiceNumber: invoiceData.invoiceNumber, vendorId: invoiceData.vendorId },
      });
      if (existing) {
        throw new BadRequestException('So hoa don nay da ton tai cho nha cung cap nay');
      }

      const po = await this.findPurchaseOrderForInvoice(
        queryRunner.manager,
        invoiceData.purchaseOrderId,
      );
      if (!INVOICE_ELIGIBLE_PO_STATUSES.includes(po.status)) {
        throw new BadRequestException('Chi duoc ghi nhan hoa don cho PO da co phieu nhap kho');
      }
      if (po.vendorId !== invoiceData.vendorId) {
        throw new BadRequestException('Nha cung cap tren hoa don khong khop voi PO');
      }

      const existingInvoices = await queryRunner.manager.find(VendorInvoice, {
        where: {
          purchaseOrderId: invoiceData.purchaseOrderId,
          status: Not(VendorInvoiceStatus.CANCELLED),
        },
      });

      const grItems = await queryRunner.manager
        .getRepository(GoodsReceiptItem)
        .createQueryBuilder('item')
        .leftJoin('item.goodsReceipt', 'gr')
        .where('gr.purchaseOrderId = :purchaseOrderId', { purchaseOrderId: invoiceData.purchaseOrderId })
        .getMany();

      const existingInvoiceItems = await queryRunner.manager
        .getRepository(VendorInvoiceItem)
        .createQueryBuilder('item')
        .leftJoin('item.vendorInvoice', 'inv')
        .where('inv.purchaseOrderId = :purchaseOrderId', { purchaseOrderId: invoiceData.purchaseOrderId })
        .andWhere('inv.status != :status', { status: VendorInvoiceStatus.CANCELLED })
        .getMany();

      const poItemGroups = this.groupPurchaseOrderItems(po.items);
      const receivedQtyByPoLine = new Map<string, number>();
      const invoicedQtyByPoLine = new Map<string, number>();
      const invoicedQtyByGrLine = new Map<string, number>();

      grItems.forEach((item) => {
        const acceptedQty = Number(item.quantityReceived) - Number(item.quantityRejected || 0);
        const lineKey = this.resolveLegacyLineKey(
          poItemGroups,
          item.productId,
          item.purchaseOrderItem_id,
        );
        if (!lineKey) return;

        receivedQtyByPoLine.set(lineKey, (receivedQtyByPoLine.get(lineKey) || 0) + acceptedQty);
      });

      existingInvoiceItems.forEach((item) => {
        const lineKey = this.resolveLegacyLineKey(
          poItemGroups,
          item.productId,
          item.purchaseOrderItem_id,
        );
        if (!lineKey) return;

        invoicedQtyByPoLine.set(
          lineKey,
          (invoicedQtyByPoLine.get(lineKey) || 0) + Number(item.quantity),
        );

        if (item.goodsReceiptItem_id) {
          invoicedQtyByGrLine.set(
            item.goodsReceiptItem_id,
            (invoicedQtyByGrLine.get(item.goodsReceiptItem_id) || 0) + Number(item.quantity),
          );
        }
      });

      let calculatedAmount = 0;
      const newInvoiceQtyByPoLine = new Map<string, number>();
      const newInvoiceQtyByGrLine = new Map<string, number>();

      for (const item of invoiceItemsInput) {
        const poItem = this.resolvePurchaseOrderItemForInvoiceLine(
          poItemGroups,
          item.productId,
          item.purchaseOrderItem_id,
        );

        item.purchaseOrderItem_id = poItem._id;
        const receivedQty = receivedQtyByPoLine.get(poItem._id) || 0;
        const alreadyInvoicedQty = invoicedQtyByPoLine.get(poItem._id) || 0;
        const pendingInvoiceQty = newInvoiceQtyByPoLine.get(poItem._id) || 0;
        const remainingInvoiceQty = receivedQty - alreadyInvoicedQty;

        if (pendingInvoiceQty + item.quantity > remainingInvoiceQty + QTY_EPSILON) {
          throw new BadRequestException(
            `So luong hoa don cua dong PO ${poItem._id} vuot qua so luong hang da nhap kho hop le con lai`,
          );
        }

        if (item.goodsReceiptItem_id) {
          const grLine = grItems.find((line) => line._id === item.goodsReceiptItem_id);
          if (!grLine) throw new BadRequestException(`Dong GRN ${item.goodsReceiptItem_id} khong thuoc PO nay`);

          const grLineKey = this.resolveLegacyLineKey(
            poItemGroups,
            grLine.productId,
            grLine.purchaseOrderItem_id,
          );
          if (grLineKey !== poItem._id) {
            throw new BadRequestException(`Dong GRN ${item.goodsReceiptItem_id} khong khop dong PO invoice`);
          }

          const acceptedOnGrLine = Number(grLine.quantityReceived) - Number(grLine.quantityRejected || 0);
          const alreadyInvoicedOnGrLine = invoicedQtyByGrLine.get(grLine._id) || 0;
          const pendingOnGrLine = newInvoiceQtyByGrLine.get(grLine._id) || 0;
          if (pendingOnGrLine + item.quantity > acceptedOnGrLine - alreadyInvoicedOnGrLine + QTY_EPSILON) {
            throw new BadRequestException(
              `So luong hoa don cua dong GRN ${grLine._id} vuot qua so luong accepted con lai`,
            );
          }
          newInvoiceQtyByGrLine.set(grLine._id, pendingOnGrLine + item.quantity);
        }

        if (Math.abs(item.unitPrice - Number(poItem.unitPrice)) > MONEY_EPSILON) {
          throw new BadRequestException(`Don gia hoa don cua san pham ${item.productId} khong khop voi PO`);
        }

        const expectedLineAmount = item.quantity * item.unitPrice;
        if (Math.abs(item.amount - expectedLineAmount) > MONEY_EPSILON) {
          throw new BadRequestException(`Thanh tien hoa don cua san pham ${item.productId} khong dung`);
        }

        calculatedAmount += expectedLineAmount;
        newInvoiceQtyByPoLine.set(poItem._id, pendingInvoiceQty + item.quantity);
      }

      const taxRate = Number(invoiceData.taxRate ?? 0);
      const calculatedTaxAmount = (calculatedAmount * taxRate) / 100;
      const calculatedTotalAmount = calculatedAmount + calculatedTaxAmount;

      if (Math.abs(Number(invoiceData.amount) - calculatedAmount) > MONEY_EPSILON) {
        throw new BadRequestException('Tong tien truoc thue khong khop voi chi tiet hoa don');
      }
      if (Math.abs(Number(invoiceData.taxAmount || 0) - calculatedTaxAmount) > MONEY_EPSILON) {
        throw new BadRequestException('Tien thue khong khop voi chi tiet hoa don');
      }
      if (Math.abs(Number(invoiceData.totalAmount) - calculatedTotalAmount) > MONEY_EPSILON) {
        throw new BadRequestException('Tong tien hoa don khong khop voi chi tiet hoa don');
      }

      const totalInvoiced = existingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      if (totalInvoiced + calculatedTotalAmount > Number(po.totalAmount) + MONEY_EPSILON) {
        throw new BadRequestException('Tong gia tri hoa don vuot qua gia tri PO');
      }

      const invoice = queryRunner.manager.create(VendorInvoice, {
        ...invoiceData,
        amount: calculatedAmount,
        taxRate,
        taxAmount: calculatedTaxAmount,
        totalAmount: calculatedTotalAmount,
        status: VendorInvoiceStatus.PENDING,
      });

      const savedInvoice = await queryRunner.manager.save(invoice);

      const invoiceItems = invoiceItemsInput.map((item) => queryRunner.manager.create(VendorInvoiceItem, {
        ...item,
        vendorInvoiceId: savedInvoice._id,
      }));
      await queryRunner.manager.save(invoiceItems);

      const invoicedQtyAfterSave = new Map(invoicedQtyByPoLine);
      newInvoiceQtyByPoLine.forEach((quantity, poLine_id) => {
        invoicedQtyAfterSave.set(poLine_id, (invoicedQtyAfterSave.get(poLine_id) || 0) + quantity);
      });

      const allOrderedReceived = po.items.every((item) => (
        (receivedQtyByPoLine.get(item._id) || 0) >= Number(item.quantity) - QTY_EPSILON
      ));
      const allReceivedInvoiced = po.items.every((item) => {
        const receivedQty = receivedQtyByPoLine.get(item._id) || 0;
        const invoicedQty = invoicedQtyAfterSave.get(item._id) || 0;
        return invoicedQty >= receivedQty - QTY_EPSILON;
      });

      po.status = allOrderedReceived && allReceivedInvoiced
        ? PurchaseOrderStatus.COMPLETED
        : allOrderedReceived
          ? PurchaseOrderStatus.RECEIVED
          : PurchaseOrderStatus.PARTIAL_RECEIPT;
      await queryRunner.manager.save(po);

      const ap = queryRunner.manager.create(AccountPayable, {
        vendorId: savedInvoice.vendorId,
        vendorInvoiceId: savedInvoice._id,
        invoiceNumber: savedInvoice.invoiceNumber,
        invoiceSeries: savedInvoice.invoiceSeries,
        amount: savedInvoice.totalAmount,
        currency: createVendorInvoiceDto.currency || 'VND',
        dueDate: savedInvoice.dueDate,
        status: APStatus.UNPAID,
        note: `Hach toan tu hoa don ${savedInvoice.invoiceSeries ? savedInvoice.invoiceSeries + ' / ' : ''}${savedInvoice.invoiceNumber}`,
      });
      await queryRunner.manager.save(ap);

      const journalItems: { accountCode: string; debit: number; credit: number; partnerId?: string }[] = [
        {
          accountCode: '3388',
          debit: Number(savedInvoice.amount),
          credit: 0,
        },
      ];

      if (Number(savedInvoice.taxAmount) > 0) {
        journalItems.push({
          accountCode: '1331',
          debit: Number(savedInvoice.taxAmount),
          credit: 0,
        });
      }

      journalItems.push({
        accountCode: '331',
        debit: 0,
        credit: Number(savedInvoice.totalAmount),
        partnerId: savedInvoice.vendorId,
      });

      await this.accountingService.createJournalEntry({
        description: `Ghi nhan hoa don NCC: ${savedInvoice.invoiceSeries ? savedInvoice.invoiceSeries + ' / ' : ''}${savedInvoice.invoiceNumber} (PO: ${po.poNumber})`,
        referenceType: 'VENDOR_INVOICE',
        referenceId: savedInvoice._id,
        entryDate: savedInvoice.invoiceDate,
        items: journalItems,
      }, queryRunner.manager);

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: QueryParams) {
    const { current = 1, pageSize = 10, ...filters } = query;
    const page = Number(current) || 1;
    const limit = Number(pageSize) || 10;

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.purchaseOrder', 'purchaseOrder')
      .leftJoinAndSelect('invoice.vendor', 'vendor')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product');
    qb.leftJoinAndSelect('items.purchaseOrderItem', 'purchaseOrderItem');
    qb.leftJoinAndSelect('items.goodsReceiptItem', 'goodsReceiptItem');

    if (filters.invoiceNumber) {
      const raw = String(filters.invoiceNumber);
      const value = raw.includes('/') ? raw.replace(/\//g, '').replace(/i$/, '') : raw;
      qb.andWhere('invoice.invoiceNumber ILIKE :invoiceNumber', { invoiceNumber: `%${value}%` });
    }
    if (filters.purchaseOrderId) {
      qb.andWhere('invoice.purchaseOrderId = :purchaseOrderId', { purchaseOrderId: filters.purchaseOrderId });
    }
    if (filters.vendorId) {
      qb.andWhere('invoice.vendorId = :vendorId', { vendorId: filters.vendorId });
    }
    if (filters.status) {
      qb.andWhere('invoice.status = :status', { status: filters.status });
    }

    const [results, total] = await qb
      .orderBy('invoice.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      results,
      meta: {
        current: page,
        pageSize: limit,
        pages: Math.ceil(total / limit),
        total,
      },
    };
  }

  async findOne(invoiceRef: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { _id: invoiceRef },
      relations: ['purchaseOrder', 'vendor', 'items', 'items.product', 'items.purchaseOrderItem', 'items.goodsReceiptItem'],
    });
    if (!invoice) throw new NotFoundException('Vendor Invoice not found');
    return invoice;
  }

  async updateStatus(invoiceRef: string, status: VendorInvoiceStatus) {
    const invoice = await this.findOne(invoiceRef);
    invoice.status = status;
    return this.invoiceRepository.save(invoice);
  }

  /**
   * Tinh toan trang thai doi chieu 3 chieu cho PO.
   */
  async getMatchingStatus(purchaseOrderId: string) {
    const poItems = await this.dataSource.getRepository(PurchaseOrderItem).find({
      where: { purchaseOrderId },
      relations: ['product'],
    });

    const grItems = await this.dataSource.getRepository(GoodsReceiptItem).createQueryBuilder('item')
      .leftJoin('item.goodsReceipt', 'gr')
      .where('gr.purchaseOrderId = :purchaseOrderId', { purchaseOrderId })
      .getMany();

    const invItems = await this.itemRepository.createQueryBuilder('item')
      .leftJoin('item.vendorInvoice', 'inv')
      .where('inv.purchaseOrderId = :purchaseOrderId', { purchaseOrderId })
      .andWhere('inv.status != :status', { status: VendorInvoiceStatus.CANCELLED })
      .getMany();

    const poItemGroups = this.groupPurchaseOrderItems(poItems);

    return poItems.map((poItem) => {
      const receivedQty = grItems
        .filter((gr) => this.resolveLegacyLineKey(poItemGroups, gr.productId, gr.purchaseOrderItem_id) === poItem._id)
        .reduce((sum, gr) => sum + Number(gr.quantityReceived) - Number(gr.quantityRejected || 0), 0);
      const rejectedQty = grItems
        .filter((gr) => this.resolveLegacyLineKey(poItemGroups, gr.productId, gr.purchaseOrderItem_id) === poItem._id)
        .reduce((sum, gr) => sum + Number(gr.quantityRejected || 0), 0);
      const invoicedQty = invItems
        .filter((inv) => this.resolveLegacyLineKey(poItemGroups, inv.productId, inv.purchaseOrderItem_id) === poItem._id)
        .reduce((sum, inv) => sum + Number(inv.quantity), 0);

      return {
        purchaseOrderItem_id: poItem._id,
        productId: poItem.productId,
        productName: poItem.product?.vietnameseName,
        sku: poItem.product?.sku,
        orderedQty: Number(poItem.quantity),
        receivedQty,
        rejectedQty,
        invoicedQty,
        unitPrice: Number(poItem.unitPrice),
        status: this.calculateMatchStatus(Number(poItem.quantity), receivedQty, invoicedQty),
      };
    });
  }

  private calculateMatchStatus(ordered: number, received: number, invoiced: number) {
    if (invoiced > received + QTY_EPSILON) return 'OVER_INVOICED';
    if (received <= QTY_EPSILON && invoiced <= QTY_EPSILON) return 'PENDING';
    if (Math.abs(invoiced - received) <= QTY_EPSILON && invoiced <= ordered + QTY_EPSILON) return 'MATCHED';
    if (invoiced < received) return 'PARTIAL';
    return 'PENDING';
  }
}
