import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { ResponseMessage, User } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { QuotationStatus } from './entities/quotation.entity';

@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @ResponseMessage('Create quotation successfully')
  create(@Body() createQuotationDto: CreateQuotationDto, @User() user: UserEntity) {
    return this.quotationsService.create(createQuotationDto, user);
  }

  @Get()
  @ResponseMessage('Fetch all quotations with pagination')
  findAll(@Query() query: string) {
    return this.quotationsService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Fetch quotation by id')
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update quotation successfully')
  update(@Param('id') id: string, @Body() updateQuotationDto: UpdateQuotationDto) {
    return this.quotationsService.update(id, updateQuotationDto);
  }

  @Post('bulk-delete')
  @ResponseMessage('Bulk soft delete quotations')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.quotationsService.bulkRemove(ids);
  }

  @Delete(':id')
  @ResponseMessage('Soft delete quotation')
  remove(@Param('id') id: string) {
    return this.quotationsService.remove(id);
  }

  @Patch(':id/status')
  @ResponseMessage('Update quotation status')
  updateStatus(@Param('id') id: string, @Body('status') status: QuotationStatus) {
    return this.quotationsService.updateStatus(id, status);
  }
}
