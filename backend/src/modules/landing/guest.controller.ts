import { Controller, Get, Param } from '@nestjs/common';
import { GuestService } from './guest.service';
import { Public } from '@/decorator/customize';

@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Public()
  @Get('summary')
  async getSummary() {
    console.log("[GuestController] Fetching summary");
    return this.guestService.getSummary();
  }

  @Public()
  @Get('track/:number')
  async trackShipment(@Param('number') number: string) {
    console.log("[GuestController] Tracking shipment:", number);
    return this.guestService.trackShipment(number);
  }

  @Public()
  @Get('products')
  async getFeaturedProducts() {
    console.log("[GuestController] Fetching featured products");
    return this.guestService.getFeaturedProducts();
  }
}
