import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '@/auth/passport/jwt-auth.guard';
import { User } from '@/decorator/customize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

@Controller('dashboards')
export class KpiDashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get()
  async getAdminDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @User() user?: AuthenticatedUser,
  ): Promise<unknown> {
    return this.dashboardsService.getAdminDashboard(startDate, endDate, user);
  }

  @Get('kpi-drilldown')
  async getKpiDrilldown(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @User() user?: AuthenticatedUser,
  ): Promise<unknown> {
    return this.dashboardsService.getKpiDrilldown(startDate, endDate, user);
  }

  @Get('executive')
  async getExecutiveDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @User() user?: AuthenticatedUser,
  ): Promise<unknown> {
    return this.dashboardsService.getExecutiveDashboard(
      startDate,
      endDate,
      user,
    );
  }

  @Get('portal/summary')
  @UseGuards(JwtAuthGuard)
  async getPortalSummary(@User() user?: AuthenticatedUser): Promise<unknown> {
    return this.dashboardsService.getPortalSummary(user);
  }
}
