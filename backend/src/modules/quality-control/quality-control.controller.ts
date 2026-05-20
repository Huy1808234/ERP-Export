import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { QualityControlService } from './quality-control.service';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { User as CurrentUser } from '@/decorator/customize';
import { CreateQualityCheckDto } from './dto/create-quality-check.dto';
import { CloseQualityExceptionDto } from './dto/close-quality-exception.dto';
import { ResolveQualityExceptionDto, SendQualityClaimDto } from './dto/quality-claim-action.dto';

@Controller('quality-control')
export class QualityControlController {
  constructor(private readonly qcService: QualityControlService) {}

  @Post()
  create(@Body() data: CreateQualityCheckDto, @CurrentUser() user: UserEntity) {
    return this.qcService.create(data, user);
  }

  @Get('exceptions/dashboard')
  getExceptionDashboard() {
    return this.qcService.getExceptionDashboard();
  }

  @Get('exceptions')
  findExceptions() {
    return this.qcService.findExceptions();
  }

  @Get()
  findAll(@Query() query: any) {
    return this.qcService.findAll(query);
  }

  @Patch(':_id/close-exception')
  closeException(
    @Param('_id') recordId: string,
    @Body() dto: CloseQualityExceptionDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.qcService.closeException(recordId, dto, user);
  }

  @Patch(':_id/send-claim')
  sendClaim(
    @Param('_id') recordId: string,
    @Body() dto: SendQualityClaimDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.qcService.sendClaim(recordId, dto, user);
  }

  @Patch(':_id/resolve-exception')
  resolveException(
    @Param('_id') recordId: string,
    @Body() dto: ResolveQualityExceptionDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.qcService.resolveException(recordId, dto, user);
  }

  @Get(':_id')
  findOne(@Param('_id') recordId: string) {
    return this.qcService.findOne(recordId);
  }
}
