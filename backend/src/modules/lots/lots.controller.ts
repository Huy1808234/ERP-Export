import { Controller, Get, Query } from '@nestjs/common';
import { LotsService } from './lots.service';

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.lotsService.findAll(query);
  }

  @Get(':lotNumber')
  findOne(@Query('lotNumber') lotNumber: string) {
    return this.lotsService.findByLotNumber(lotNumber);
  }
}
