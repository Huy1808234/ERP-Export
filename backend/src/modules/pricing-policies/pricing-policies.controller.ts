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
import { PricingPoliciesService } from './pricing-policies.service';
import { CreatePricingPolicyDto } from './dto/create-pricing-policy.dto';
import { UpdatePricingPolicyDto } from './dto/update-pricing-policy.dto';
import { ResolvePriceDto } from './dto/resolve-price.dto';
import {
  FindPricingPoliciesQueryDto,
  FindSalesPriceHistoryQueryDto,
} from './dto/query-pricing-policy.dto';

type RequestUser = {
  username?: string;
};

@Controller('pricing-policies')
export class PricingPoliciesController {
  constructor(
    private readonly pricingPoliciesService: PricingPoliciesService,
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT')
  create(@Body() dto: CreatePricingPolicyDto, @User() user: RequestUser) {
    return this.pricingPoliciesService.create(dto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  findAll(@Query() query: FindPricingPoliciesQueryDto) {
    return this.pricingPoliciesService.findAll(query);
  }

  @Get('resolve')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  resolvePrice(@Query() query: ResolvePriceDto) {
    return this.pricingPoliciesService.resolvePrice(query);
  }

  @Get('history')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  findHistory(@Query() query: FindSalesPriceHistoryQueryDto) {
    return this.pricingPoliciesService.findHistory(query);
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  findOne(@Param('_id') recordId: string) {
    return this.pricingPoliciesService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT')
  update(@Param('_id') recordId: string, @Body() dto: UpdatePricingPolicyDto) {
    return this.pricingPoliciesService.update(recordId, dto);
  }

  @Delete(':_id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('_id') recordId: string, @User() user: RequestUser) {
    return this.pricingPoliciesService.remove(recordId, user);
  }

  @Post(':_id/submit-approval')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT')
  submitForApproval(@Param('_id') recordId: string, @User() user: RequestUser) {
    return this.pricingPoliciesService.submitForApproval(recordId, user);
  }

  @Post(':_id/approve')
  @Roles('ADMIN', 'MANAGER')
  approve(
    @Param('_id') recordId: string,
    @User() user: RequestUser,
    @Body('note') note?: string,
  ) {
    return this.pricingPoliciesService.approve(recordId, user, note);
  }

  @Post(':_id/reject')
  @Roles('ADMIN', 'MANAGER')
  reject(
    @Param('_id') recordId: string,
    @User() user: RequestUser,
    @Body('reason') reason: string,
  ) {
    return this.pricingPoliciesService.reject(recordId, reason, user);
  }
}
