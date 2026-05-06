import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseReturn, PurchaseReturnItem } from './entities/purchase-return.entity';
import { Product } from '../products/entities/product.entity';
import { IUser } from '../users/users.interface';


@Injectable()
export class PurchaseReturnsService {
  constructor(
    @InjectRepository(PurchaseReturn)
    private purchaseReturnRepository: Repository<PurchaseReturn>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: any, user: IUser) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnNumber = `RET-${Date.now()}`;
      
      const purchaseReturn = this.purchaseReturnRepository.create({
        ...createDto,
        returnNumber,
        createdById: user.id,
      } as Partial<PurchaseReturn>);

      const savedReturn = await queryRunner.manager.save(purchaseReturn);

      // Stock deduction logic
      for (const item of createDto.items) {
        const product = await queryRunner.manager.findOne(Product, { where: { id: item.productId } });
        if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
        
        // Deduct stock
        product.currentStock = Number(product.currentStock) - Number(item.quantity);
        await queryRunner.manager.save(product);

        const returnItem = queryRunner.manager.create(PurchaseReturnItem, {
          ...item,
          purchaseReturnId: savedReturn.id,
        });
        await queryRunner.manager.save(returnItem);
      }

      await queryRunner.commitTransaction();
      return savedReturn;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: string, current: number, pageSize: number) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort, population } = aqp(query);
    delete filter.current;
    delete filter.pageSize;

    const offset = (current - 1) * pageSize;

    const [result, total] = await this.purchaseReturnRepository.findAndCount({
      where: filter,
      take: pageSize,
      skip: offset,
      order: sort as any,
      relations: ['items', 'items.product', 'purchaseOrder'],
    });

    return {
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
      result,
    };
  }

  async findOne(id: string) {
    return this.purchaseReturnRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'purchaseOrder'],
    });
  }
}
