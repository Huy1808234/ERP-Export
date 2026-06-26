import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ResponseMessage,
  User,
  RequirePermissions,
} from '@/decorator/customize';
import { maskCostFields } from '@/common/field-access.util';
import { CommercialInvoicesService } from './commercial-invoices.service';
import {
  CancelCommercialInvoiceDto,
  CreateCommercialInvoiceFromShipmentDto,
  IssueCommercialInvoiceDto,
} from './dto/create-commercial-invoice.dto';
import {
  generateCommercialInvoicePdf,
  buildInvoicePdfData,
  CompanyInfo,
} from './commercial-invoice-pdf.service';
import { SettingsService } from '@/modules/settings/settings.service';

type PermissionLike =
  | string
  | { name?: unknown; code?: unknown; apiPath?: unknown };

type CommercialInvoiceRequestUser = {
  username?: string;
  role?: string | { name?: unknown; permissions?: PermissionLike[] };
  roleName?: unknown;
  permissions?: PermissionLike[];
};

@Controller('commercial-invoices')
export class CommercialInvoicesController {
  constructor(
    private readonly commercialInvoicesService: CommercialInvoicesService,
    private readonly settingsService: SettingsService,
  ) {}

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
  async findOne(
    @Param('_id') recordId: string,
    @User() user: CommercialInvoiceRequestUser,
  ) {
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
    const result = await this.commercialInvoicesService.createFromShipment(
      shipment_id,
      dto,
      user,
    );
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
    const result = await this.commercialInvoicesService.issue(
      recordId,
      dto,
      user,
    );
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
    const result = await this.commercialInvoicesService.cancel(
      recordId,
      dto,
      user,
    );
    return maskCostFields(result, user, this.commercialInvoicePriceFields);
  }

  @Get(':_id/export-pdf')
  @RequirePermissions('read:export_document')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(
    @Param('_id') recordId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.commercialInvoicesService.findOne(recordId);
    
    const seller: CompanyInfo = {
      name: 'ANTIGRAVITY EXPORT CO., LTD',
      address: '123 Export Street, Dist 1, HCMC, Vietnam',
      bankInfo: `Bank Name: VIETCOMBANK\nBeneficiary: CÔNG TY TNHH XUẤT NHẬP KHẨU ANTIGRAVITY\nAccount Number: 0123456789\nSwift Code: BFTVVNVX`,
      phone: '+84 28 1234 5678',
      email: 'export@antigravity.com',
    };

    const pdfData = buildInvoicePdfData(
      invoice,
      invoice.salesContract,
      invoice.shipment,
      seller,
    );

    const pdfBuffer = await generateCommercialInvoicePdf(pdfData);
    
    const filename = `CI-${invoice.invoiceNumber}.pdf`.replace(/\//g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(pdfBuffer);
  }
}
