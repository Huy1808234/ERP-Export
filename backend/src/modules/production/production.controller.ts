import { Controller, Post, Body, Get, Param, Query, Patch } from '@nestjs/common';
import { ProductionService } from './production.service';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import { User as CurrentUser } from '@/decorator/customize';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('orders')
  createOrder(@Body() data: any, @CurrentUser() user: UserEntity) {
    return this.productionService.createOrder(data, user);
  }

  @Get('orders')
  findAll(@Query() query: any) {
    return this.productionService.findAll(query);
  }

  @Patch('orders/:id/start')
  start(@Param('id') id: string) {
    return this.productionService.startProduction(id);
  }

  @Post('orders/:id/complete')
  complete(@Param('id') id: string, @Body('outputs') outputs: any[]) {
    return this.productionService.completeProduction(id, outputs);
  }
}
