import { Controller, Get } from '@nestjs/common';
import { LandingService } from './landing.service';
import { Public } from '@/decorator/customize';

@Controller('landing')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Public()
  @Get('summary')
  async getSummary() {
    return {
      data: await this.landingService.getSummary(),
    };
  }
}
