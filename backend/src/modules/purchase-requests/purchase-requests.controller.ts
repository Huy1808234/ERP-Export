import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService) {}

  @Post()
  @ResponseMessage('Tạo yêu cầu mua hàng thành công')
  create(@Body() createPurchaseRequestDto: CreatePurchaseRequestDto, @User() user: IUser) {
    return this.purchaseRequestsService.create(createPurchaseRequestDto, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách yêu cầu mua hàng thành công')
  findAll(
    @Query("current") currentPage: string,
    @Query("pageSize") limit: string,
    @Query() qs: string,
  ) {
    return this.purchaseRequestsService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết yêu cầu mua hàng thành công')
  findOne(@Param('id') id: string) {
    return this.purchaseRequestsService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Cập nhật yêu cầu mua hàng thành công')
  update(@Param('id') id: string, @Body() updatePurchaseRequestDto: UpdatePurchaseRequestDto) {
    return this.purchaseRequestsService.update(id, updatePurchaseRequestDto);
  }

  @Post(':id/submit')
  @ResponseMessage('Gửi yêu cầu mua hàng thành công')
  submit(@Param('id') id: string) {
    return this.purchaseRequestsService.submit(id);
  }

  @Post(':id/approve')
  @ResponseMessage('Phê duyệt yêu cầu mua hàng thành công')
  approve(@Param('id') id: string, @User() user: IUser) {
    return this.purchaseRequestsService.approve(id, user);
  }

  @Delete(':id')
  @ResponseMessage('Xóa yêu cầu mua hàng thành công')
  remove(@Param('id') id: string) {
    return this.purchaseRequestsService.remove(id);
  }
}
