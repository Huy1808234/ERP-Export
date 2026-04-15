import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(Menu)
    private menuRepository: Repository<Menu>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createMenuDto: CreateMenuDto) {
    const newRecord = this.menuRepository.create(createMenuDto);
    return await this.menuRepository.save(newRecord);
  }

  async findAll() {
    return await this.menuRepository.find({ relations: ['restaurant'] });
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const record = await this.menuRepository.findOne({ where: { _id: id }, relations: ['restaurant'] });
    if (!record) throw new NotFoundException(`Không tìm thấy`);
    return record;
  }

  async update(id: string, updateMenuDto: UpdateMenuDto) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    await this.menuRepository.update({ _id: id }, updateMenuDto);
    return await this.menuRepository.findOneBy({ _id: id });
  }

  async remove(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ`);
    const result = await this.menuRepository.delete({ _id: id });
    if (result.affected === 0) throw new NotFoundException(`Không tìm thấy`);
    return { message: 'Đã xóa thành công', deletedCount: result.affected };
  }
}
