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
import { UsersService, type UserListResponse } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  BulkDeactivateUsersDto,
  DeactivateUserDto,
  UpdateUserDto,
} from './dto/update-user.dto';
import { Roles, User } from '@/decorator/customize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

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
    @Query() query: Record<string, string | undefined>,
    @Query('current') current: string,
    @Query('pageSize') pageSize: string,
  ): Promise<UserListResponse> {
    return this.usersService.findAll(query, +current, +pageSize);
  }

  @Get(':user_ref')
  findOne(@Param('user_ref') user_ref: string) {
    return this.usersService.findOne(user_ref);
  }

  @Patch(':user_ref')
  update(
    @Param('user_ref') user_ref: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(user_ref, updateUserDto);
  }

  @Post('bulk-deactivate')
  bulkRemove(
    @Body() dto: BulkDeactivateUsersDto,
    @User() actor: AuthenticatedUser,
  ) {
    return this.usersService.bulkDeactivate(dto.userRefs, dto.reason, actor);
  }

  @Delete(':user_ref')
  remove(
    @Param('user_ref') user_ref: string,
    @Body() dto: DeactivateUserDto,
    @User() actor: AuthenticatedUser,
  ) {
    return this.usersService.deactivate(user_ref, dto.reason, actor);
  }
}
