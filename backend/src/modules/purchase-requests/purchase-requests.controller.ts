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

  @Get(':_id')
  @ResponseMessage('Lấy chi tiết yêu cầu mua hàng thành công')
  findOne(@Param('_id') recordId: string) {
    return this.purchaseRequestsService.findOne(recordId);
  }

  @Patch(':_id')
  @ResponseMessage('Cập nhật yêu cầu mua hàng thành công')
  update(@Param('_id') recordId: string, @Body() updatePurchaseRequestDto: UpdatePurchaseRequestDto) {
    return this.purchaseRequestsService.update(recordId, updatePurchaseRequestDto);
  }

  @Post(':_id/submit')
  @ResponseMessage('Gửi yêu cầu mua hàng thành công')
  submit(@Param('_id') recordId: string, @User() user: IUser) {
    return this.purchaseRequestsService.submit(recordId, user);
  }

  @Post(':_id/approve')
  @ResponseMessage('Phê duyệt yêu cầu mua hàng thành công')
  approve(@Param('_id') recordId: string, @User() user: IUser) {
    return this.purchaseRequestsService.approve(recordId, user);
  }

  @Delete(':_id')
  @ResponseMessage('Xóa yêu cầu mua hàng thành công')
  remove(@Param('_id') recordId: string) {
    return this.purchaseRequestsService.remove(recordId);
  }
}
