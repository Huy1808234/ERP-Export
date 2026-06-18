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
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ResponseMessage, User, Roles, Public } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { ShipmentStatus } from './entities/shipment.entity';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT')
  @ResponseMessage('Create shipment successfully')
  create(
    @Body() createShipmentDto: CreateShipmentDto,
    @User() user: UserEntity,
  ) {
    return this.shipmentsService.create(createShipmentDto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch all shipments with pagination')
  findAll(@Query() query: any) {
    return this.shipmentsService.findAll(query);
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch shipment statistics')
  getStats() {
    return this.shipmentsService.getStats();
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch shipment by recordId')
  findOne(@Param('_id') recordId: string) {
    return this.shipmentsService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS')
  @ResponseMessage('Update shipment successfully')
  update(
    @Param('_id') recordId: string,
    @Body() updateShipmentDto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(recordId, updateShipmentDto);
  }

  @Patch(':_id/issue-stock')
  @ResponseMessage('Xác nhận xuất kho thành công')
  issueStock(@Param('_id') recordId: string, @User() user: any) {
    return this.shipmentsService.issueStock(recordId, user);
  }

  @Patch(':_id/status')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS')
  @ResponseMessage('Update shipment status')
  updateStatus(
    @Param('_id') recordId: string,
    @Body('status') status: ShipmentStatus,
  ) {
    return this.shipmentsService.updateStatus(recordId, status);
  }

  @Get('tracking/:number')
  @Public()
  @ResponseMessage('Tra cứu vận đơn thành công')
  tracking(@Param('number') number: string) {
    return this.shipmentsService.tracking(number);
  }
}
