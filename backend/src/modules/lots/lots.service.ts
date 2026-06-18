import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lot } from './entities/lot.entity';

@Injectable()
export class LotsService {
  constructor(
    @InjectRepository(Lot)
    private lotRepository: Repository<Lot>,
  ) {}

  async create(data: Partial<Lot>) {
    const lot = this.lotRepository.create(data);
    return this.lotRepository.save(lot);
  }

  async findByLotNumber(lotNumber: string) {
    const lot = await this.lotRepository.findOne({ where: { lotNumber } });
    if (!lot) throw new NotFoundException(`Lot ${lotNumber} not found`);
    return lot;
  }

  async updateQuantity(lotNumber: string, change: number, manager?: any) {
    const repo = manager ? manager.getRepository(Lot) : this.lotRepository;
    const lot = await repo.findOne({ where: { lotNumber } });
    if (!lot) throw new NotFoundException(`Lot ${lotNumber} not found`);

    lot.currentQuantity = Number(lot.currentQuantity) + change;
    return repo.save(lot);
  }

  async findAll(query: any) {
    const { productId, supplierId } = query;
    return this.lotRepository.find({
      where: { productId, supplierId },
      relations: ['product', 'supplier'],
      order: { createdAt: 'DESC' },
    });
  }
}
