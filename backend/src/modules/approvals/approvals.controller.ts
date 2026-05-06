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
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Fetch all pending approvals')
  getPendingApprovals() {
    return this.approvalsService.getPendingApprovals();
  }

  @Post(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Approved successfully')
  approve(
    @Param('id') id: string,
    @Body('type') type: string,
    @User() user: any
  ) {
    return this.approvalsService.approve(id, type, user);
  }

  @Post(':id/reject')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Rejected successfully')
  reject(
    @Param('id') id: string,
    @Body('type') type: string,
    @Body('reason') reason: string,
    @User() user: any
  ) {
    return this.approvalsService.reject(id, type, reason, user);
  }
}
