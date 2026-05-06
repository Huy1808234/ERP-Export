import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '@/decorator/customize';
import { AccountPayablesService } from './account-payables.service';
import { CreateAccountPayableDto } from './dto/create-account-payable.dto';
import { UpdateAccountPayableDto } from './dto/update-account-payable.dto';
import { APStatus } from './entities/account-payable.entity';

@Controller('account-payables')
export class AccountPayablesController {
  constructor(private readonly accountPayablesService: AccountPayablesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  create(@Body() dto: CreateAccountPayableDto) {
    return this.accountPayablesService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findAll(
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: APStatus,
  ) {
    return this.accountPayablesService.findAll(vendorId, status);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  findOne(@Param('id') id: string) {
    return this.accountPayablesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASING')
  update(@Param('id') id: string, @Body() dto: UpdateAccountPayableDto) {
    return this.accountPayablesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  remove(@Param('id') id: string) {
    return this.accountPayablesService.remove(id);
  }
}
