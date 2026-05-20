import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Brackets, Repository } from 'typeorm';
import { InventoryLedger } from './entities/inventory-ledger.entity';
import { Roles, User, ResponseMessage } from '@/decorator/customize';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import {
  assertCanWriteCostFields,
  maskCostFields,
} from '@/common/field-access.util';
import {
  ApproveInventoryCountDto,
  CreateInventoryCountDto,
  SubmitInventoryCountDto,
} from './dto/create-inventory-count.dto';
import {
  CreateCustomerReturnDto,
  CustomerReturnDecisionDto,
} from './dto/create-customer-return.dto';
import {
  CancelExportDeliveryDto,
  CreateExportDeliveryFromShipmentDto,
  IssueExportDeliveryDto,
} from './dto/create-export-delivery.dto';
import { CreateInventoryPeriodSnapshotDto } from './dto/create-period-snapshot.dto';

type InventorySortDirection = 'ASC' | 'DESC';

const INVENTORY_AVAILABLE_STOCK_EXPRESSION =
  '(COALESCE(product."currentStock", 0) - COALESCE(product."reservedStock", 0))';

const INVENTORY_STOCK_SORT_COLUMNS: Record<string, string> = {
  sku: 'product.sku',
  vietnameseName: 'product.vietnameseName',
  currentStock: 'product.currentStock',
  reservedStock: 'product.reservedStock',
  minimumStock: 'product.minimumStock',
  updatedAt: 'product.updatedAt',
};

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryLedger)
    private ledgerRepository: Repository<InventoryLedger>,
  ) {}

  @Post('adjustment')
  @Roles('ADMIN', 'WAREHOUSE')
  @ResponseMessage('Điều chỉnh tồn kho thành công')
  async adjustStock(@Body() dto: CreateAdjustmentDto, @User() user: any) {
    assertCanWriteCostFields(dto, user, ['unitPrice']);
    return this.inventoryService.adjustStock(
      dto.productId,
      dto.adjustmentQuantity,
      dto.reason,
      user,
      dto.lotNumber,
      dto.unitPrice
    );
  }

  @Get('valuation')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  @ResponseMessage('Lấy báo cáo định giá tồn kho thành công')
  async getValuation(@Query('method') method?: string, @User() user?: any) {
    const normalizedMethod = method === 'AVG' ? 'AVG' : 'FIFO';
    const report = await this.inventoryService.getValuationReport(normalizedMethod);
    return maskCostFields(report, user, ['totalValue']);
  }

  @Get('counts')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  @ResponseMessage('Lấy danh sách phiếu kiểm kê thành công')
  async getInventoryCounts(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findAllInventoryCounts(query);
    return maskCostFields(result, user);
  }

  @Post('counts')
  @Roles('ADMIN', 'WAREHOUSE')
  @ResponseMessage('Tạo phiếu kiểm kê thành công')
  async createInventoryCount(@Body() dto: CreateInventoryCountDto, @User() user: any) {
    return this.inventoryService.createInventoryCount(dto, user);
  }

  @Get('counts/:_id')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  @ResponseMessage('Lấy chi tiết phiếu kiểm kê thành công')
  async getInventoryCount(@Param('_id') recordId: string, @User() user: any) {
    const result = await this.inventoryService.findInventoryCount(recordId);
    return maskCostFields(result, user);
  }

  @Patch('counts/:_id/submit')
  @Roles('ADMIN', 'WAREHOUSE')
  @ResponseMessage('Gửi duyệt phiếu kiểm kê thành công')
  async submitInventoryCount(
    @Param('_id') recordId: string,
    @Body() dto: SubmitInventoryCountDto,
    @User() user: any,
  ) {
    return this.inventoryService.submitInventoryCount(recordId, dto, user);
  }

  @Patch('counts/:_id/approve')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  @ResponseMessage('Phê duyệt phiếu kiểm kê thành công')
  async approveInventoryCount(
    @Param('_id') recordId: string,
    @Body() dto: ApproveInventoryCountDto,
    @User() user: any,
  ) {
    return this.inventoryService.approveInventoryCount(recordId, dto, user);
  }

  @Get('customer-returns')
  @Roles('ADMIN', 'WAREHOUSE', 'SALES_EXPORT', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy danh sách phiếu khách trả hàng thành công')
  async getCustomerReturns(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findAllCustomerReturns(query);
    return maskCostFields(result, user);
  }

  @Post('customer-returns')
  @Roles('ADMIN', 'WAREHOUSE', 'SALES_EXPORT')
  @ResponseMessage('Tạo phiếu khách trả hàng thành công')
  async createCustomerReturn(@Body() dto: CreateCustomerReturnDto, @User() user: any) {
    assertCanWriteCostFields(dto, user);
    const result = await this.inventoryService.createCustomerReturn(dto, user);
    return maskCostFields(result, user);
  }

  @Get('customer-returns/:_id')
  @Roles('ADMIN', 'WAREHOUSE', 'SALES_EXPORT', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy chi tiết phiếu khách trả hàng thành công')
  async getCustomerReturn(@Param('_id') recordId: string, @User() user: any) {
    const result = await this.inventoryService.findCustomerReturn(recordId);
    return maskCostFields(result, user);
  }

  @Patch('customer-returns/:_id/submit')
  @Roles('ADMIN', 'WAREHOUSE', 'SALES_EXPORT')
  @ResponseMessage('Gửi duyệt phiếu khách trả hàng thành công')
  async submitCustomerReturn(@Param('_id') recordId: string, @User() user: any) {
    return this.inventoryService.submitCustomerReturn(recordId, user);
  }

  @Patch('customer-returns/:_id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Phê duyệt phiếu khách trả hàng thành công')
  async approveCustomerReturn(
    @Param('_id') recordId: string,
    @Body() dto: CustomerReturnDecisionDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.approveCustomerReturn(recordId, dto, user);
    return maskCostFields(result, user);
  }

  @Patch('customer-returns/:_id/reject')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Từ chối phiếu khách trả hàng thành công')
  async rejectCustomerReturn(
    @Param('_id') recordId: string,
    @Body() dto: CustomerReturnDecisionDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.rejectCustomerReturn(recordId, dto, user);
    return maskCostFields(result, user);
  }

  @Patch('customer-returns/:_id/receive')
  @Roles('ADMIN', 'WAREHOUSE')
  @ResponseMessage('Nhập lại kho phiếu khách trả hàng thành công')
  async receiveCustomerReturn(
    @Param('_id') recordId: string,
    @Body() dto: CustomerReturnDecisionDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.receiveCustomerReturn(recordId, dto, user);
    return maskCostFields(result, user);
  }

  @Get('lot-movements')
  @Roles('ADMIN', 'WAREHOUSE', 'SALES_EXPORT', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy báo cáo movement theo lot thành công')
  async getLotMovements(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findLotMovements(query);
    return maskCostFields(result, user, ['unitPrice']);
  }

  @Get('export-deliveries')
  @Roles('ADMIN', 'WAREHOUSE', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy danh sách phiếu xuất kho export thành công')
  async getExportDeliveries(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findAllExportDeliveries(query);
    return maskCostFields(result, user, ['unitCost', 'totalCost']);
  }

  @Post('export-deliveries/from-shipment/:_id')
  @Roles('ADMIN', 'WAREHOUSE', 'LOGISTICS', 'SALES_EXPORT')
  @ResponseMessage('Create export delivery from shipment successfully')
  async createExportDeliveryFromShipment(
    @Param('_id') recordId: string,
    @Body() dto: CreateExportDeliveryFromShipmentDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.createExportDeliveryFromShipment(recordId, dto, user);
    return maskCostFields(result, user, ['unitCost', 'totalCost']);
  }

  @Get('export-deliveries/:_id')
  @Roles('ADMIN', 'WAREHOUSE', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy chi tiết phiếu xuất kho export thành công')
  async getExportDelivery(@Param('_id') recordId: string, @User() user: any) {
    const result = await this.inventoryService.findExportDelivery(recordId);
    return maskCostFields(result, user, ['unitCost', 'totalCost']);
  }

  @Patch('export-deliveries/:_id/issue')
  @Roles('ADMIN', 'WAREHOUSE', 'LOGISTICS')
  @ResponseMessage('Issue export delivery successfully')
  async issueExportDelivery(
    @Param('_id') recordId: string,
    @Body() dto: IssueExportDeliveryDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.issueExportDelivery(recordId, dto, user);
    return maskCostFields(result, user, ['unitCost', 'totalCost']);
  }

  @Patch('export-deliveries/:_id/cancel')
  @Roles('ADMIN', 'WAREHOUSE', 'LOGISTICS', 'MANAGER')
  @ResponseMessage('Cancel export delivery successfully')
  async cancelExportDelivery(
    @Param('_id') recordId: string,
    @Body() dto: CancelExportDeliveryDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.cancelExportDelivery(recordId, dto, user);
    return maskCostFields(result, user, ['unitCost', 'totalCost']);
  }

  @Get('adjustments')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy danh sách phiếu điều chỉnh tồn kho thành công')
  async getAdjustments(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findAllInventoryAdjustments(query);
    return maskCostFields(result, user, ['unitPrice', 'amountVnd']);
  }

  @Get('adjustments/:_id')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Lấy chi tiết phiếu điều chỉnh tồn kho thành công')
  async getAdjustment(@Param('_id') recordId: string, @User() user: any) {
    const result = await this.inventoryService.findInventoryAdjustment(recordId);
    return maskCostFields(result, user, ['unitPrice', 'amountVnd']);
  }

  @Get('period-snapshots')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Fetch inventory period snapshots successfully')
  async getPeriodSnapshots(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findAllPeriodSnapshots(query);
    return maskCostFields(result, user, ['totalValue', 'unitCost', 'inventoryValue']);
  }

  @Post('period-snapshots')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Create inventory period snapshot successfully')
  async createPeriodSnapshot(
    @Body() dto: CreateInventoryPeriodSnapshotDto,
    @User() user: any,
  ) {
    const result = await this.inventoryService.createPeriodSnapshot(dto, user);
    return maskCostFields(result, user, ['totalValue', 'unitCost', 'inventoryValue']);
  }

  @Get('period-snapshots/:_id')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT', 'MANAGER')
  @ResponseMessage('Fetch inventory period snapshot successfully')
  async getPeriodSnapshot(@Param('_id') recordId: string, @User() user: any) {
    const result = await this.inventoryService.findPeriodSnapshot(recordId);
    return maskCostFields(result, user, ['totalValue', 'unitCost', 'inventoryValue']);
  }

  @Get()
  @Roles('ADMIN', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTANT')
  async getStockStatus(@Query() query: any, @User() user: any) {
    const current = +query.current || 1;
    const pageSize = +query.pageSize || 10;
    const skip = (current - 1) * pageSize;
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const rawSort = typeof query.sort === 'string' && query.sort.trim()
      ? query.sort.trim()
      : 'availableStock';
    const sortDirection: InventorySortDirection = rawSort.startsWith('-') ? 'DESC' : 'ASC';
    const sortField = rawSort.replace(/^-/, '');
    const sortColumn =
      sortField === 'availableStock'
        ? INVENTORY_AVAILABLE_STOCK_EXPRESSION
        : INVENTORY_STOCK_SORT_COLUMNS[sortField] || INVENTORY_AVAILABLE_STOCK_EXPRESSION;

    const qb = this.productRepository.createQueryBuilder('product');

    if (search) {
      qb.andWhere(
        new Brackets((sqb) => {
          sqb
            .where('product.sku ILIKE :search', { search: `%${search}%` })
            .orWhere('product.vietnameseName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('product.englishName ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    qb.orderBy(sortColumn, sortDirection)
      .addOrderBy('product.sku', 'ASC')
      .skip(skip)
      .take(pageSize);

    const [results, total] = await qb.getManyAndCount();

    // Tính toán sơ bộ cho Dashboard Kho
    const summary = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.currentStock)', 'totalStock')
      .addSelect('COUNT(product._id)', 'totalItems')
      .addSelect('SUM(CASE WHEN product.currentStock <= product.minimumStock THEN 1 ELSE 0 END)', 'lowStockCount')
      .getRawOne();

    return maskCostFields({
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
      summary: {
        totalStock: Number(summary.totalStock || 0),
        totalItems: Number(summary.totalItems || 0),
        lowStockCount: Number(summary.lowStockCount || 0),
      }
    }, user);
  }

  @Get('ledger')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  async getLedger(@Query() query: any, @User() user: any) {
    const productId = query.productId;
    if (!productId) return { results: [] };

    const [results, total] = await this.ledgerRepository.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: 50, // Lấy 50 giao dịch gần nhất của sản phẩm
    });

    return maskCostFields({ results, total }, user, ['unitPrice']);
  }

  @Get('audit-trail')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  @ResponseMessage('Truy xuất nhật ký kho thành công')
  async getAuditTrail(@Query() query: any, @User() user: any) {
    const result = await this.inventoryService.findAllAuditTrail(query);
    return maskCostFields(result, user, ['unitPrice']);
  }
}
