import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';
import { ReverseGoodsReceiptDto } from './dto/reverse-goods-receipt.dto';

type GoodsReceiptQuery = {
  current?: string;
  pageSize?: string;
  grNumber?: string;
  grnNumber?: string;
  purchaseOrderId?: string;
  receivedByUsername?: string;
  status?: string;
};

@Controller('goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Post()
  @ResponseMessage('Nhap kho hang mua thanh cong')
  create(
    @Body() createGoodsReceiptDto: CreateGoodsReceiptDto,
    @User() user: IUser,
  ) {
    return this.goodsReceiptsService.create(createGoodsReceiptDto, user);
  }

  @Patch(':_id/reverse')
  @ResponseMessage('Dao phieu nhap kho thanh cong')
  reverse(
    @Param('_id') recordId: string,
    @Body() dto: ReverseGoodsReceiptDto,
    @User() user: IUser,
  ) {
    return this.goodsReceiptsService.reverse(recordId, dto, user);
  }

  @Get()
  @ResponseMessage('Lay danh sach phieu nhap kho thanh cong')
  findAll(@Query() query: GoodsReceiptQuery) {
    return this.goodsReceiptsService.findAll(query);
  }

  @Get(':_id')
  @ResponseMessage('Lay chi tiet phieu nhap kho thanh cong')
  findOne(@Param('_id') recordId: string) {
    return this.goodsReceiptsService.findOne(recordId);
  }
}
