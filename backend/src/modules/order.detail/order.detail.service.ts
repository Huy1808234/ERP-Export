import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateOrderDetailDto } from './dto/create-order.detail.dto';
import { UpdateOrderDetailDto } from './dto/update-order.detail.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderDetail } from './entities/order.detail.entity';

@Injectable()
export class OrderDetailService {
  constructor(
    @InjectRepository(OrderDetail)
    private repo: Repository<OrderDetail>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createDto: CreateOrderDetailDto) {
    const newRecord = this.repo.create(createDto);
    return await this.repo.save(newRecord);
  }

  async findAll() {
    return await this.repo.find({ relations: ['order', 'menu', 'menuItem', 'menuItemOption'] });
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const record = await this.repo.findOne({ where: { _id: id }, relations: ['order', 'menu', 'menuItem', 'menuItemOption'] });
    if (!record) throw new NotFoundException(`Không tìm thấy`);
    return record;
  }

  async update(id: string, updateDto: UpdateOrderDetailDto) {
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
