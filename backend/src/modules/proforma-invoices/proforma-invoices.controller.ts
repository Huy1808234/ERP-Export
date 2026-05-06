import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProformaInvoicesService } from './proforma-invoices.service';
import { CreateProformaInvoiceDto, ConvertQuotationToPiDto } from './dto/create-proforma-invoice.dto';
import { UpdateProformaInvoiceDto } from './dto/update-proforma-invoice.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { PIStatus } from './entities/proforma-invoice.entity';

@Controller('proforma-invoices')
export class ProformaInvoicesController {
  constructor(private readonly piService: ProformaInvoicesService) {}

  @Post()
  @ResponseMessage('Create proforma invoice successfully')
  create(@Body() createPiDto: CreateProformaInvoiceDto, @User() user: UserEntity) {
    return this.piService.create(createPiDto, user);
  }

  @Post('from-quotation')
  @ResponseMessage('Convert quotation to PI successfully')
  convert(@Body() convertDto: ConvertQuotationToPiDto, @User() user: UserEntity) {
    return this.piService.createFromQuotation(convertDto, user);
  }

  @Get()
  @ResponseMessage('Fetch all PIs with pagination')
  findAll(@Query() query: string) {
    return this.piService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Fetch PI by id')
  findOne(@Param('id') id: string) {
    return this.piService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update PI successfully')
  update(@Param('id') id: string, @Body() updatePiDto: UpdateProformaInvoiceDto) {
    return this.piService.update(id, updatePiDto);
  }

  @Patch(':id/status')
  @ResponseMessage('Update PI status')
  updateStatus(@Param('id') id: string, @Body('status') status: PIStatus) {
    return this.piService.updateStatus(id, status);
  }
}
