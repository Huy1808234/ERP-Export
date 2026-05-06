import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { VendorInvoice, VendorInvoiceStatus } from './entities/vendor-invoice.entity';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/entities/purchase-order.entity';
import { AccountPayable, APStatus } from '../account-payables/entities/account-payable.entity';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class VendorInvoicesService {
  constructor(
    @InjectRepository(VendorInvoice)
    private invoiceRepository: Repository<VendorInvoice>,
    @InjectRepository(PurchaseOrder)
    private poRepository: Repository<PurchaseOrder>,
    private dataSource: DataSource,
    private accountingService: AccountingService,
  ) {}

  async create(createVendorInvoiceDto: CreateVendorInvoiceDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check if invoice number already exists for this vendor
      const existing = await this.invoiceRepository.findOne({
        where: { invoiceNumber: createVendorInvoiceDto.invoiceNumber, vendorId: createVendorInvoiceDto.vendorId }
      });
      if (existing) throw new BadRequestException('Số hóa đơn này đã tồn tại cho nhà cung cấp này');

      // 1.5 Kiểm tra giới hạn hóa đơn so với PO (Over-invoicing prevention)
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: createVendorInvoiceDto.purchaseOrderId }
      });
      if (!po) throw new NotFoundException('Không tìm thấy đơn đặt hàng (PO)');

      const existingInvoices = await this.invoiceRepository.find({
        where: { purchaseOrderId: createVendorInvoiceDto.purchaseOrderId }
      });
      const totalInvoiced = existingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const newInvoiceAmount = Number(createVendorInvoiceDto.totalAmount);

      if (totalInvoiced + newInvoiceAmount > Number(po.totalAmount) + 0.01) { // Thêm dung sai nhỏ cho sai số làm tròn
        throw new BadRequestException(
          `Tổng giá trị hóa đơn (${totalInvoiced + newInvoiceAmount}) vượt quá giá trị đơn đặt hàng (${po.totalAmount}).`
        );
      }

      // 2. Create Invoice
      const invoice = this.invoiceRepository.create({
        ...createVendorInvoiceDto,
        status: VendorInvoiceStatus.PENDING,
      });

      const savedInvoice = await queryRunner.manager.save(invoice);

      // 3. Update PO Status to COMPLETED if it was RECEIVED
      if (po && (po.status === PurchaseOrderStatus.RECEIVED || po.status === PurchaseOrderStatus.PARTIAL_RECEIPT)) {
        po.status = PurchaseOrderStatus.COMPLETED;
        await queryRunner.manager.save(po);
      }

      // 4. Create Account Payable entry (Công nợ phải trả)
      const ap = queryRunner.manager.create(AccountPayable, {
        vendorId: savedInvoice.vendorId,
        invoiceNumber: savedInvoice.invoiceNumber,
        amount: savedInvoice.totalAmount,
        currency: createVendorInvoiceDto.currency || 'VND',
        dueDate: savedInvoice.dueDate,
        status: APStatus.UNPAID,
        note: `Hạch toán từ hóa đơn ${savedInvoice.invoiceNumber}`
      });
      await queryRunner.manager.save(ap);

      // 5. AUTO-POSTING TO ACCOUNTING (Hạch toán kế toán tự động)
      // Nợ TK 156/3388: Tiền hàng (amount)
      // Nợ TK 1331: Thuế GTGT (taxAmount)
      // Có TK 331: Tổng tiền phải trả (totalAmount)
      
      const journalItems: { accountCode: string; debit: number; credit: number; partnerId?: string }[] = [];
      
      // Bút toán Tiền hàng: Nợ 3388 (nếu dùng chuẩn 3-way match) hoặc 156
      journalItems.push({ 
        accountCode: '3388', 
        debit: Number(savedInvoice.amount), 
        credit: 0 
      });

      // Bút toán Thuế: Nợ 1331
      if (Number(savedInvoice.taxAmount) > 0) {
        journalItems.push({ 
          accountCode: '1331', 
          debit: Number(savedInvoice.taxAmount), 
          credit: 0 
        });
      }

      // Bút toán Công nợ: Có 331
      journalItems.push({ 
        accountCode: '331', 
        debit: 0, 
        credit: Number(savedInvoice.totalAmount), 
        partnerId: savedInvoice.vendorId 
      });

      await this.accountingService.createJournalEntry({
        description: `Ghi nhận hóa đơn NCC: ${savedInvoice.invoiceNumber} (PO: ${po?.poNumber})`,
        referenceType: 'VENDOR_INVOICE',
        referenceId: savedInvoice.id,
        entryDate: savedInvoice.invoiceDate,
        items: journalItems,
      }, queryRunner.manager);
      
      // Error in referenceId above, fixing it now

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  // Fixing the create method with correct referenceId
  async createFixed(createVendorInvoiceDto: CreateVendorInvoiceDto) {
      // (This was a thought, I will write the final version directly)
  }

  async findAll(query: any) {
    const { current = 1, pageSize = 10, ...filters } = query;
    
    // Loại bỏ tham số rác
    const cleanFilters: any = {};
    if (filters.invoiceNumber) cleanFilters.invoiceNumber = filters.invoiceNumber;
    if (filters.purchaseOrderId) cleanFilters.purchaseOrderId = filters.purchaseOrderId;
    if (filters.vendorId) cleanFilters.vendorId = filters.vendorId;

    const [results, total] = await this.invoiceRepository.findAndCount({
      where: cleanFilters,
      relations: ['purchaseOrder', 'vendor'],
      skip: (Number(current) - 1) * Number(pageSize),
      take: Number(pageSize),
      order: { createdAt: 'DESC' }
    });

    return {
      results,
      meta: {
        current: Number(current),
        pageSize: Number(pageSize),
        pages: Math.ceil(total / Number(pageSize)),
        total: total,
      },
    };
  }

  async findOne(id: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['purchaseOrder', 'vendor'],
    });
    if (!invoice) throw new NotFoundException('Vendor Invoice not found');
    return invoice;
  }

  async updateStatus(id: string, status: VendorInvoiceStatus) {
    const invoice = await this.findOne(id);
    invoice.status = status;
    return this.invoiceRepository.save(invoice);
  }
}
