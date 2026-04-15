import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateMenuItemOptionDto } from './dto/create-menu.item.option.dto';
import { UpdateMenuItemOptionDto } from './dto/update-menu.item.option.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItemOption } from './entities/menu.item.option.entity';

@Injectable()
export class MenuItemOptionsService {
  constructor(
    @InjectRepository(MenuItemOption)
    private repo: Repository<MenuItemOption>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createDto: CreateMenuItemOptionDto) {
    const newRecord = this.repo.create(createDto);
    return await this.repo.save(newRecord);
  }

  async findAll() {
    return await this.repo.find({ relations: ['menuItem'] });
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const record = await this.repo.findOne({ where: { _id: id }, relations: ['menuItem'] });
    if (!record) throw new NotFoundException(`Không tìm thấy`);
    return record;
  }

  async update(id: string, updateDto: UpdateMenuItemOptionDto) {
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
