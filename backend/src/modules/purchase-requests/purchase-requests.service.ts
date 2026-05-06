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


@Injectable()
export class PurchaseRequestsService {
  constructor(
    @InjectRepository(PurchaseRequest)
    private prRepository: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private prItemRepository: Repository<PurchaseRequestItem>,
    private dataSource: DataSource,
  ) { }

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
        createdById: user.id, // Changed from user._id
        status: PurchaseRequestStatus.DRAFT,
      });

      const savedPr = await queryRunner.manager.save(pr);

      // 3. Create Items
      if (items && items.length > 0) {
        const prItems = items.map((item) =>
          this.prItemRepository.create({
            ...item,
            purchaseRequestId: savedPr.id,
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

    const offset = (currentPage - 1) * limit;
    const defaultLimit = limit ? limit : 10;

    const queryBuilder = this.prRepository.createQueryBuilder('pr')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('pr.createdBy', 'createdBy')
      .leftJoinAndSelect('pr.approvedBy', 'approvedBy')
      .addSelect(subQuery => {
        return subQuery
          .select('SUM(CAST(pri.quantity AS NUMERIC) * CAST(pri.estimatedPrice AS NUMERIC))', 'total')
          .from(PurchaseRequestItem, 'pri')
          .where('pri.purchaseRequestId = pr.id');
      }, 'totalAmount')
      .where(filter)
      .andWhere('pr.deletedAt IS NULL')
      .orderBy(sort ? Object.keys(sort)[0] : 'pr.createdAt', sort ? (Object.values(sort)[0] as any).toUpperCase() : 'DESC')
      .take(defaultLimit)
      .skip(offset);

    const [result, total] = await queryBuilder.getManyAndCount();

    // TypeORM getMany doesn't automatically include the virtual totalAmount column in the entity, 
    // so we map it from the raw results if needed, or stick to the previous robust map for now.
    const resultsWithTotal = result.map(pr => {
      const totalAmount = pr.items?.reduce((sum, item) => 
        sum + (Number(item.quantity || 0) * Number(item.estimatedPrice || 0)), 0) || 0;
      return { ...pr, totalAmount };
    });

    return {
      meta: {
        current: currentPage,
        pageSize: limit,
        pages: Math.ceil(total / defaultLimit),
        total: total,
      },
      results: resultsWithTotal,
    };
  }

  async findOne(id: string) {
    const pr = await this.prRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'createdBy', 'approvedBy'],
    });
    if (!pr) throw new NotFoundException('Purchase Request not found');
    return pr;
  }

  async update(id: string, updatePurchaseRequestDto: UpdatePurchaseRequestDto) {
    const pr = await this.findOne(id);
    if (
      pr.status !== PurchaseRequestStatus.DRAFT &&
      pr.status !== PurchaseRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only DRAFT or REJECTED PRs can be updated',
      );
    }

    // Simplified update for now, can be expanded to handle items
    return this.prRepository.save({ ...pr, ...updatePurchaseRequestDto });
  }

  async approve(id: string, user: IUser) {
    const pr = await this.findOne(id);
    if (pr.status !== PurchaseRequestStatus.PENDING) {
      throw new BadRequestException(
        'PR must be in PENDING status to be approved',
      );
    }

    pr.status = PurchaseRequestStatus.APPROVED;
    pr.approvedById = user.id;
    pr.approvedAt = new Date();
    return this.prRepository.save(pr);
  }

  async submit(id: string) {
    const pr = await this.findOne(id);
    if (pr.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException(
        'PR must be in DRAFT status to be submitted',
      );
    }
    pr.status = PurchaseRequestStatus.PENDING;
    return this.prRepository.save(pr);
  }

  async remove(id: string) {
    const pr = await this.findOne(id);
    if (pr.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT PRs can be deleted');
    }
    return this.prRepository.softDelete(id);
  }
}
