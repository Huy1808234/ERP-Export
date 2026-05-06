import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityCheck, QCResult } from './entities/quality-check.entity';

@Injectable()
export class QualityControlService {
  constructor(
    @InjectRepository(QualityCheck)
    private qcRepository: Repository<QualityCheck>,
  ) {}

  async create(data: any, user: any) {
    const checkNumber = `QC-${Date.now()}`;
    const qc = this.qcRepository.create({
      ...data,
      checkNumber,
      inspectorId: user.id,
    });
    return this.qcRepository.save(qc);
  }

  async findAll(query: any) {
    const { productId, lotId } = query;
    return this.qcRepository.find({
      where: { productId, lotId },
      relations: ['product', 'lot', 'inspector'],
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: string) {
    const qc = await this.qcRepository.findOne({
      where: { id },
      relations: ['product', 'lot', 'inspector'],
    });
    if (!qc) throw new NotFoundException('QC check not found');
    return qc;
  }
}
