import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ResponseMessage, User, Roles } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { ShipmentStatus } from './entities/shipment.entity';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT')
  @ResponseMessage('Create shipment successfully')
  create(@Body() createShipmentDto: CreateShipmentDto, @User() user: UserEntity) {
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

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS', 'SALES_EXPORT', 'ACCOUNTANT')
  @ResponseMessage('Fetch shipment by id')
  findOne(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS')
  @ResponseMessage('Update shipment successfully')
  update(@Param('id') id: string, @Body() updateShipmentDto: UpdateShipmentDto) {
    return this.shipmentsService.update(id, updateShipmentDto);
  }

  @Patch(':id/issue-stock')
  @ResponseMessage('Xác nhận xuất kho thành công')
  issueStock(@Param('id') id: string, @User() user: any) {
    return this.shipmentsService.issueStock(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'LOGISTICS')
  @ResponseMessage('Update shipment status')
  updateStatus(@Param('id') id: string, @Body('status') status: ShipmentStatus) {
    return this.shipmentsService.updateStatus(id, status);
  }
}
