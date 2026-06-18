import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, User } from '@/decorator/customize';
import { CreateCountryDto } from './dto/create-country.dto';
import { QueryCountryDto } from './dto/query-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { CountriesService } from './countries.service';

type RequestUser = {
  username?: string;
};

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() dto: CreateCountryDto, @User() user?: RequestUser) {
    return this.countriesService.create(dto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT', 'LOGISTICS')
  findAll(@Query() query: QueryCountryDto) {
    return this.countriesService.findAll(query);
  }

  @Get(':_id')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT', 'ACCOUNTANT', 'LOGISTICS')
  findOne(@Param('_id') recordId: string) {
    return this.countriesService.findOne(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('_id') recordId: string,
    @Body() dto: UpdateCountryDto,
    @User() user?: RequestUser,
  ) {
    return this.countriesService.update(recordId, dto, user);
  }

  @Delete(':_id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('_id') recordId: string, @User() user?: RequestUser) {
    return this.countriesService.remove(recordId, user);
  }
}
