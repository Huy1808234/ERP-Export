import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import type {
  AuthenticatedUser,
  QueryParams,
} from '@/common/types/authenticated-user.type';
import { normalizeRoleName } from '@/common/auth/role-catalog';
import {
  ApprovalDocumentType,
  ApprovalRule,
  ApprovalRuleStep,
} from './entities/approval-rule.entity';
import {
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalWorkflowRequest,
  ApprovalWorkflowStep,
} from './entities/approval-workflow.entity';
import {
  CreateApprovalRuleDto,
  ApprovalRuleStepDto,
  UpdateApprovalRuleDto,
} from './dto/approval-rule.dto';
import {
  ApprovalActionDto,
  CreateApprovalWorkflowRequestDto,
} from './dto/approval-workflow.dto';
import {
  APPROVAL_WORKFLOW_REQUESTED_EVENT,
  APPROVAL_WORKFLOW_APPROVED_EVENT,
  APPROVAL_WORKFLOW_REJECTED_EVENT,
  ApprovalWorkflowRequestedEvent,
  ApprovalWorkflowDecisionEvent,
} from './approval-workflow.events';

@Injectable()
export class ApprovalMatrixService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(ApprovalRule)
    private readonly ruleRepository: Repository<ApprovalRule>,
    @InjectRepository(ApprovalRuleStep)
    private readonly ruleStepRepository: Repository<ApprovalRuleStep>,
    @InjectRepository(ApprovalWorkflowRequest)
    private readonly requestRepository: Repository<ApprovalWorkflowRequest>,
    @InjectRepository(ApprovalWorkflowStep)
    private readonly workflowStepRepository: Repository<ApprovalWorkflowStep>,
  ) {}

  private getActorUsername(user?: AuthenticatedUser) {
    return user?.username || user?.name || 'system';
  }

  private getActorRoleName(user?: AuthenticatedUser) {
    const role = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return normalizeRoleName(role);
  }

  private normalizeRole(roleName: string) {
    return normalizeRoleName(roleName);
  }

  private normalizeCurrency(currency?: string | null) {
    return currency?.trim().toUpperCase() || null;
  }

  private buildRuleCode(documentType: ApprovalDocumentType) {
    const suffix = createOpaqueCode('approval_rule_no')
      .split('_')
      .pop()
      ?.toUpperCase();
    return `APR-${documentType}-${suffix}`;
  }

  private normalizeSteps(steps: ApprovalRuleStepDto[]) {
    const seen = new Set<number>();
    const normalized = steps
      .map((step) => ({
        ...step,
        stepOrder: Number(step.stepOrder),
        approverRoleName: this.normalizeRole(step.approverRoleName),
        approverUsername: step.approverUsername?.trim() || null,
        label: step.label?.trim() || null,
        isRequired: step.isRequired ?? true,
      }))
      .sort((a, b) => a.stepOrder - b.stepOrder);

    for (const step of normalized) {
      if (seen.has(step.stepOrder)) {
        throw new BadRequestException(
          `Duplicate approval step order: ${step.stepOrder}`,
        );
      }
      seen.add(step.stepOrder);
    }

    return normalized;
  }

  private canActOnStep(step: ApprovalWorkflowStep, user?: AuthenticatedUser) {
    const username = this.getActorUsername(user);
    const roleName = this.getActorRoleName(user);

    if (roleName === 'ADMIN') return true;
    if (step.approverUsername && step.approverUsername === username)
      return true;
    return step.approverRoleName === roleName;
  }

  private buildDecisionEvent(
    request: ApprovalWorkflowRequest,
    status: ApprovalWorkflowDecisionEvent['status'],
    actorUsername: string,
    reason?: string | null,
  ): ApprovalWorkflowDecisionEvent {
    return {
      requestId: request._id,
      documentType: request.documentType,
      documentId: request.documentId,
      documentNumber: request.documentNumber,
      status,
      actorUsername,
      reason: reason || null,
      metadata: request.metadata || {},
    };
  }

  async createRule(dto: CreateApprovalRuleDto, user?: AuthenticatedUser) {
    const steps = this.normalizeSteps(dto.steps);
    const code = dto.code?.trim() || this.buildRuleCode(dto.documentType);

    return this.dataSource.transaction(async (manager) => {
      const exists = await manager.findOne(ApprovalRule, { where: { code } });
      if (exists)
        throw new BadRequestException(
          `Approval rule code already exists: ${code}`,
        );

      const rule = manager.create(ApprovalRule, {
        code,
        name: dto.name.trim(),
        documentType: dto.documentType,
        currency: this.normalizeCurrency(dto.currency),
        minAmountVnd: Number(dto.minAmountVnd || 0),
        maxAmountVnd:
          dto.maxAmountVnd === undefined || dto.maxAmountVnd === null
            ? null
            : Number(dto.maxAmountVnd),
        priority: Number(dto.priority || 100),
        isActive: dto.isActive ?? true,
        description: dto.description?.trim() || null,
        createdByUsername: this.getActorUsername(user),
        updatedByUsername: null,
      });

      const savedRule = await manager.save(rule);
      await manager.save(
        ApprovalRuleStep,
        steps.map((step) =>
          manager.create(ApprovalRuleStep, {
            ...step,
            ruleId: savedRule._id,
          }),
        ),
      );

      return manager.findOne(ApprovalRule, {
        where: { _id: savedRule._id },
        relations: ['steps'],
        order: { steps: { stepOrder: 'ASC' } },
      });
    });
  }

  async findRules(query: QueryParams = {}) {
    const qb = this.ruleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.steps', 'steps')
      .orderBy('rule.priority', 'ASC')
      .addOrderBy('rule.updatedAt', 'DESC')
      .addOrderBy('steps.stepOrder', 'ASC');

    if (query.documentType)
      qb.andWhere('rule.documentType = :documentType', {
        documentType: query.documentType,
      });
    if (query.isActive !== undefined) {
      qb.andWhere('rule.isActive = :isActive', {
        isActive: String(query.isActive) === 'true',
      });
    }
    if (query.search) {
      qb.andWhere('(rule.code ILIKE :search OR rule.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    return qb.getMany();
  }

  async findRule(recordId: string) {
    const rule = await this.ruleRepository.findOne({
      where: { _id: recordId },
      relations: ['steps'],
      order: { steps: { stepOrder: 'ASC' } },
    });
    if (!rule) throw new NotFoundException('Approval rule not found');
    return rule;
  }

  async updateRule(recordId: string, dto: UpdateApprovalRuleDto, user?: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const rule = await manager.findOne(ApprovalRule, {
        where: { _id: recordId },
      });
      if (!rule) throw new NotFoundException('Approval rule not found');

      if (dto.name !== undefined) rule.name = dto.name.trim();
      if (dto.currency !== undefined)
        rule.currency = this.normalizeCurrency(dto.currency);
      if (dto.minAmountVnd !== undefined)
        rule.minAmountVnd = Number(dto.minAmountVnd);
      if (dto.maxAmountVnd !== undefined)
        rule.maxAmountVnd =
          dto.maxAmountVnd === null ? null : Number(dto.maxAmountVnd);
      if (dto.priority !== undefined) rule.priority = Number(dto.priority);
      if (dto.isActive !== undefined) rule.isActive = dto.isActive;
      if (dto.description !== undefined)
        rule.description = dto.description?.trim() || null;
      rule.updatedByUsername = this.getActorUsername(user);

      await manager.save(rule);

      if (dto.steps) {
        const steps = this.normalizeSteps(dto.steps);
        await manager.delete(ApprovalRuleStep, { ruleId: recordId });
        await manager.save(
          ApprovalRuleStep,
          steps.map((step) =>
            manager.create(ApprovalRuleStep, { ...step, ruleId: recordId }),
          ),
        );
      }

      return manager.findOne(ApprovalRule, {
        where: { _id: recordId },
        relations: ['steps'],
        order: { steps: { stepOrder: 'ASC' } },
      });
    });
  }

  async deactivateRule(recordId: string, user?: AuthenticatedUser) {
    const rule = await this.findRule(recordId);
    rule.isActive = false;
    rule.updatedByUsername = this.getActorUsername(user);
    return this.ruleRepository.save(rule);
  }

  async findMatchingRule(
    documentType: ApprovalDocumentType,
    amountVnd: number,
    currency?: string | null,
  ) {
    const normalizedCurrency = this.normalizeCurrency(currency);
    const rules = await this.ruleRepository.find({
      where: { documentType, isActive: true },
      relations: ['steps'],
      order: {
        priority: 'ASC',
        minAmountVnd: 'DESC',
        updatedAt: 'DESC',
        steps: { stepOrder: 'ASC' },
      },
    });

    return (
      rules.find((rule) => {
        const minAmount = Number(rule.minAmountVnd || 0);
        const maxAmount =
          rule.maxAmountVnd === null || rule.maxAmountVnd === undefined
            ? null
            : Number(rule.maxAmountVnd);
        const currencyMatches =
          !rule.currency ||
          !normalizedCurrency ||
          rule.currency === normalizedCurrency;
        return (
          currencyMatches &&
          amountVnd >= minAmount &&
          (maxAmount === null || amountVnd <= maxAmount)
        );
      }) || null
    );
  }

  async createRequestInTransaction(
    manager: EntityManager,
    dto: CreateApprovalWorkflowRequestDto,
    user?: AuthenticatedUser,
  ) {
      const existing = await manager.findOne(ApprovalWorkflowRequest, {
        where: {
          documentType: dto.documentType,
          documentId: dto.documentId,
          status: ApprovalRequestStatus.PENDING,
        },
      });
      if (existing)
        throw new BadRequestException(
          'This document already has a pending approval request',
        );

      const rule = dto.ruleId
        ? await manager.findOne(ApprovalRule, {
            where: { _id: dto.ruleId, isActive: true },
            relations: ['steps'],
          })
        : await this.findMatchingRule(
            dto.documentType,
            Number(dto.amountVnd || 0),
            dto.currency,
          );

      if (!rule) {
        throw new BadRequestException(
          'No active approval rule matches this document',
        );
      }

      const steps = [...(rule.steps || [])].sort(
        (a, b) => a.stepOrder - b.stepOrder,
      );
      if (!steps.length)
        throw new BadRequestException(
          'Approval rule must have at least one step',
        );

      const request = manager.create(ApprovalWorkflowRequest, {
        ruleId: rule._id,
        documentType: dto.documentType,
        documentId: dto.documentId,
        documentNumber: dto.documentNumber?.trim() || null,
        title: dto.title.trim(),
        currency: this.normalizeCurrency(dto.currency) || 'VND',
        amount: Number(dto.amount || dto.amountVnd || 0),
        amountVnd: Number(dto.amountVnd || 0),
        status: ApprovalRequestStatus.PENDING,
        currentStepOrder: steps[0].stepOrder,
        requesterUsername: this.getActorUsername(user),
        completedByUsername: null,
        completedAt: null,
        rejectionReason: null,
        metadata: dto.metadata || {},
      });

      const savedRequest = await manager.save(request);
      await manager.save(
        ApprovalWorkflowStep,
        steps.map((step) =>
          manager.create(ApprovalWorkflowStep, {
            requestId: savedRequest._id,
            stepOrder: step.stepOrder,
            approverRoleName: step.approverRoleName,
            approverUsername: step.approverUsername,
            status: ApprovalStepStatus.PENDING,
            actedByUsername: null,
            actedAt: null,
            note: null,
          }),
        ),
      );

      const requestWithSteps = await manager.findOne(ApprovalWorkflowRequest, {
        where: { _id: savedRequest._id },
        relations: ['rule', 'steps'],
        order: { steps: { stepOrder: 'ASC' } },
      });

      if (requestWithSteps) {
        const requestedEvent: ApprovalWorkflowRequestedEvent = {
          requestId: requestWithSteps._id,
          documentType: requestWithSteps.documentType,
          documentId: requestWithSteps.documentId,
          documentNumber: requestWithSteps.documentNumber,
          title: requestWithSteps.title,
          requesterUsername: requestWithSteps.requesterUsername,
          currentStepOrder: requestWithSteps.currentStepOrder,
          approverRoleNames: steps.map((step) => step.approverRoleName),
          approverUsernames: steps
            .map((step) => step.approverUsername)
            .filter((username): username is string => Boolean(username)),
          metadata: requestWithSteps.metadata || {},
        };
        this.eventEmitter.emit(APPROVAL_WORKFLOW_REQUESTED_EVENT, requestedEvent);
      }

      return requestWithSteps;
  }

  async createRequest(dto: CreateApprovalWorkflowRequestDto, user?: AuthenticatedUser) {
    return this.dataSource.transaction((manager) =>
      this.createRequestInTransaction(manager, dto, user),
    );
  }

  async findRequests(query: QueryParams = {}) {
    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.rule', 'rule')
      .leftJoinAndSelect('request.steps', 'steps')
      .orderBy('request.createdAt', 'DESC')
      .addOrderBy('steps.stepOrder', 'ASC');

    if (query.status)
      qb.andWhere('request.status = :status', { status: query.status });
    if (query.documentType)
      qb.andWhere('request.documentType = :documentType', {
        documentType: query.documentType,
      });
    if (query.search) {
      qb.andWhere(
        '(request.documentNumber ILIKE :search OR request.title ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return qb.getMany();
  }

  async findRequest(recordId: string) {
    const request = await this.requestRepository.findOne({
      where: { _id: recordId },
      relations: ['rule', 'steps'],
      order: { steps: { stepOrder: 'ASC' } },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    return request;
  }

  async findPendingForUser(user?: AuthenticatedUser) {
    const roleName = this.getActorRoleName(user);
    const username = this.getActorUsername(user);

    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.rule', 'rule')
      .leftJoinAndSelect('request.steps', 'steps')
      .where('request.status = :status', {
        status: ApprovalRequestStatus.PENDING,
      })
      .andWhere('steps.status = :stepStatus', {
        stepStatus: ApprovalStepStatus.PENDING,
      })
      .andWhere('steps.stepOrder = request.currentStepOrder')
      .orderBy('request.createdAt', 'DESC')
      .addOrderBy('steps.stepOrder', 'ASC');

    if (roleName !== 'ADMIN' && roleName !== 'SUPER ADMIN') {
      qb.andWhere(
        '(steps.approverRoleName = :roleName OR steps.approverUsername = :username)',
        { roleName, username },
      );
    }

    return qb.getMany();
  }

  private async loadRequestForAction(recordId: string) {
    const request = await this.requestRepository.findOne({
      where: { _id: recordId },
      relations: ['rule', 'steps'],
      order: { steps: { stepOrder: 'ASC' } },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending approval requests can be acted on',
      );
    }

    const currentStep = request.steps
      ?.sort((a, b) => a.stepOrder - b.stepOrder)
      .find(
        (step) =>
          step.status === ApprovalStepStatus.PENDING &&
          step.stepOrder === request.currentStepOrder,
      );

    if (!currentStep)
      throw new BadRequestException(
        'Approval request has no pending current step',
      );
    return { request, currentStep };
  }

  async approveRequest(recordId: string, dto: ApprovalActionDto, user?: AuthenticatedUser) {
    const actorUsername = this.getActorUsername(user);
    const result = await this.dataSource.transaction(async (manager) => {
      const { request, currentStep } =
        await this.loadRequestForAction(recordId);
      if (!this.canActOnStep(currentStep, user)) {
        throw new ForbiddenException(
          'You are not allowed to approve this step',
        );
      }

      currentStep.status = ApprovalStepStatus.APPROVED;
      currentStep.actedByUsername = actorUsername;
      currentStep.actedAt = new Date();
      currentStep.note = dto.note?.trim() || null;
      await manager.save(currentStep);

      const nextStep = request.steps
        .filter(
          (step) =>
            step.status === ApprovalStepStatus.PENDING &&
            step.stepOrder !== currentStep.stepOrder,
        )
        .sort((a, b) => a.stepOrder - b.stepOrder)[0];

      if (nextStep) {
        request.currentStepOrder = nextStep.stepOrder;
      } else {
        request.status = ApprovalRequestStatus.APPROVED;
        request.completedByUsername = actorUsername;
        request.completedAt = new Date();
      }

      await manager.save(request);
      return manager.findOne(ApprovalWorkflowRequest, {
        where: { _id: recordId },
        relations: ['rule', 'steps'],
        order: { steps: { stepOrder: 'ASC' } },
      });
    });

    if (result?.status === ApprovalRequestStatus.APPROVED) {
      await this.eventEmitter.emitAsync(
        APPROVAL_WORKFLOW_APPROVED_EVENT,
        this.buildDecisionEvent(
          result,
          ApprovalRequestStatus.APPROVED,
          actorUsername,
          dto.note,
        ),
      );
    }

    return result;
  }

  async rejectRequest(recordId: string, dto: ApprovalActionDto, user?: AuthenticatedUser) {
    const actorUsername = this.getActorUsername(user);
    const result = await this.dataSource.transaction(async (manager) => {
      const { request, currentStep } =
        await this.loadRequestForAction(recordId);
      if (!this.canActOnStep(currentStep, user)) {
        throw new ForbiddenException('You are not allowed to reject this step');
      }

      currentStep.status = ApprovalStepStatus.REJECTED;
      currentStep.actedByUsername = actorUsername;
      currentStep.actedAt = new Date();
      currentStep.note = dto.reason?.trim() || dto.note?.trim() || null;
      await manager.save(currentStep);

      request.status = ApprovalRequestStatus.REJECTED;
      request.completedByUsername = actorUsername;
      request.completedAt = new Date();
      request.rejectionReason =
        dto.reason?.trim() || dto.note?.trim() || 'Rejected';
      await manager.save(request);

      return manager.findOne(ApprovalWorkflowRequest, {
        where: { _id: recordId },
        relations: ['rule', 'steps'],
        order: { steps: { stepOrder: 'ASC' } },
      });
    });

    if (result?.status === ApprovalRequestStatus.REJECTED) {
      await this.eventEmitter.emitAsync(
        APPROVAL_WORKFLOW_REJECTED_EVENT,
        this.buildDecisionEvent(
          result,
          ApprovalRequestStatus.REJECTED,
          actorUsername,
          result.rejectionReason,
        ),
      );
    }

    return result;
  }

  async cancelRequest(recordId: string, dto: ApprovalActionDto, user?: AuthenticatedUser) {
    const request = await this.requestRepository.findOne({
      where: { _id: recordId },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only pending approval requests can be cancelled',
      );
    }

    request.status = ApprovalRequestStatus.CANCELLED;
    request.completedByUsername = this.getActorUsername(user);
    request.completedAt = new Date();
    request.rejectionReason =
      dto.reason?.trim() || dto.note?.trim() || 'Cancelled';
    return this.requestRepository.save(request);
  }
}
