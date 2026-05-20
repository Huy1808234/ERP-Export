import * as express from 'express';
import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User, Roles, Public } from '@/decorator/customize';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductChangeRequestDto } from './dto/create-product-change-request.dto';
import { ProductChangeDecisionDto } from './dto/product-change-decision.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('import')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: any, @User() user: any) {
    return this.productsService.importExcel(file.buffer, user);
  }

  @Get('public')
  @Public()
  findAllPublic(
    @Query('current', new DefaultValuePipe(1), ParseIntPipe) current: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query() query: any,
  ) {
    delete query.current;
    delete query.pageSize;
    return this.productsService.findAllPublic(query, current, pageSize);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'ACCOUNTANT')
  async exportExcel(@Query() query: any, @Res() res: express.Response, @User() user: any) {
    const buffer = await this.productsService.exportExcel(query, user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Products_Export_${new Date().getTime()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  create(@Body() createProductDto: CreateProductDto, @User() user: any) {
    return this.productsService.create(createProductDto, user);
  }

  @Get('change-requests')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'ACCOUNTANT')
  findChangeRequests(
    @Query('current', new DefaultValuePipe(1), ParseIntPipe) current: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query() query: any,
    @User() user: any,
  ) {
    delete query.current;
    delete query.pageSize;
    return this.productsService.findChangeRequests(query, current, pageSize, user);
  }

  @Patch('change-requests/:_id/approve')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  approveChangeRequest(
    @Param('_id') recordId: string,
    @Body() dto: ProductChangeDecisionDto,
    @User() user: any,
  ) {
    return this.productsService.approveChangeRequest(recordId, dto, user);
  }

  @Patch('change-requests/:_id/reject')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  rejectChangeRequest(
    @Param('_id') recordId: string,
    @Body() dto: ProductChangeDecisionDto,
    @User() user: any,
  ) {
    return this.productsService.rejectChangeRequest(recordId, dto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'LOGISTICS', 'ACCOUNTANT')
  findAll(
    @Query('current', new DefaultValuePipe(1), ParseIntPipe) current: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query() query: any,
    @User() user: any,
  ) {
    delete query.current;
    delete query.pageSize;
    return this.productsService.findAll(query, current, pageSize, user);
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'LOGISTICS', 'ACCOUNTANT')
  findOne(@Param('_id') recordId: string, @User() user: any) {
    return this.productsService.findOne(recordId, user);
  }

  @Get(':_id/versions')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'ACCOUNTANT')
  findProductVersions(@Param('_id') recordId: string, @User() user: any) {
    return this.productsService.findProductVersions(recordId, user);
  }

  @Post(':_id/change-requests')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  createChangeRequest(
    @Param('_id') recordId: string,
    @Body() dto: CreateProductChangeRequestDto,
    @User() user: any,
  ) {
    return this.productsService.createChangeRequest(recordId, dto, user);
  }

  @Get(':_id/convert-uom')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'LOGISTICS', 'ACCOUNTANT')
  convertUom(
    @Param('_id') recordId: string,
    @Query('quantity') quantity: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.productsService.convertUom(recordId, quantity, from, to);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  update(
    @Param('_id') recordId: string,
    @Body() updateProductDto: UpdateProductDto,
    @User() user: any,
  ) {
    return this.productsService.update(recordId, updateProductDto, user);
  }

  @Post('bulk-delete')
  @Roles('ADMIN', 'MANAGER')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.productsService.bulkRemove(ids);
  }

  @Delete(':_id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('_id') recordId: string) {
    return this.productsService.remove(recordId);
  }
}
