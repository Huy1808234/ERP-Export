import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Repository } from 'typeorm';
import { InventoryLedger } from './entities/inventory-ledger.entity';
import { Roles, User, ResponseMessage } from '@/decorator/customize';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';

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
    return this.inventoryService.adjustStock(
      dto.productId,
      dto.adjustmentQuantity,
      dto.reason,
      user,
      dto.lotNumber,
      dto.unitPrice
    );
  }

  @Get()
  @Roles('ADMIN', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTANT')
  async getStockStatus(@Query() query: any) {
    const current = +query.current || 1;
    const pageSize = +query.pageSize || 10;
    const skip = (current - 1) * pageSize;

    const [results, total] = await this.productRepository.findAndCount({
      where: {}, // Có thể thêm filter search theo SKU/Name ở đây
      order: { updatedAt: 'DESC' },
      take: pageSize,
      skip: skip,
    });

    // Tính toán sơ bộ cho Dashboard Kho
    const summary = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.currentStock)', 'totalStock')
      .addSelect('COUNT(product.id)', 'totalItems')
      .addSelect('SUM(CASE WHEN product.currentStock <= product.minimumStock THEN 1 ELSE 0 END)', 'lowStockCount')
      .getRawOne();

    return {
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
    };
  }

  @Get('ledger')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  async getLedger(@Query() query: any) {
    const productId = query.productId;
    if (!productId) return { results: [] };

    const [results, total] = await this.ledgerRepository.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: 50, // Lấy 50 giao dịch gần nhất của sản phẩm
    });

    return { results, total };
  }

  @Get('audit-trail')
  @Roles('ADMIN', 'WAREHOUSE', 'ACCOUNTANT')
  @ResponseMessage('Truy xuất nhật ký kho thành công')
  async getAuditTrail(@Query() query: any) {
    return this.inventoryService.findAllAuditTrail(query);
  }
}
