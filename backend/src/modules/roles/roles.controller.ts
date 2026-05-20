import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../decorator/customize';
import { JwtAuthGuard } from '../../auth/passport/jwt-auth.guard';
import { RolesGuard } from '../../auth/passport/roles.guard';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DIRECTOR', 'MANAGER')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.createRole(createRoleDto);
  }

  @Get()
  findAllRoles() {
    return this.rolesService.findAllRoles();
  }

  @Post('permissions')
  createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.rolesService.createPermission(createPermissionDto);
  }

  @Get('permissions/all')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Get('permissions/:permission_ref')
  findPermissionByRef(@Param('permission_ref') permission_ref: string) {
    return this.rolesService.findPermissionByRef(permission_ref);
  }

  @Patch('permissions/:permission_ref')
  updatePermission(
    @Param('permission_ref') permission_ref: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.rolesService.updatePermission(permission_ref, updatePermissionDto);
  }

  @Delete('permissions/:permission_ref')
  removePermission(@Param('permission_ref') permission_ref: string) {
    return this.rolesService.removePermission(permission_ref);
  }

  @Get(':role_ref')
  findRoleByRef(@Param('role_ref') role_ref: string) {
    return this.rolesService.findRoleByRef(role_ref);
  }

  @Patch(':role_ref')
  updateRole(@Param('role_ref') role_ref: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.updateRole(role_ref, updateRoleDto);
  }

  @Delete(':role_ref')
  @Roles('ADMIN', 'DIRECTOR')
  removeRole(@Param('role_ref') role_ref: string) {
    return this.rolesService.removeRole(role_ref);
  }
}
