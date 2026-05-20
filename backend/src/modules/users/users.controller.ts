import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '@/decorator/customize';

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll(
    @Query() query: string,
    @Query('current') current: string,
    @Query('limit') limit: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.usersService.findAll(query, +current, +pageSize);
  }

  @Get(':user_ref')
  findOne(@Param('user_ref') user_ref: string) {
    return this.usersService.findOne(user_ref);
  }

  @Patch(':user_ref')
  update(@Param('user_ref') user_ref: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user_ref, updateUserDto);
  }
  @Post('bulk-delete')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.usersService.bulkRemove(ids);
  }

  @Delete(':user_ref')
  remove(@Param('user_ref') user_ref: string) {
    return this.usersService.remove(user_ref);
  }
}
