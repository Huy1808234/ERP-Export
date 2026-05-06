import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { SalesContractsService } from './sales-contracts.service';
import { ResponseMessage, User, RequirePermissions } from '@/decorator/customize';
import { IUser } from '../users/users.interface';

@Controller('sales-contracts')
export class SalesContractsController {
  constructor(private readonly salesContractsService: SalesContractsService) {}

  @Post()
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Create sales contract success')
  create(@Body() createDto: any, @User() user: any) {
    return this.salesContractsService.create(createDto, user);
  }

  @Post('calculate')
  @ResponseMessage('Calculate sales contract totals')
  calculate(@Body() dto: any) {
    return this.salesContractsService.calculate(dto);
  }

  @Get()
  @ResponseMessage('Fetch list sales contracts with pagination')
  findAll(
    @Query('current') current: string,
    @Query('pageSize') pageSize: string,
    @Query() query: any
  ) {
    return this.salesContractsService.findAll({ ...query, current: +current, pageSize: +pageSize });
  }

  @Get(':id')
  @ResponseMessage('Fetch sales contract by id')
  findOne(@Param('id') id: string) {
    return this.salesContractsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Update sales contract success')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return this.salesContractsService.update(id, updateDto);
  }

  @Patch(':id/confirm')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Confirm sales contract and reserve stock')
  confirm(@Param('id') id: string) {
    return this.salesContractsService.confirmContract(id);
  }

  @Patch(':id/ship')
  @RequirePermissions('write:sales_contract')
  @ResponseMessage('Ship sales contract items')
  ship(@Param('id') id: string) {
    return this.salesContractsService.shipContract(id);
  }
}
