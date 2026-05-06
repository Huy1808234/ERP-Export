import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '@/auth/passport/jwt-auth.guard';

@Controller('dashboards')
export class KpiDashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('executive')
  @UseGuards(JwtAuthGuard)
  async getExecutiveDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardsService.getExecutiveDashboard(startDate, endDate);
  }
}
