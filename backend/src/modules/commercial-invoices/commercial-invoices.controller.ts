import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ResponseMessage, User, RequirePermissions } from '@/decorator/customize';
import { maskCostFields } from '@/common/field-access.util';
import { CommercialInvoicesService } from './commercial-invoices.service';
import {
  CancelCommercialInvoiceDto,
  CreateCommercialInvoiceFromShipmentDto,
  IssueCommercialInvoiceDto,
} from './dto/create-commercial-invoice.dto';

type PermissionLike = string | { name?: unknown; code?: unknown; apiPath?: unknown };

type CommercialInvoiceRequestUser = {
  username?: string;
  role?: string | { name?: unknown; permissions?: PermissionLike[] };
  roleName?: unknown;
  permissions?: PermissionLike[];
};

@Controller('commercial-invoices')
export class CommercialInvoicesController {
  constructor(private readonly commercialInvoicesService: CommercialInvoicesService) {}

  private readonly commercialInvoicePriceFields = [
    'exchangeRate',
    'subtotalForeign',
    'taxAmountForeign',
    'totalAmountForeign',
    'totalAmountVnd',
    'unitPriceForeign',
    'lineAmountForeign',
  ];

  @Get()
  @RequirePermissions('read:export_document')
  @ResponseMessage('Fetch commercial invoices')
  async findAll(
    @Query() query: Record<string, string | undefined>,
    @User() user: CommercialInvoiceRequestUser,
  ) {
    const result = await this.commercialInvoicesService.findAll(query);
    return maskCostFields(result, user, this.commercialInvoicePriceFields);
  }

  @Get(':_id')
  @RequirePermissions('read:export_document')
  @ResponseMessage('Fetch commercial invoice detail')
  async findOne(@Param('_id') recordId: string, @User() user: CommercialInvoiceRequestUser) {
    const result = await this.commercialInvoicesService.findOne(recordId);
    return maskCostFields(result, user, this.commercialInvoicePriceFields);
  }

  @Post('from-shipment/:_id')
  @RequirePermissions('write:export_document')
  @ResponseMessage('Create commercial invoice draft from shipment')
  async createFromShipment(
    @Param('_id') shipment_id: string,
    @Body() dto: CreateCommercialInvoiceFromShipmentDto,
    @User() user: CommercialInvoiceRequestUser,
  ) {
    const result = await this.commercialInvoicesService.createFromShipment(shipment_id, dto, user);
    return maskCostFields(result, user, this.commercialInvoicePriceFields);
  }

  @Patch(':_id/issue')
  @RequirePermissions('write:export_document')
  @ResponseMessage('Issue commercial invoice')
  async issue(
    @Param('_id') recordId: string,
    @Body() dto: IssueCommercialInvoiceDto,
    @User() user: CommercialInvoiceRequestUser,
  ) {
    const result = await this.commercialInvoicesService.issue(recordId, dto, user);
    return maskCostFields(result, user, this.commercialInvoicePriceFields);
  }

  @Patch(':_id/cancel')
  @RequirePermissions('write:export_document')
  @ResponseMessage('Cancel commercial invoice draft')
  async cancel(
    @Param('_id') recordId: string,
    @Body() dto: CancelCommercialInvoiceDto,
    @User() user: CommercialInvoiceRequestUser,
  ) {
    const result = await this.commercialInvoicesService.cancel(recordId, dto, user);
    return maskCostFields(result, user, this.commercialInvoicePriceFields);
  }
}
