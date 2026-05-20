import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, User } from '@/decorator/customize';
import { CreateVendorEvaluationDto } from './dto/create-vendor-evaluation.dto';
import { UpdateVendorEvaluationDto } from './dto/update-vendor-evaluation.dto';
import { VendorEvaluationsService } from './vendor-evaluations.service';

@Controller('vendor-evaluations')
@Roles('ADMIN', 'MANAGER', 'PURCHASING', 'ACCOUNTANT')
export class VendorEvaluationsController {
  constructor(
    private readonly vendorEvaluationsService: VendorEvaluationsService,
  ) {}

  @Get('dashboard')
  getDashboard(@Query('days') days?: string) {
    return this.vendorEvaluationsService.getDashboard(days ? Number(days) : 7);
  }

  @Get('due-payables')
  getDueSoonPayables(@Query('days') days?: string) {
    return this.vendorEvaluationsService.getDueSoonPayables(
      days ? Number(days) : 7,
    );
  }

  @Get('vendors/:_id/scorecard')
  getVendorScorecardDetail(
    @Param('_id') vendor_id: string,
    @Query('months') months?: string,
  ) {
    return this.vendorEvaluationsService.getVendorScorecardDetail(
      vendor_id,
      months ? Number(months) : 6,
    );
  }

  @Post()
  create(
    @Body() dto: CreateVendorEvaluationDto,
    @User() user: { username?: string },
  ) {
    return this.vendorEvaluationsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.vendorEvaluationsService.findAll(query);
  }

  @Get(':_id')
  findOne(@Param('_id') recordId: string) {
    return this.vendorEvaluationsService.findOne(recordId);
  }

  @Patch(':_id')
  update(
    @Param('_id') recordId: string,
    @Body() dto: UpdateVendorEvaluationDto,
  ) {
    return this.vendorEvaluationsService.update(recordId, dto);
  }

  @Patch(':_id/submit')
  submit(@Param('_id') recordId: string, @User() user: { username?: string }) {
    return this.vendorEvaluationsService.submit(recordId, user);
  }

  @Patch(':_id/approve')
  @Roles('ADMIN', 'MANAGER')
  approve(
    @Param('_id') recordId: string,
    @User() user: { username?: string },
    @Body('approvalNote') approvalNote?: string,
  ) {
    return this.vendorEvaluationsService.approve(recordId, user, approvalNote);
  }

  @Patch(':_id/reject')
  @Roles('ADMIN', 'MANAGER')
  reject(
    @Param('_id') recordId: string,
    @User() user: { username?: string },
    @Body('approvalNote') approvalNote?: string,
  ) {
    return this.vendorEvaluationsService.reject(recordId, user, approvalNote);
  }
}
