import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private repo: Repository<Order>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createDto: CreateOrderDto) {
    const newRecord = this.repo.create(createDto);
    return await this.repo.save(newRecord);
  }

  async findAll() {
    return await this.repo.find({ relations: ['restaurant', 'user'] });
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const record = await this.repo.findOne({ where: { _id: id }, relations: ['restaurant', 'user'] });
    if (!record) throw new NotFoundException(`Không tìm thấy`);
    return record;
  }

  async update(id: string, updateDto: UpdateOrderDto) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    await this.repo.update({ _id: id }, updateDto);
    return await this.repo.findOneBy({ _id: id });
  }

  async remove(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const result = await this.repo.delete({ _id: id });
    if (result.affected === 0) throw new NotFoundException(`Không tìm thấy`);
    return { message: 'Đã xóa thành công', deletedCount: result.affected };
  }
}
