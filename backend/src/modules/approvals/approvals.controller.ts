import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApprovalsService } from '@/modules/approvals/approvals.service';
import { JwtAuthGuard } from '@/auth/passport/jwt-auth.guard';
import { RolesGuard } from '@/auth/passport/roles.guard';
import { ResponseMessage, User, Roles } from '@/decorator/customize';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  @ResponseMessage('Fetch all pending approvals')
  getPendingApprovals(@User() user: any) {
    return this.approvalsService.getPendingApprovals(user);
  }

  @Post(':_id/approve')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  @ResponseMessage('Approved successfully')
  approve(
    @Param('_id') recordId: string,
    @Body('type') type: string,
    @User() user: any
  ) {
    return this.approvalsService.approve(recordId, type, user);
  }

  @Post(':_id/reject')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  @ResponseMessage('Rejected successfully')
  reject(
    @Param('_id') recordId: string,
    @Body('type') type: string,
    @Body('reason') reason: string,
    @User() user: any
  ) {
    return this.approvalsService.reject(recordId, type, reason, user);
  }
}
