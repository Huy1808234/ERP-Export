import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto';
import { SendPurchaseOrderDto } from './dto/send-purchase-order.dto';
import { ResponseMessage, User, Roles } from '@/decorator/customize';
import type { IUser } from '../users/users.interface';

@Controller('purchase-orders')
@Roles('ADMIN', 'PURCHASING', 'ACCOUNTING', 'LOGISTICS')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles('ADMIN', 'PURCHASING')
  @ResponseMessage('Tạo đơn đặt hàng thành công')
  create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @User() user: IUser,
  ) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, user);
  }

  @Post('from-pr')
  @Roles('ADMIN', 'PURCHASING')
  @ResponseMessage('Tạo đơn đặt hàng từ yêu cầu mua hàng thành công')
  createFromPR(
    @Body() body: { purchaseRequestId: string; vendorId?: string },
    @User() user: IUser,
  ) {
    return this.purchaseOrdersService.createFromPR(body, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách đơn đặt hàng thành công')
  @Roles('ADMIN', 'PURCHASING', 'ACCOUNTING', 'LOGISTICS', 'WAREHOUSE')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.purchaseOrdersService.findAll(+currentPage, +limit, qs);
  }

  @Get('stats')
  @ResponseMessage('Lấy thống kê đơn đặt hàng thành công')
  getStats() {
    return this.purchaseOrdersService.getStats();
  }

  @Get(':_id')
  @ResponseMessage('Lấy chi tiết đơn đặt hàng thành công')
  @Roles('ADMIN', 'PURCHASING', 'ACCOUNTING', 'LOGISTICS', 'WAREHOUSE')
  findOne(@Param('_id') recordId: string) {
    return this.purchaseOrdersService.findOne(recordId);
  }

  @Patch(':_id')
  @ResponseMessage('Cập nhật đơn đặt hàng thành công')
  update(
    @Param('_id') recordId: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(recordId, updatePurchaseOrderDto);
  }

  @Post(':_id/send')
  @ResponseMessage('Gửi đơn đặt hàng cho nhà cung cấp thành công')
  send(
    @Param('_id') recordId: string,
    @Body() body: SendPurchaseOrderDto,
    @User() user: IUser,
  ) {
    return this.purchaseOrdersService.send(recordId, user, body);
  }

  @Patch(':_id/cancel')
  @Roles('ADMIN', 'PURCHASING')
  @ResponseMessage('Huy PO thanh cong')
  cancel(
    @Param('_id') recordId: string,
    @Body() body: CancelPurchaseOrderDto,
    @User() user: IUser,
  ) {
    return this.purchaseOrdersService.cancel(recordId, body, user);
  }

  @Get(':_id/matching')
  @ResponseMessage('Lấy dữ liệu đối soát 3 chiều thành công')
  getMatching(@Param('_id') recordId: string) {
    return this.purchaseOrdersService.getMatchingData(recordId);
  }

  @Delete(':_id')
  @ResponseMessage('Xóa đơn đặt hàng thành công')
  remove(@Param('_id') recordId: string) {
    return this.purchaseOrdersService.softDelete(recordId);
  }
}
