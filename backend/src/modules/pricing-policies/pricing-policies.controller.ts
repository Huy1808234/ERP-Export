import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles, User } from '@/decorator/customize';
import { PricingPoliciesService } from './pricing-policies.service';
import { CreatePricingPolicyDto } from './dto/create-pricing-policy.dto';
import { UpdatePricingPolicyDto } from './dto/update-pricing-policy.dto';
import { ResolvePriceDto } from './dto/resolve-price.dto';

@Controller('pricing-policies')
export class PricingPoliciesController {
  constructor(private readonly pricingPoliciesService: PricingPoliciesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT')
  create(@Body() dto: CreatePricingPolicyDto, @User() user: any) {
    return this.pricingPoliciesService.create(dto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  findAll(@Query() query: any) {
    return this.pricingPoliciesService.findAll(query);
  }

  @Get('resolve')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  resolvePrice(@Query() query: ResolvePriceDto) {
    return this.pricingPoliciesService.resolvePrice(query);
  }

  @Get('history')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  findHistory(@Query() query: any) {
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
  remove(@Param('_id') recordId: string) {
    return this.pricingPoliciesService.remove(recordId);
  }
}
