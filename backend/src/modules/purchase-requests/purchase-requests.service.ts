import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
} from './entities/purchase-request.entity';
import { PurchaseRequestItem } from './entities/purchase-request-item.entity';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import type { IUser } from '../users/users.interface';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @InjectRepository(PurchaseRequest)
    private prRepository: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private prItemRepository: Repository<PurchaseRequestItem>,
    private dataSource: DataSource,
    private approvalMatrixService: ApprovalMatrixService,
  ) {}

  private calculateTotalAmount(pr: PurchaseRequest) {
    return (pr.items || []).reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.estimatedPrice || 0),
      0,
    );
  }

  async create(
    createPurchaseRequestDto: CreatePurchaseRequestDto,
    user: IUser,
  ) {
    const { items, ...prData } = createPurchaseRequestDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Generate PR Number (PR-YYYYMMDD-XXXX)
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await queryRunner.manager.count(PurchaseRequest);
      const prNumber = `PR-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      // 2. Create PR
      const pr = this.prRepository.create({
        ...prData,
        prNumber,
        createdByUsername: user.username,
        status: PurchaseRequestStatus.DRAFT,
      });

      const savedPr = await queryRunner.manager.save(pr);

      // 3. Create Items
      if (items && items.length > 0) {
        const prItems = items.map((item) =>
          this.prItemRepository.create({
            ...item,
            purchaseRequestId: savedPr._id,
          }),
        );
        await queryRunner.manager.save(prItems);
      }

      await queryRunner.commitTransaction();
      return savedPr;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const page =
      Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
    const defaultLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const offset = (page - 1) * defaultLimit;

    const queryBuilder = this.prRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('pr.createdBy', 'createdBy')
      .leftJoinAndSelect('pr.approvedBy', 'approvedBy')
      .addSelect((subQuery) => {
        return subQuery
          .select(
            'SUM(CAST(pri.quantity AS NUMERIC) * CAST(pri.estimatedPrice AS NUMERIC))',
            'total',
          )
          .from(PurchaseRequestItem, 'pri')
          .where('pri.purchaseRequestId = pr._id');
      }, 'totalAmount')
      .where(filter)
      .andWhere('pr.deletedAt IS NULL')
      .orderBy(
        sort ? Object.keys(sort)[0] : 'pr.createdAt',
        sort ? (Object.values(sort)[0] as any).toUpperCase() : 'DESC',
      )
      .take(defaultLimit)
      .skip(offset);

    const [result, total] = await queryBuilder.getManyAndCount();

    // TypeORM getMany doesn't automatically include the virtual totalAmount column in the entity,
    // so we map it from the raw results if needed, or stick to the previous robust map for now.
    const resultsWithTotal = result.map((pr) => {
      const totalAmount =
        pr.items?.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.estimatedPrice || 0),
          0,
        ) || 0;
      return { ...pr, totalAmount };
    });

    return {
      meta: {
        current: page,
        pageSize: defaultLimit,
        pages: Math.ceil(total / defaultLimit),
        total: total,
      },
      results: resultsWithTotal,
    };
  }

  async findOne(purchaseRequestRef: string) {
    const pr = await this.prRepository.findOne({
      where: { _id: purchaseRequestRef },
      relations: ['items', 'items.product', 'createdBy', 'approvedBy'],
    });
    if (!pr) throw new NotFoundException('Purchase Request not found');
    return pr;
  }

  async update(
    purchaseRequestRef: string,
    updatePurchaseRequestDto: UpdatePurchaseRequestDto,
  ) {
    const pr = await this.findOne(purchaseRequestRef);
    if (
      pr.status !== PurchaseRequestStatus.DRAFT &&
      pr.status !== PurchaseRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED PRs can be updated',
      );
    }

    const { items, ...prData } = updatePurchaseRequestDto;

    const existingIds = pr.items?.map((item) => item._id) || [];
    const incomingItems = items || [];
    const incomingIds = incomingItems
      .map((item) => item._id)
      .filter((itemRef) => itemRef);

    // 1. Delete removed items
    const idsToDelete = existingIds.filter(
      (itemRef) => !incomingIds.includes(itemRef),
    );
    if (idsToDelete.length > 0) {
      await this.prItemRepository.delete(idsToDelete);
    }

    // 2. Insert or update items
    for (const item of incomingItems) {
      if (item._id) {
        await this.prItemRepository.update(item._id, {
          ...item,
          purchaseRequestId: pr._id,
        });
      } else {
        await this.prItemRepository.insert({
          ...item,
          purchaseRequestId: pr._id,
        });
      }
    }

    // 3. Update PR main fields
    await this.prRepository.update({ _id: pr._id }, prData);
    return this.findOne(pr._id);
  }

  async approve(purchaseRequestRef: string, user: IUser) {
    const pr = await this.findOne(purchaseRequestRef);
    if (pr.status !== PurchaseRequestStatus.PENDING) {
      throw new BadRequestException(
        'PR must be in PENDING status to be approved',
      );
    }

    pr.status = PurchaseRequestStatus.APPROVED;
    pr.approvedByUsername = user.username;
    pr.approvedAt = new Date();
    return this.prRepository.save(pr);
  }

  async submit(purchaseRequestRef: string, user: IUser) {
    const pr = await this.findOne(purchaseRequestRef);
    if (
      pr.status !== PurchaseRequestStatus.DRAFT &&
      pr.status !== PurchaseRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'PR must be in DRAFT or REJECTED status to be submitted',
      );
    }

    const amountVnd = this.calculateTotalAmount(pr);
    const matchingRule = await this.approvalMatrixService.findMatchingRule(
      ApprovalDocumentType.PURCHASE_REQUEST,
      amountVnd,
      'VND',
    );

    if (!matchingRule) {
      pr.status = PurchaseRequestStatus.APPROVED;
      pr.approvedByUsername = user.username;
      pr.approvedAt = new Date();
      pr.rejectionReason = null;
      return this.prRepository.save(pr);
    }

    return this.dataSource.transaction(async (manager) => {
      const approvalRequest =
        await this.approvalMatrixService.createRequestInTransaction(
          manager,
          {
            ruleId: matchingRule._id,
            documentType: ApprovalDocumentType.PURCHASE_REQUEST,
            documentId: pr._id,
            documentNumber: pr.prNumber,
            title: `Approve Purchase Request ${pr.prNumber}`,
            currency: 'VND',
            amount: amountVnd,
            amountVnd,
            metadata: {
              department: pr.department,
              project: pr.project,
              priority: pr.priority,
              source: 'purchase_requests.submit',
            },
          },
          user,
        );

      pr.status = PurchaseRequestStatus.PENDING;
      pr.approvalWorkflowRequestId = approvalRequest?._id || null;
      pr.submittedForApprovalByUsername = user.username;
      pr.submittedForApprovalAt = new Date();
      pr.approvedByUsername = null;
      pr.approvedAt = null;
      pr.rejectionReason = null;

      const savedPr = await manager.save(pr);
      return {
        ...savedPr,
        totalAmount: amountVnd,
        approvalRequest,
      };
    });
  }

  async remove(purchaseRequestRef: string) {
    const pr = await this.findOne(purchaseRequestRef);
    if (pr.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT PRs can be deleted');
    }
    return this.prRepository.softDelete({ _id: pr._id });
  }
}
