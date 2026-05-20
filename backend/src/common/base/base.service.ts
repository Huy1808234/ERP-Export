import {
  DeepPartial,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import type { QueryParams } from '@/common/types/authenticated-user.type';

type PaginationMeta = {
  current: number;
  pageSize: number;
  pages: number;
  total: number;
};

export abstract class BaseService<T extends ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async findAll(
    query: QueryParams,
    relations: string[] = [],
  ): Promise<{ results: T[]; meta: PaginationMeta }> {
    const { current = 1, pageSize = 10, ...filters } = query;
    const normalizedCurrent = Number(current) || 1;
    const normalizedPageSize = Number(pageSize) || 10;
    const skip = (normalizedCurrent - 1) * normalizedPageSize;

    // Tự động loại bỏ các field meta khỏi filter
    const where = filters as FindOptionsWhere<T>;

    const [results, total] = await this.repository.findAndCount({
      where,
      relations,
      take: normalizedPageSize,
      skip,
      order: { createdAt: 'DESC' } as unknown as FindOptionsOrder<T>,
    });

    return {
      results,
      meta: {
        current: normalizedCurrent,
        pageSize: normalizedPageSize,
        pages: Math.ceil(total / normalizedPageSize),
        total,
      },
    };
  }

  async findOne(entityRef: string, relations: string[] = []): Promise<T> {
    const options: FindOneOptions = {
      where: { _id: entityRef } as unknown as FindOptionsWhere<T>,
      relations,
    };
    const entity = await this.repository.findOne(options);
    if (!entity) {
      throw new NotFoundException(`${this.repository.metadata.name} with reference ${entityRef} not found`);
    }
    return entity;
  }

  async update(entityRef: string, data: DeepPartial<T>): Promise<T> {
    const entity = await this.findOne(entityRef);
    const updatedEntity = this.repository.merge(entity, data);
    return await this.repository.save(updatedEntity);
  }

  async softDelete(entityRef: string): Promise<void> {
    const entity = await this.findOne(entityRef);
    await this.repository.softRemove(entity);
  }
}
