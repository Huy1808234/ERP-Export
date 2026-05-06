import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import type { IUser } from '../users/users.interface';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
} from '../purchase-requests/entities/purchase-request.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { Partner, PartnerType } from '../partners/entities/partner.entity';


@Injectable()
export class PurchaseOrdersService implements OnModuleInit {
  constructor(
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private poItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PurchaseRequest)
    private prRepository: Repository<PurchaseRequest>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    private dataSource: DataSource,
    private currenciesService: CurrenciesService,
  ) {}

  async onModuleInit() {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      // Step 1: Clean up duplicate poNumbers from dev/test sessions (soft-deleted rows included)
      const duplicates = await queryRunner.query(`
        SELECT "poNumber" FROM "purchase_orders" 
        GROUP BY "poNumber" HAVING COUNT(*) > 1
      `);

      for (const dup of duplicates) {
        const records = await queryRunner.query(
          `SELECT id, "deletedAt" FROM "purchase_orders" WHERE "poNumber" = $1 ORDER BY "createdAt" ASC`,
          [dup.poNumber]
        );
        // Keep the first live record, rename all others
        let kept = false;
        for (const rec of records) {
          if (!rec.deletedAt && !kept) { kept = true; continue; }
          const newNum = `${dup.poNumber}-ARCHIVED-${Date.now()}`;
          await queryRunner.query(`UPDATE "purchase_orders" SET "poNumber" = $1 WHERE id = $2`, [newNum, rec.id]);
          console.warn(`[PO] Renamed duplicate: ${dup.poNumber} -> ${newNum}`);
        }
      }

      // Step 2: Drop the old global unique constraint (blocks on soft-deleted rows)
      await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "UQ_2e0fc7a6605393a9bd691cdcebe"`);

      // Step 3: Create a PARTIAL unique index — only enforces uniqueness for non-deleted rows
      // This is the correct production-grade pattern for soft-delete systems.
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UDX_po_number_active" 
        ON "purchase_orders" ("poNumber") 
        WHERE "deletedAt" IS NULL
      `);

      console.log('[PO] Database: Partial unique index on poNumber ensured.');
      await queryRunner.release();
    } catch (error) {
      console.error('[PO] onModuleInit error:', error.message);
    }
  }

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto, user: IUser) {
    const { items, purchaseRequestId, ...poData } = createPurchaseOrderDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock table to serialize concurrent PO creation
      await queryRunner.query('LOCK TABLE "purchase_orders" IN SHARE ROW EXCLUSIVE MODE');

      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

      // Query ALL records for today (including soft-deleted) to get the true max sequence
      const todayPos = await queryRunner.query(
        `SELECT "poNumber" FROM "purchase_orders" WHERE "poNumber" LIKE $1`,
        [`PO-${dateStr}-%`]
      );

      let nextSeq = 1;
      if (todayPos.length > 0) {
        const sequences = todayPos
          .map((po: any) => {
            const match = po.poNumber.match(/-(\d{4})(?:-|$)/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((s: number) => s > 0);

        if (sequences.length > 0) {
          nextSeq = Math.max(...sequences) + 1;
        }
      }

      // Find next free poNumber (accounting for ALL rows including soft-deleted)
      let poNumber = `PO-${dateStr}-${nextSeq.toString().padStart(4, '0')}`;
      while (true) {
        const existing = await queryRunner.query(
          `SELECT id FROM "purchase_orders" WHERE "poNumber" = $1 LIMIT 1`,
          [poNumber]
        );
        if (existing.length === 0) break;
        nextSeq++;
        poNumber = `PO-${dateStr}-${nextSeq.toString().padStart(4, '0')}`;
      }

      console.log('[PO] Creating with number:', poNumber);


      // 2. Calculate Totals
      let subTotal = 0;
      let taxAmount = 0;

      const preparedItems = items.map((item) => {
        const taxRate = item.taxRate ?? 10;
        const lineTotal = item.quantity * item.unitPrice;
        const lineTax = (lineTotal * taxRate) / 100;

        subTotal += lineTotal;
        taxAmount += lineTax;

        return this.poItemRepository.create({
          ...item,
          taxRate,
          totalAmount: lineTotal + lineTax,
        });
      });

      // 3. Create PO
      const po = this.poRepository.create({
        ...poData,
        poNumber,
        purchaseRequestId,
        subTotal,
        taxAmount,
        totalAmount: subTotal + taxAmount,
        createdById: user.id,
        status: PurchaseOrderStatus.DRAFT,
      });

      const savedPo = await queryRunner.manager.save(po);

      // 4. Save Items
      for (const item of preparedItems) {
        item.purchaseOrderId = savedPo.id;
        await queryRunner.manager.save(item);
      }

      // 5. Update PR status
      if (purchaseRequestId) {
        await queryRunner.manager.update(PurchaseRequest, purchaseRequestId, {
          status: PurchaseRequestStatus.COMPLETED,
        });
      }

      await queryRunner.commitTransaction();
      console.log('--- PO CREATED SUCCESSFULLY ---', poNumber);
      return savedPo;
    } catch (err) {
      console.error('--- PO CREATION FAILED ---', err);
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async createFromPR(body: { purchaseRequestId: string; vendorId?: string }, user: IUser) {
    const { purchaseRequestId, vendorId } = body;

    // 1. Get PR with items
    const pr = await this.prRepository.findOne({
      where: { id: purchaseRequestId },
      relations: ['items', 'items.product'],
    });

    if (!pr) throw new NotFoundException('Purchase Request not found');
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException('Purchase Request must be APPROVED to create a PO');
    }

    // 2. Determine Vendor
    let finalVendorId = vendorId;
    if (!finalVendorId) {
      // Fallback: Pick the first active supplier if none provided
      const defaultVendor = await this.partnerRepository.findOne({ 
        where: { partnerType: PartnerType.SUPPLIER, isActive: true } 
      });
      if (!defaultVendor) throw new BadRequestException('No vendor found to assign to PO. Please specify a vendorId.');
      finalVendorId = defaultVendor.id;
    }

    // 3. Map PR items to PO items DTO
    const poItems = pr.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.estimatedPrice || 0,
      unit: item.unit,
      taxRate: 10, // Default VAT
    }));

    // 4. Reuse the existing create logic
    return this.create({
      purchaseRequestId,
      vendorId: finalVendorId,
      orderDate: new Date().toISOString(),
      items: poItems,
      currency: 'VND',
    } as CreatePurchaseOrderDto, user);
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (currentPage - 1) * limit;
    const defaultLimit = limit ? limit : 10;

    const relations =
      population && Array.isArray(population)
        ? population.map((p) => p.path)
        : ['items', 'items.product', 'vendor', 'createdBy', 'purchaseRequest'];

    // Xử lý lọc nhiều trạng thái (comma-separated)
    if (filter.status && typeof filter.status === 'string' && filter.status.includes(',')) {
      const { In } = require('typeorm');
      filter.status = In(filter.status.split(','));
    }

    const [result, total] = await this.poRepository.findAndCount({
      where: filter,
      relations,
      order: (sort as any) || { createdAt: 'DESC' },
      take: defaultLimit,
      skip: offset,
    });

    const results = result.map((po) => {
      if (Number(po.totalAmount) === 0 && po.items) {
        const calculatedTotal = po.items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
        return { ...po, totalAmount: calculatedTotal };
      }
      return po;
    });

    return {
      meta: {
        current: currentPage,
        pageSize: limit,
        pages: Math.ceil(total / defaultLimit),
        total: total,
      },
      results: results,
    };
  }

  async findOne(id: string) {
    const po = await this.poRepository.findOne({
      where: { id },
      relations: [
        'items',
        'items.product',
        'vendor',
        'createdBy',
        'purchaseRequest',
      ],
    });
    if (!po) throw new NotFoundException('Purchase Order not found');
    return po;
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    const po = await this.findOne(id);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT POs can be updated');
    }
    return this.poRepository.save({ ...po, ...updatePurchaseOrderDto });
  }

  async send(id: string) {
    const po = await this.findOne(id);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('PO must be in DRAFT status to be sent');
    }
    po.status = PurchaseOrderStatus.SENT;
    return this.poRepository.save(po);
  }

  async softDelete(id: string) {
    // Kiểm tra các chứng từ liên quan trước khi cho phép xóa mềm
    const grCount = await this.dataSource.getRepository('goods_receipts').count({ where: { purchaseOrderId: id } });
    if (grCount > 0) {
      throw new BadRequestException('Không thể xóa đơn đặt hàng đã có phiếu nhập kho (GRN). Vui lòng kiểm tra lại.');
    }

    const invCount = await this.dataSource.getRepository('vendor_invoices').count({ where: { purchaseOrderId: id } });
    if (invCount > 0) {
      throw new BadRequestException('Không thể xóa đơn đặt hàng đã có hóa đơn nhà cung cấp. Vui lòng kiểm tra lại.');
    }

    return this.poRepository.softDelete(id);
  }

  async getMatchingData(id: string) {
    const po = await this.poRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'vendor'],
    });

    if (!po) throw new NotFoundException('Purchase Order not found');

    const grns = await this.dataSource.getRepository('GoodsReceipt').find({
      where: { purchaseOrderId: id },
      relations: ['items', 'items.product'],
    });

    const invoices = await this.dataSource.getRepository('VendorInvoice').find({
      where: { purchaseOrderId: id },
    });

    const receivedMap = new Map<string, number>();
    grns.forEach(gr => {
      gr.items.forEach(item => {
        const current = receivedMap.get(item.productId) || 0;
        receivedMap.set(item.productId, current + Number(item.quantityReceived));
      });
    });

    const matchingLines = po.items.map((poItem) => {
      const receivedQty = receivedMap.get(poItem.productId) || 0;

      return {
        productId: poItem.productId,
        productName: poItem.product?.vietnameseName,
        sku: poItem.product?.sku,
        orderedQty: Number(poItem.quantity),
        receivedQty,
        unitPrice: Number(poItem.unitPrice),
        poLineTotal: Number(poItem.totalAmount),
        varianceQty: Number(poItem.quantity) - receivedQty,
      };
    });

    const totalInvoicedAmount = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount), 0);

    return {
      poNumber: po.poNumber,
      status: po.status,
      vendor: po.vendor,
      totalPoAmount: Number(po.totalAmount),
      totalInvoicedAmount,
      varianceAmount: Number(po.totalAmount) - totalInvoicedAmount,
      lines: matchingLines,
      documents: {
        grns: grns.map(g => ({ id: g.id, number: g.grNumber, date: g.receivedDate })),
        invoices: invoices.map(i => ({ id: i.id, number: i.invoiceNumber, date: i.invoiceDate, amount: i.totalAmount }))
      }
    };
  }

  async getStats() {
    const total = await this.poRepository.count();
    
    const pending = await this.poRepository.count({
      where: [
        { status: PurchaseOrderStatus.DRAFT },
        { status: PurchaseOrderStatus.SENT },
        { status: PurchaseOrderStatus.PARTIAL_RECEIPT }
      ]
    });

    const pos = await this.poRepository.find({ select: ['totalAmount', 'currency'] });
    let totalVndValue = 0;
    for (const po of pos) {
      const vndAmount = await this.currenciesService.convertToBase(Number(po.totalAmount), po.currency);
      totalVndValue += vndAmount;
    }
    
    return {
      total,
      pending,
      value: totalVndValue
    };
  }
}
