import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateMenuItemDto } from './dto/create-menu.item.dto';
import { UpdateMenuItemDto } from './dto/update-menu.item.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu.item.entity';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectRepository(MenuItem)
    private repo: Repository<MenuItem>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createDto: CreateMenuItemDto) {
    const newRecord = this.repo.create(createDto);
    return await this.repo.save(newRecord);
  }

  async findAll() {
    return await this.repo.find({ relations: ['menu'] });
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const record = await this.repo.findOne({ where: { _id: id }, relations: ['menu'] });
    if (!record) throw new NotFoundException(`Không tìm thấy`);
    return record;
  }

  async update(id: string, updateDto: UpdateMenuItemDto) {
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
