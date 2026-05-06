import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';

@Controller('goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Post()
  @ResponseMessage('Nhập kho hàng mua thành công')
  create(@Body() createGoodsReceiptDto: CreateGoodsReceiptDto, @User() user: IUser) {
    return this.goodsReceiptsService.create(createGoodsReceiptDto, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách phiếu nhập kho thành công')
  findAll(@Query() query: any) {
    return this.goodsReceiptsService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết phiếu nhập kho thành công')
  findOne(@Param('id') id: string) {
    return this.goodsReceiptsService.findOne(id);
  }
}
