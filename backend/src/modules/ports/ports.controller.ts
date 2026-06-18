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
import { Roles, User } from '@/decorator/customize';
import { CreatePortDto } from './dto/create-port.dto';
import { QueryPortDto } from './dto/query-port.dto';
import { UpdatePortDto } from './dto/update-port.dto';
import { PortsService } from './ports.service';

type RequestUser = {
  username?: string;
};

@Controller('ports')
export class PortsController {
  constructor(private readonly portsService: PortsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() dto: CreatePortDto, @User() user?: RequestUser) {
    return this.portsService.create(dto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT', 'LOGISTICS')
  findAll(@Query() query: QueryPortDto) {
    return this.portsService.findAll(query);
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT', 'LOGISTICS')
  findOne(@Param('_id') recordId: string) {
    return this.portsService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('_id') recordId: string,
    @Body() dto: UpdatePortDto,
    @User() user?: RequestUser,
  ) {
    return this.portsService.update(recordId, dto, user);
  }

  @Delete(':_id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('_id') recordId: string, @User() user?: RequestUser) {
    return this.portsService.remove(recordId, user);
  }
}
