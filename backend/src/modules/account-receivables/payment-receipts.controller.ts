import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ResponseMessage,
  User,
  RequirePermissions,
} from '@/decorator/customize';
import { PaymentReceiptsService } from './payment-receipts.service';
import {
  CreatePaymentReceiptDto,
  ApprovePaymentReceiptDto,
  RejectPaymentReceiptDto,
} from './dto/create-payment-receipt.dto';

type PermissionLike =
  | string
  | { name?: unknown; code?: unknown; apiPath?: unknown };

type RequestUser = {
  username?: string;
  role?: string | { name?: unknown; permissions?: PermissionLike[] };
  roleName?: unknown;
  permissions?: PermissionLike[];
};

@Controller('payment-receipts')
export class PaymentReceiptsController {
  constructor(private readonly service: PaymentReceiptsService) {}

  @Post()
  @RequirePermissions('write:payment_receipt')
  @ResponseMessage('Create payment receipt')
  async create(
    @Body() dto: CreatePaymentReceiptDto,
    @User() user: RequestUser,
  ) {
    return this.service.create(dto, { username: user.username || 'system' });
  }

  @Get()
  @RequirePermissions('read:payment_receipt')
  @ResponseMessage('Fetch payment receipts')
  async findAll(@Query() query: Record<string, string>) {
    return this.service.findAll(query);
  }

  @Get(':_id')
  @RequirePermissions('read:payment_receipt')
  @ResponseMessage('Fetch payment receipt detail')
  async findOne(@Param('_id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':_id/approve')
  @RequirePermissions('approve:payment_receipt')
  @ResponseMessage('Approve payment receipt')
  async approve(
    @Param('_id') id: string,
    @Body() dto: ApprovePaymentReceiptDto,
    @User() user: RequestUser,
  ) {
    return this.service.approve(id, dto, { username: user.username || 'system' });
  }

  @Patch(':_id/reject')
  @RequirePermissions('approve:payment_receipt')
  @ResponseMessage('Reject payment receipt')
  async reject(
    @Param('_id') id: string,
    @Body() dto: RejectPaymentReceiptDto,
    @User() user: RequestUser,
  ) {
    return this.service.reject(id, dto, { username: user.username || 'system' });
  }

  @Patch(':_id/cancel')
  @RequirePermissions('write:payment_receipt')
  @ResponseMessage('Cancel payment receipt')
  async cancel(
    @Param('_id') id: string,
    @User() user: RequestUser,
  ) {
    return this.service.cancel(id, { username: user.username || 'system' });
  }
}
