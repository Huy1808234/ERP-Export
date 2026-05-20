import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '@/decorator/customize';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Public() // Công khai cho khách hàng và dropdown
  @Get()
  findAll(@Query('all') all: string) {
    const activeOnly = all !== 'true';
    return this.categoriesService.findAll(activeOnly);
  }

  @Get(':_id')
  findOne(@Param('_id') recordId: string) {
    return this.categoriesService.findOne(recordId);
  }

  @Patch(':_id')
  update(@Param('_id') recordId: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(recordId, updateCategoryDto);
  }

  @Delete(':_id')
  remove(@Param('_id') recordId: string) {
    return this.categoriesService.remove(recordId);
  }
}
