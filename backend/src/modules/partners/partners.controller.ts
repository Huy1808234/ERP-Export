import { 
  Body, 
  Controller, 
  Delete, 
  DefaultValuePipe, 
  Get, 
  Param, 
  ParseIntPipe, 
  Patch, 
  Post, 
  Query, 
  Request, 
  Res,
  UseGuards
} from '@nestjs/common';
import * as express from 'express';
import { Roles } from '@/decorator/customize'; // Giữ nguyên decorator của bạn
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnersService } from './partners.service';

@Controller('partners') // Bỏ Roles ở đây để phân quyền chi tiết cho từng API
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'PURCHASING') // Các role được quyền tạo
  create(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'ACCOUNTANT')
  async exportExcel(@Query() query: any, @Res() res: express.Response) {
    const buffer = await this.partnersService.exportExcel(query);
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Partners_Export_${new Date().getTime()}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'ACCOUNTANT', 'LOGISTICS') // Ai cũng được xem list
  async findAll(
    // Sử dụng DefaultValuePipe và ParseIntPipe để an toàn tuyệt đối
    @Query('current', new DefaultValuePipe(1), ParseIntPipe) current: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query() query: any, // Nhận toàn bộ filter còn lại dưới dạng Object
  ) {
    // Xóa current và pageSize ra khỏi query object để tránh truyền query rác vào TypeORM
    delete query.current;
    delete query.pageSize;
    
    return this.partnersService.findAll(query, current, pageSize);
  }

  @Get(':id/history')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT')
  getPartnerHistory(@Param('id') id: string) {
    return this.partnersService.getPartnerHistory(id);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'ACCOUNTANT')
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'DIRECTOR', 'SALES_EXPORT') 
  update(
    @Param('id') id: string, 
    @Body() updatePartnerDto: UpdatePartnerDto, 
    @Request() req: any
  ) {
    // Lấy tên Role từ object Role của User (AuthGuard bóc tách từ JWT)
    const userRole = req.user?.role?.name || req.user?.role; 
    
    // Pass role xuống Service để check logic "Cấp hạn mức tín dụng cho khách hàng HIGH RISK"
    return this.partnersService.update(id, updatePartnerDto, userRole);
  }

  @Post('bulk-delete')
  @Roles('ADMIN', 'DIRECTOR')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.partnersService.bulkRemove(ids);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DIRECTOR') // Xóa khách hàng là hành động nhạy cảm, chỉ role cao nhất được làm
  remove(@Param('id') id: string) {
    return this.partnersService.remove(id);
  }
}