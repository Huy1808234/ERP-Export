import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '@/decorator/customize';
import { VendorPriceHistoryService } from './vendor-price-history.service';
import { CreateVendorPriceHistoryDto } from './dto/create-vendor-price-history.dto';
import { UpdateVendorPriceHistoryDto } from './dto/update-vendor-price-history.dto';

@Controller('vendor-price-history')
export class VendorPriceHistoryController {
  constructor(private readonly vendorPriceHistoryService: VendorPriceHistoryService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  create(@Body() dto: CreateVendorPriceHistoryDto) {
    return this.vendorPriceHistoryService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'ACCOUNTANT')
  findAll(@Query('vendorId') vendorId?: string, @Query('productId') productId?: string) {
    return this.vendorPriceHistoryService.findAll(vendorId, productId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'ACCOUNTANT')
  findOne(@Param('id') id: string) {
    return this.vendorPriceHistoryService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  update(@Param('id') id: string, @Body() dto: UpdateVendorPriceHistoryDto) {
    return this.vendorPriceHistoryService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.vendorPriceHistoryService.remove(id);
  }
}
