import { Repository, FindManyOptions, FindOneOptions, DeepPartial, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

export abstract class BaseService<T extends ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async findAll(
    query: { current?: number; pageSize?: number; [key: string]: any },
    relations: string[] = [],
  ): Promise<{ results: T[]; meta: any }> {
    const { current = 1, pageSize = 10, ...filters } = query;
    const skip = (current - 1) * pageSize;

    // Tự động loại bỏ các field meta khỏi filter
    const where: any = filters;

    const [results, total] = await this.repository.findAndCount({
      where,
      relations,
      take: pageSize,
      skip,
      order: { createdAt: 'DESC' } as any,
    });

    return {
      results,
      meta: {
        current: +current,
        pageSize: +pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
    };
  }

  async findOne(id: string, relations: string[] = []): Promise<T> {
    const options: FindOneOptions = {
      where: { id } as any,
      relations,
    };
    const entity = await this.repository.findOne(options);
    if (!entity) {
      throw new NotFoundException(`${this.repository.metadata.name} with ID ${id} not found`);
    }
    return entity;
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    const entity = await this.findOne(id);
    const updatedEntity = this.repository.merge(entity, data);
    return await this.repository.save(updatedEntity);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.softRemove(entity);
  }
}
