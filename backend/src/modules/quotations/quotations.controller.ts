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
  create(
    @Body() createQuotationDto: CreateQuotationDto,
    @User() user: UserEntity,
  ) {
    return this.quotationsService.create(createQuotationDto, user);
  }

  @Get()
  @ResponseMessage('Fetch all quotations with pagination')
  findAll(
    @Query() query: string,
    @Query('current') current: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.quotationsService.findAll(query, +current, +pageSize);
  }

  @Get(':_id')
  @ResponseMessage('Fetch quotation by recordId')
  findOne(@Param('_id') recordId: string) {
    return this.quotationsService.findOne(recordId);
  }

  @Patch(':_id')
  @ResponseMessage('Update quotation successfully')
  update(
    @Param('_id') recordId: string,
    @Body() updateQuotationDto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(recordId, updateQuotationDto);
  }

  @Post('bulk-delete')
  @ResponseMessage('Bulk soft delete quotations')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.quotationsService.bulkRemove(ids);
  }

  @Delete(':_id')
  @ResponseMessage('Soft delete quotation')
  remove(@Param('_id') recordId: string) {
    return this.quotationsService.remove(recordId);
  }

  @Patch(':_id/status')
  @ResponseMessage('Update quotation status')
  updateStatus(
    @Param('_id') recordId: string,
    @Body('status') status: QuotationStatus,
    @User() user: UserEntity,
  ) {
    return this.quotationsService.updateStatus(recordId, status, user);
  }
}
