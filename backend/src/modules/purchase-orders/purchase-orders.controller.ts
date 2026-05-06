import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ResponseMessage, User, Roles } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';

@Controller('purchase-orders')
@Roles('ADMIN', 'PURCHASING', 'ACCOUNTING', 'LOGISTICS')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles('ADMIN', 'PURCHASING')
  @ResponseMessage('Tạo đơn đặt hàng thành công')
  create(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto, @User() user: IUser) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, user);
  }

  @Post('from-pr')
  @Roles('ADMIN', 'PURCHASING')
  @ResponseMessage('Tạo đơn đặt hàng từ yêu cầu mua hàng thành công')
  createFromPR(@Body() body: { purchaseRequestId: string; vendorId?: string }, @User() user: IUser) {
    return this.purchaseOrdersService.createFromPR(body, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách đơn đặt hàng thành công')
  findAll(
    @Query("current") currentPage: string,
    @Query("pageSize") limit: string,
    @Query() qs: string,
  ) {
    return this.purchaseOrdersService.findAll(+currentPage, +limit, qs);
  }

  @Get('stats')
  @ResponseMessage('Lấy thống kê đơn đặt hàng thành công')
  getStats() {
    return this.purchaseOrdersService.getStats();
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết đơn đặt hàng thành công')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Cập nhật đơn đặt hàng thành công')
  update(@Param('id') id: string, @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto);
  }

  @Post(':id/send')
  @ResponseMessage('Gửi đơn đặt hàng cho nhà cung cấp thành công')
  send(@Param('id') id: string) {
    return this.purchaseOrdersService.send(id);
  }

  @Get(':id/matching')
  @ResponseMessage('Lấy dữ liệu đối soát 3 chiều thành công')
  getMatching(@Param('id') id: string) {
    return this.purchaseOrdersService.getMatchingData(id);
  }

  @Delete(':id')
  @ResponseMessage('Xóa đơn đặt hàng thành công')
  remove(@Param('id') id: string) {
    return this.purchaseOrdersService.softDelete(id);
  }
}
