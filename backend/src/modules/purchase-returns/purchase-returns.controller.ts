import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PurchaseReturnsService } from './purchase-returns.service';
import { ResponseMessage, User } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';

@Controller('purchase-returns')
export class PurchaseReturnsController {
  constructor(private readonly purchaseReturnsService: PurchaseReturnsService) {}

  @Post()
  @ResponseMessage('Tạo phiếu trả hàng thành công')
  create(@Body() createDto: any, @User() user: IUser) {
    return this.purchaseReturnsService.create(createDto, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách phiếu trả hàng thành công')
  findAll(
    @Query() query: string,
    @Query('current') current: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.purchaseReturnsService.findAll(query, +current, +pageSize);
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết phiếu trả hàng thành công')
  findOne(@Param('id') id: string) {
    return this.purchaseReturnsService.findOne(id);
  }
}
