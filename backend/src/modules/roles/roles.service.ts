import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LEGACY_ROLE_ALIASES, SYSTEM_ROLES } from '@/common/auth/role-catalog';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSystemRoles();
  }

  private async ensureSystemRoles(): Promise<void> {
    for (const roleDefinition of SYSTEM_ROLES) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleDefinition.name },
      });

      if (existingRole) {
        existingRole.description = roleDefinition.description;
        existingRole.isActive = true;
        await this.roleRepository.save(existingRole);
        continue;
      }

      await this.roleRepository.save(this.roleRepository.create(roleDefinition));
    }

    const canonicalRoleNames = new Set(SYSTEM_ROLES.map((role) => role.name));

    for (const [legacyRoleName, canonicalRoleName] of Object.entries(LEGACY_ROLE_ALIASES)) {
      await this.userRepository.update(
        { roleName: legacyRoleName },
        { roleName: canonicalRoleName },
      );

      if (canonicalRoleNames.has(legacyRoleName)) {
        continue;
      }

      const legacyRole = await this.roleRepository.findOne({ where: { name: legacyRoleName } });
      if (!legacyRole) {
        continue;
      }

      legacyRole.isActive = false;
      legacyRole.description = legacyRole.description || `Legacy alias for ${canonicalRoleName}`;
      await this.roleRepository.save(legacyRole);
    }
  }

  async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
    const { permissionRefs, ...roleData } = createRoleDto;

    const existingRole = await this.roleRepository.findOne({ where: { name: roleData.name } });
    if (existingRole) {
      throw new BadRequestException(`Role ${roleData.name} already exists`);
    }

    const newRole = this.roleRepository.create(roleData);

    if (permissionRefs && permissionRefs.length > 0) {
      newRole.permissions = await this.permissionRepository.findBy({ _id: In(permissionRefs) });
    }

    return this.roleRepository.save(newRole);
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isActive: true },
      relations: ['permissions'],
      order: { name: 'ASC' },
    });
  }

  async findRoleByRef(roleRef: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: [{ _id: roleRef }, { name: roleRef }],
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleRef} not found`);
    }

    return role;
  }

  async updateRole(roleRef: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findRoleByRef(roleRef);
    const { permissionRefs, ...roleData } = updateRoleDto;

    Object.assign(role, roleData);

    if (permissionRefs) {
      role.permissions = await this.permissionRepository.findBy({ _id: In(permissionRefs) });
    }

    return this.roleRepository.save(role);
  }

  async removeRole(roleRef: string): Promise<void> {
    const role = await this.findRoleByRef(roleRef);
    await this.roleRepository.remove(role);
  }

  async createPermission(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({
      where: {
        apiPath: createPermissionDto.apiPath,
        method: createPermissionDto.method,
      },
    });
    if (existing) {
      throw new BadRequestException('Permission with this path and method already exists');
    }

    const permission = this.permissionRepository.create(createPermissionDto);
    return this.permissionRepository.save(permission);
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({ order: { module: 'ASC', name: 'ASC' } });
  }

  async findPermissionByRef(permissionRef: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: [{ _id: permissionRef }, { name: permissionRef }],
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${permissionRef} not found`);
    }

    return permission;
  }

  async updatePermission(
    permissionRef: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    const permission = await this.findPermissionByRef(permissionRef);
    Object.assign(permission, updatePermissionDto);
    return this.permissionRepository.save(permission);
  }

  async removePermission(permissionRef: string): Promise<void> {
    const permission = await this.findPermissionByRef(permissionRef);
    await this.permissionRepository.remove(permission);
  }
}
