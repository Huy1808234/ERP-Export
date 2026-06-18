import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLTemplate } from './entities/pl-template.entity';
import { JwtAuthGuard } from '@/auth/passport/jwt-auth.guard';
import { RequirePermissions } from '@/decorator/customize';

@Controller('v1/accounting/settings/pl-templates')
@UseGuards(JwtAuthGuard)
export class PLTemplateController {
  constructor(
    @InjectRepository(PLTemplate)
    private readonly plTemplateRepository: Repository<PLTemplate>,
  ) {}

  @Get()
  @RequirePermissions('accounting:read')
  async findAll() {
    return this.plTemplateRepository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  @Post()
  @RequirePermissions('accounting:write')
  async create(@Body() data: Partial<PLTemplate>) {
    const template = this.plTemplateRepository.create(data);
    return this.plTemplateRepository.save(template);
  }

  @Put(':id')
  @RequirePermissions('accounting:write')
  async update(@Param('id') id: string, @Body() data: Partial<PLTemplate>) {
    await this.plTemplateRepository.update(id, data);
    return this.plTemplateRepository.findOneBy({ id });
  }

  @Delete(':id')
  @RequirePermissions('accounting:write')
  async remove(@Param('id') id: string) {
    await this.plTemplateRepository.delete(id);
    return { success: true };
  }
}
