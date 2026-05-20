import { Controller, Get, Post, Body, Patch, Param, Query } from '@nestjs/common';
import { VendorInvoicesService } from './vendor-invoices.service';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { ResponseMessage } from '@/decorator/customize';
import type { QueryParams } from '@/common/types/authenticated-user.type';
import { VendorInvoiceStatus } from './entities/vendor-invoice.entity';

@Controller('vendor-invoices')
export class VendorInvoicesController {
  constructor(private readonly vendorInvoicesService: VendorInvoicesService) {}

  @Post()
  @ResponseMessage('Ghi nhận hóa đơn nhà cung cấp thành công')
  create(@Body() createVendorInvoiceDto: CreateVendorInvoiceDto) {
    return this.vendorInvoicesService.create(createVendorInvoiceDto);
  }

  @Get()
  @ResponseMessage('Lấy danh sách hóa đơn nhà cung cấp thành công')
  findAll(@Query() query: QueryParams) {
    return this.vendorInvoicesService.findAll(query);
  }

  @Get(':_id')
  @ResponseMessage('Lấy chi tiết hóa đơn nhà cung cấp thành công')
  findOne(@Param('_id') recordId: string) {
    return this.vendorInvoicesService.findOne(recordId);
  }

  @Patch(':_id/status')
  @ResponseMessage('Cập nhật trạng thái hóa đơn thành công')
  updateStatus(@Param('_id') recordId: string, @Body('status') status: VendorInvoiceStatus) {
    return this.vendorInvoicesService.updateStatus(recordId, status);
  }

  @Get('matching-status/:_id')
  @ResponseMessage('Lấy trạng thái đối chiếu 3 chiều thành công')
  getMatchingStatus(@Param('_id') purchase_order_id: string) {
    return this.vendorInvoicesService.getMatchingStatus(purchase_order_id);
  }
}
