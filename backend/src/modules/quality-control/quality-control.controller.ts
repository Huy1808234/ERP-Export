import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { QualityControlService } from './quality-control.service';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { User as CurrentUser } from '@/decorator/customize';

@Controller('quality-control')
export class QualityControlController {
  constructor(private readonly qcService: QualityControlService) {}

  @Post()
  create(@Body() data: any, @CurrentUser() user: UserEntity) {
    return this.qcService.create(data, user);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.qcService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.qcService.findOne(id);
  }
}
