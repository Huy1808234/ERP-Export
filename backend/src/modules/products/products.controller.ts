import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@/decorator/customize';
import * as express from 'express';
import { Roles } from '@/decorator/customize';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('import')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: any) {
    return this.productsService.importExcel(file.buffer);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'ACCOUNTANT')
  async exportExcel(@Query() query: any, @Res() res: express.Response) {
    const buffer = await this.productsService.exportExcel(query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Products_Export_${new Date().getTime()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
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

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'LOGISTICS', 'ACCOUNTANT')
  findOne(@Param('id') id: string, @User() user: any) {
    return this.productsService.findOne(id, user);
  }

  @Get(':id/convert-uom')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING', 'SALES_EXPORT', 'LOGISTICS', 'ACCOUNTANT')
  convertUom(
    @Param('id') id: string,
    @Query('quantity') quantity: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.productsService.convertUom(id, quantity, from, to);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'PURCHASING')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Post('bulk-delete')
  @Roles('ADMIN', 'MANAGER')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.productsService.bulkRemove(ids);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
