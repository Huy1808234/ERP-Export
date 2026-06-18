import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProformaInvoicesService } from './proforma-invoices.service';
import {
  CreateProformaInvoiceDto,
  ConvertQuotationToPiDto,
} from './dto/create-proforma-invoice.dto';
import { UpdateProformaInvoiceDto } from './dto/update-proforma-invoice.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { PIStatus } from './entities/proforma-invoice.entity';
import type { QueryParams } from '@/common/types/authenticated-user.type';

@Controller('proforma-invoices')
export class ProformaInvoicesController {
  constructor(private readonly piService: ProformaInvoicesService) {}

  @Post()
  @ResponseMessage('Create proforma invoice successfully')
  create(
    @Body() createPiDto: CreateProformaInvoiceDto,
    @User() user: UserEntity,
  ) {
    return this.piService.create(createPiDto, user);
  }

  @Post('from-quotation')
  @ResponseMessage('Convert quotation to PI successfully')
  convert(
    @Body() convertDto: ConvertQuotationToPiDto,
    @User() user: UserEntity,
  ) {
    return this.piService.createFromQuotation(convertDto, user);
  }

  @Get()
  @ResponseMessage('Fetch all PIs with pagination')
  findAll(@Query() query: QueryParams) {
    return this.piService.findAll(query);
  }

  @Get(':_id')
  @ResponseMessage('Fetch PI by recordId')
  findOne(@Param('_id') recordId: string) {
    return this.piService.findOne(recordId);
  }

  @Patch(':_id')
  @ResponseMessage('Update PI successfully')
  update(
    @Param('_id') recordId: string,
    @Body() updatePiDto: UpdateProformaInvoiceDto,
  ) {
    return this.piService.update(recordId, updatePiDto);
  }

  @Patch(':_id/status')
  @ResponseMessage('Update PI status')
  updateStatus(
    @Param('_id') recordId: string,
    @Body('status') status: PIStatus,
    @User() user: UserEntity,
  ) {
    return this.piService.updateStatus(recordId, status, user);
  }

  @Delete(':_id')
  @ResponseMessage('Delete PI successfully')
  remove(@Param('_id') recordId: string) {
    return this.piService.remove(recordId);
  }
}
