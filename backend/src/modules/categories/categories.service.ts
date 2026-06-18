import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async onModuleInit() {
    const count = await this.categoryRepository.count();
    if (count === 0) {
      console.log('[CategoriesService] Seeding default categories...');
      const defaults = [
        { name: 'Nông sản', description: 'Các sản phẩm nông nghiệp sạch' },
        { name: 'Gia vị', description: 'Hương vị đậm đà cho món ăn' },
        { name: 'Thủy hải sản', description: 'Hải sản tươi sống xuất khẩu' },
        {
          name: 'Sản phẩm đóng gói',
          description: 'Hàng tiêu dùng đóng gói sẵn',
        },
      ];
      for (const item of defaults) {
        await this.create(item);
      }
    }
  }

  private toSlug(str: string): string {
    str = str.toLowerCase();
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Loại bỏ dấu
    str = str.replace(/[đĐ]/g, 'd');
    str = str.replace(/([^0-9a-z-\s])/g, ''); // Loại bỏ ký tự đặc biệt
    str = str.replace(/(\s+)/g, '-'); // Thay khoảng trắng bằng -
    str = str.replace(/-+/g, '-'); // Loại bỏ nhiều dấu - liên tiếp
    str = str.replace(/^-+|-+$/g, ''); // Loại bỏ dấu - ở đầu và cuối
    return str;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { name, slug } = createCategoryDto;

    // Tự động tạo slug nếu không có
    const finalSlug = slug || this.toSlug(name);

    const existing = await this.categoryRepository.findOne({
      where: { slug: finalSlug },
    });
    if (existing) {
      throw new ConflictException('Danh mục này đã tồn tại');
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      slug: finalSlug,
    });
    return this.categoryRepository.save(category);
  }

  async findAll(activeOnly = true): Promise<Category[]> {
    const where = activeOnly ? { isActive: true } : {};
    return this.categoryRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { _id: id },
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    if (updateCategoryDto.name && !updateCategoryDto.slug) {
      updateCategoryDto.slug = this.toSlug(updateCategoryDto.name);
    }

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.softRemove(category);
  }
}
