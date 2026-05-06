import { Controller, Get, Post, Body, Patch, Param, Query } from '@nestjs/common';
import { VendorInvoicesService } from './vendor-invoices.service';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { ResponseMessage } from '@/decorator/customize';
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
  findAll(@Query() query: any) {
    return this.vendorInvoicesService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết hóa đơn nhà cung cấp thành công')
  findOne(@Param('id') id: string) {
    return this.vendorInvoicesService.findOne(id);
  }

  @Patch(':id/status')
  @ResponseMessage('Cập nhật trạng thái hóa đơn thành công')
  updateStatus(@Param('id') id: string, @Body('status') status: VendorInvoiceStatus) {
    return this.vendorInvoicesService.updateStatus(id, status);
  }
}
