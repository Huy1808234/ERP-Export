import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles, User } from '@/decorator/customize';
import type {
  AuthenticatedUser,
  QueryParams,
} from '@/common/types/authenticated-user.type';
import { ApprovalMatrixService } from './approval-matrix.service';
import { ApprovalPolicyService } from './approval-policy.service';
import { CreateApprovalRuleDto, UpdateApprovalRuleDto } from './dto/approval-rule.dto';
import { ApprovalActionDto, CreateApprovalWorkflowRequestDto } from './dto/approval-workflow.dto';

@Controller('approval-matrix')
export class ApprovalMatrixController {
  constructor(
    private readonly approvalMatrixService: ApprovalMatrixService,
    private readonly approvalPolicyService: ApprovalPolicyService,
  ) {}

  @Get('policy')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  findPolicy() {
    return {
      actions: this.approvalPolicyService.findAll(),
      matrixRequired: this.approvalPolicyService.findMatrixRequired(),
      legacyDirectReview: this.approvalPolicyService.findLegacyDirectReview(),
    };
  }

  @Post('rules')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER')
  createRule(@Body() dto: CreateApprovalRuleDto, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.createRule(dto, user);
  }

  @Get('rules')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  findRules(@Query() query: QueryParams) {
    return this.approvalMatrixService.findRules(query);
  }

  @Get('rules/:_id')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  findRule(@Param('_id') recordId: string) {
    return this.approvalMatrixService.findRule(recordId);
  }

  @Patch('rules/:_id')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER')
  updateRule(@Param('_id') recordId: string, @Body() dto: UpdateApprovalRuleDto, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.updateRule(recordId, dto, user);
  }

  @Delete('rules/:_id')
  @Roles('ADMIN', 'DIRECTOR')
  deactivateRule(@Param('_id') recordId: string, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.deactivateRule(recordId, user);
  }

  @Post('requests')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  createRequest(@Body() dto: CreateApprovalWorkflowRequestDto, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.createRequest(dto, user);
  }

  @Get('requests')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  findRequests(@Query() query: QueryParams) {
    return this.approvalMatrixService.findRequests(query);
  }

  @Get('requests/pending')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  findPendingForUser(@User() user: AuthenticatedUser) {
    return this.approvalMatrixService.findPendingForUser(user);
  }

  @Patch('requests/:_id/approve')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  approveRequest(@Param('_id') recordId: string, @Body() dto: ApprovalActionDto, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.approveRequest(recordId, dto, user);
  }

  @Patch('requests/:_id/reject')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  rejectRequest(@Param('_id') recordId: string, @Body() dto: ApprovalActionDto, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.rejectRequest(recordId, dto, user);
  }

  @Patch('requests/:_id/cancel')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'SALES_EXPORT', 'PURCHASING', 'LOGISTICS', 'WAREHOUSE', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  cancelRequest(@Param('_id') recordId: string, @Body() dto: ApprovalActionDto, @User() user: AuthenticatedUser) {
    return this.approvalMatrixService.cancelRequest(recordId, dto, user);
  }
}
