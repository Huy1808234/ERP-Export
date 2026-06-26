import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PurchaseReturnsService } from './purchase-returns.service';
import { ResponseMessage, User } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import {
  CancelPurchaseReturnDto,
  ResolvePurchaseReturnDto,
} from './dto/purchase-return-actions.dto';

type PurchaseReturnQuery = {
  current?: string;
  pageSize?: string;
  status?: string;
  purchaseOrderId?: string;
  qualityCheckId?: string;
  claimNumber?: string;
  vendorId?: string;
  reasonCode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
};

@Controller('purchase-returns')
export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService: PurchaseReturnsService,
  ) {}

  @Post()
  @ResponseMessage('Tao phieu tra hang thanh cong')
  create(@Body() createDto: CreatePurchaseReturnDto, @User() user: IUser) {
    return this.purchaseReturnsService.create(createDto, user);
  }

  @Patch(':_id/submit')
  @ResponseMessage('Gui phieu tra hang cho xu ly thanh cong')
  submit(@Param('_id') recordId: string, @User() user: IUser) {
    return this.purchaseReturnsService.submit(recordId, user);
  }

  @Patch(':_id/send')
  @ResponseMessage('Xuat kho tra hang NCC thanh cong')
  send(@Param('_id') recordId: string, @User() user: IUser) {
    return this.purchaseReturnsService.send(recordId, user);
  }

  @Patch(':_id/resolve')
  @ResponseMessage('Cap nhat ket qua tra hang NCC thanh cong')
  resolve(
    @Param('_id') recordId: string,
    @Body() dto: ResolvePurchaseReturnDto,
    @User() user: IUser,
  ) {
    return this.purchaseReturnsService.resolve(recordId, dto, user);
  }

  @Patch(':_id/cancel')
  @ResponseMessage('Huy phieu tra hang thanh cong')
  cancel(
    @Param('_id') recordId: string,
    @Body() dto: CancelPurchaseReturnDto,
    @User() user: IUser,
  ) {
    return this.purchaseReturnsService.cancel(recordId, dto, user);
  }

  @Get('stats')
  @ResponseMessage('Lay thong ke phieu tra hang thanh cong')
  stats() {
    return this.purchaseReturnsService.getStats();
  }

  @Get()
  @ResponseMessage('Lay danh sach phieu tra hang thanh cong')
  findAll(
    @Query() query: PurchaseReturnQuery,
    @Query('current') current: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.purchaseReturnsService.findAll(
      query,
      Number(current || 1),
      Number(pageSize || 10),
    );
  }

  @Get(':_id')
  @ResponseMessage('Lay chi tiet phieu tra hang thanh cong')
  findOne(@Param('_id') recordId: string) {
    return this.purchaseReturnsService.findOne(recordId);
  }
}
