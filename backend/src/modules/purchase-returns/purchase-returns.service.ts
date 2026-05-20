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
        createdByUsername: user.username,
      } as Partial<PurchaseReturn>);

      const savedReturn = await queryRunner.manager.save(purchaseReturn);

      // Stock deduction logic
      for (const item of createDto.items) {
        const product = await queryRunner.manager.findOne(Product, { where: { _id: item.productId } });
        if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
        
        // Deduct stock
        product.currentStock = Number(product.currentStock) - Number(item.quantity);
        await queryRunner.manager.save(product);

        const returnItem = queryRunner.manager.create(PurchaseReturnItem, {
          ...item,
          purchaseReturnId: savedReturn._id,
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

  async findAll(query: any = {}, current = 1, pageSize = 10) {
    const { current: _current, pageSize: _pageSize, populate: _populate, sort, ...filter } = query || {};
    const offset = (Number(current || 1) - 1) * Number(pageSize || 10);
    const order = sort === 'returnDate'
      ? { returnDate: 'ASC' as const }
      : { createdAt: 'DESC' as const };

    const [result, total] = await this.purchaseReturnRepository.findAndCount({
      where: filter,
      take: Number(pageSize || 10),
      skip: offset,
      order,
      relations: ['items', 'items.product', 'purchaseOrder'],
    });

    return {
      meta: {
        current: Number(current || 1),
        pageSize: Number(pageSize || 10),
        pages: Math.ceil(total / Number(pageSize || 10)),
        total,
      },
      results: result,
    };
  }

  async findOne(id: string) {
    return this.purchaseReturnRepository.findOne({
      where: { _id: id },
      relations: ['items', 'items.product', 'purchaseOrder'],
    });
  }
}
