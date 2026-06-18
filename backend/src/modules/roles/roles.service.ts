import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  LEGACY_ROLE_ALIASES,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
} from '@/common/auth/role-catalog';
import {
  PermissionDataScope,
  maxPermissionDataScope,
  normalizePermissionDataScope,
} from '@/common/auth/permission-scope';
import { RedisCacheService } from '@/common/cache/redis-cache.service';
import { BulkUpdateRolePermissionsDto } from './dto/bulk-update-role-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermissionAssignment } from './entities/role-permission-assignment.entity';
import { User } from '../users/entities/user.entity';

type NormalizedPermissionAssignment = {
  permission_ref: string;
  scope: PermissionDataScope;
};

type NormalizedRoleAssignment = {
  role_ref: string;
  permission_assignments: NormalizedPermissionAssignment[];
};

export type RolePermissionSnapshot = {
  permissionNames: string[];
  permissionScopes: Record<string, PermissionDataScope>;
};

const ROLE_PERMISSION_RELATIONS = [
  'permissions',
  'permissionAssignments',
  'permissionAssignments.permission',
];

const ROLE_PERMISSION_CACHE_TTL_SECONDS = 60;

const LEGACY_WRITE_PERMISSION_MIGRATIONS: Readonly<
  Record<string, readonly string[]>
> = {
  'write:accounting': ['create:accounting', 'update:accounting'],
  'write:export_document': ['create:export_document', 'update:export_document'],
  'write:sales_contract': ['create:sales_contract', 'update:sales_contract'],
  'write:cost_fields': ['create:cost_fields', 'update:cost_fields'],
};

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermissionAssignment)
    private rolePermissionAssignmentRepository: Repository<RolePermissionAssignment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private redisCacheService: RedisCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSystemRoles();
    await this.ensureSystemPermissions();
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

      await this.roleRepository.save(
        this.roleRepository.create(roleDefinition),
      );
    }

    const canonicalRoleNames = new Set(SYSTEM_ROLES.map((role) => role.name));

    for (const [legacyRoleName, canonicalRoleName] of Object.entries(
      LEGACY_ROLE_ALIASES,
    )) {
      await this.userRepository.update(
        { roleName: legacyRoleName },
        { roleName: canonicalRoleName },
      );

      if (canonicalRoleNames.has(legacyRoleName)) {
        continue;
      }

      const legacyRole = await this.roleRepository.findOne({
        where: { name: legacyRoleName },
      });
      if (!legacyRole) {
        continue;
      }

      legacyRole.isActive = false;
      legacyRole.description =
        legacyRole.description || `Legacy alias for ${canonicalRoleName}`;
      await this.roleRepository.save(legacyRole);
    }
  }

  private async ensureSystemPermissions(): Promise<void> {
    for (const permissionDefinition of SYSTEM_PERMISSIONS) {
      const existingPermission = await this.permissionRepository.findOne({
        where: { name: permissionDefinition.name },
      });

      if (existingPermission) {
        existingPermission.apiPath = permissionDefinition.apiPath;
        existingPermission.method = permissionDefinition.method;
        existingPermission.module = permissionDefinition.module;
        await this.permissionRepository.save(existingPermission);
        continue;
      }

      await this.permissionRepository.save(
        this.permissionRepository.create(permissionDefinition),
      );
    }

    await this.migrateLegacyWritePermissionAssignments();
  }

  private async migrateLegacyWritePermissionAssignments(): Promise<void> {
    const permissionNames = [
      ...Object.keys(LEGACY_WRITE_PERMISSION_MIGRATIONS),
      ...Object.values(LEGACY_WRITE_PERMISSION_MIGRATIONS).flat(),
    ];
    const permissions = await this.permissionRepository.find({
      where: { name: In(permissionNames) },
    });
    const permissionByName = new Map(
      permissions.map((permission) => [permission.name, permission]),
    );

    for (const [legacyPermissionName, targetPermissionNames] of Object.entries(
      LEGACY_WRITE_PERMISSION_MIGRATIONS,
    )) {
      const legacyPermission = permissionByName.get(legacyPermissionName);
      if (!legacyPermission) continue;

      const legacyAssignments =
        await this.rolePermissionAssignmentRepository.find({
          where: { permissionRef: legacyPermission._id },
        });
      if (legacyAssignments.length === 0) continue;

      for (const targetPermissionName of targetPermissionNames) {
        const targetPermission = permissionByName.get(targetPermissionName);
        if (!targetPermission) continue;

        const existingAssignments =
          await this.rolePermissionAssignmentRepository.find({
            where: {
              roleRef: In(
                legacyAssignments.map((assignment) => assignment.roleRef),
              ),
              permissionRef: targetPermission._id,
            },
          });
        const existingRoleRefs = new Set(
          existingAssignments.map((assignment) => assignment.roleRef),
        );
        const assignmentsToCreate = legacyAssignments
          .filter((assignment) => !existingRoleRefs.has(assignment.roleRef))
          .map((assignment) =>
            this.rolePermissionAssignmentRepository.create({
              roleRef: assignment.roleRef,
              permissionRef: targetPermission._id,
              scope: normalizePermissionDataScope(assignment.scope),
            }),
          );

        if (assignmentsToCreate.length > 0) {
          await this.rolePermissionAssignmentRepository.save(
            assignmentsToCreate,
          );
        }
      }
    }
  }

  private normalizeRoleAssignments(
    assignments: BulkUpdateRolePermissionsDto['assignments'],
  ): NormalizedRoleAssignment[] {
    return assignments.map((assignment) => {
      const scopedAssignments = assignment.permission_assignments?.length
        ? assignment.permission_assignments
        : (assignment.permission_refs ?? []).map((permission_ref) => ({
            permission_ref,
            scope: PermissionDataScope.ALL,
          }));

      const permissionRefSet = new Set<string>();
      const normalizedPermissionAssignments = scopedAssignments
        .map((permissionAssignment) => ({
          permission_ref: permissionAssignment.permission_ref.trim(),
          scope: normalizePermissionDataScope(permissionAssignment.scope),
        }))
        .filter((permissionAssignment) =>
          Boolean(permissionAssignment.permission_ref),
        );

      for (const permissionAssignment of normalizedPermissionAssignments) {
        if (permissionRefSet.has(permissionAssignment.permission_ref)) {
          throw new BadRequestException(
            `Duplicate permission assignment for ${permissionAssignment.permission_ref}`,
          );
        }
        permissionRefSet.add(permissionAssignment.permission_ref);
      }

      return {
        role_ref: assignment.role_ref.trim(),
        permission_assignments: normalizedPermissionAssignments,
      };
    });
  }

  private getRolePermissionCacheKey(roleRef: string): string {
    return this.redisCacheService.makeKey('auth-role-permissions', {
      roleRef: roleRef.trim().toUpperCase(),
    });
  }

  private async clearRolePermissionCache(): Promise<void> {
    await this.redisCacheService.delByPattern(
      'mini-erp:auth-role-permissions:*',
    );
  }

  private buildRolePermissionSnapshot(
    role: Role | null,
  ): RolePermissionSnapshot {
    const permissionNames = new Set<string>();
    const permissionScopes: Record<string, PermissionDataScope> = {};

    for (const permission of role?.permissions ?? []) {
      if (!permission.name) continue;
      permissionNames.add(permission.name);
      permissionScopes[permission.name] = PermissionDataScope.ALL;
    }

    for (const assignment of role?.permissionAssignments ?? []) {
      const permissionName = assignment.permission?.name;
      if (!permissionName) continue;

      permissionNames.add(permissionName);
      const assignmentScope = normalizePermissionDataScope(assignment.scope);
      permissionScopes[permissionName] = permissionScopes[permissionName]
        ? maxPermissionDataScope(
            permissionScopes[permissionName],
            assignmentScope,
          )
        : assignmentScope;
    }

    return {
      permissionNames: [...permissionNames],
      permissionScopes,
    };
  }

  async getAuthPermissionSnapshot(
    roleRef: string,
  ): Promise<RolePermissionSnapshot> {
    const normalizedRoleRef = roleRef.trim();
    if (!normalizedRoleRef) {
      return { permissionNames: [], permissionScopes: {} };
    }

    const cacheKey = this.getRolePermissionCacheKey(normalizedRoleRef);
    return this.redisCacheService.getOrSet<RolePermissionSnapshot>(
      cacheKey,
      ROLE_PERMISSION_CACHE_TTL_SECONDS,
      async () => {
        const role = await this.roleRepository.findOne({
          where: [
            { _id: normalizedRoleRef, isActive: true },
            { name: normalizedRoleRef, isActive: true },
          ],
          relations: ROLE_PERMISSION_RELATIONS,
        });

        return this.buildRolePermissionSnapshot(role);
      },
    );
  }

  async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
    const { permissionRefs, ...roleData } = createRoleDto;

    const existingRole = await this.roleRepository.findOne({
      where: { name: roleData.name },
    });
    if (existingRole) {
      throw new BadRequestException(`Role ${roleData.name} already exists`);
    }

    const newRole = this.roleRepository.create(roleData);

    if (permissionRefs && permissionRefs.length > 0) {
      newRole.permissions = await this.permissionRepository.findBy({
        _id: In(permissionRefs),
      });
    }

    const savedRole = await this.roleRepository.save(newRole);
    await this.clearRolePermissionCache();
    return savedRole;
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isActive: true },
      relations: ROLE_PERMISSION_RELATIONS,
      order: { name: 'ASC' },
    });
  }

  async findRoleByRef(roleRef: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: [{ _id: roleRef }, { name: roleRef }],
      relations: ROLE_PERMISSION_RELATIONS,
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleRef} not found`);
    }

    return role;
  }

  async updateRole(
    roleRef: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.findRoleByRef(roleRef);
    const { permissionRefs, ...roleData } = updateRoleDto;

    Object.assign(role, roleData);

    if (permissionRefs) {
      role.permissions = await this.permissionRepository.findBy({
        _id: In(permissionRefs),
      });
    }

    const savedRole = await this.roleRepository.save(role);
    await this.clearRolePermissionCache();
    return savedRole;
  }

  async updateRolePermissionAssignments(
    bulkUpdateDto: BulkUpdateRolePermissionsDto,
  ): Promise<Role[]> {
    const assignments = bulkUpdateDto.assignments ?? [];

    if (assignments.length === 0) {
      throw new BadRequestException(
        'At least one role permission assignment is required',
      );
    }

    const normalizedAssignments = this.normalizeRoleAssignments(assignments);

    const roleRefs = normalizedAssignments.map(
      (assignment) => assignment.role_ref,
    );
    const emptyRoleRef = roleRefs.some((roleRef) => !roleRef);
    if (emptyRoleRef) {
      throw new BadRequestException(
        'role_ref is required for every assignment',
      );
    }

    const uniqueRoleRefs = new Set<string>();
    for (const roleRef of roleRefs) {
      if (uniqueRoleRefs.has(roleRef)) {
        throw new BadRequestException(
          `Duplicate role assignment for ${roleRef}`,
        );
      }
      uniqueRoleRefs.add(roleRef);
    }

    const roles = await this.roleRepository.manager.transaction(
      async (manager) => {
        const roleRepository = manager.getRepository(Role);
        const permissionRepository = manager.getRepository(Permission);

        const roles = await roleRepository.find({
          where: [
            { _id: In([...uniqueRoleRefs]) },
            { name: In([...uniqueRoleRefs]) },
          ],
          relations: ['permissions'],
        });
        const roleByRef = new Map<string, Role>();

        for (const role of roles) {
          roleByRef.set(role._id, role);
          roleByRef.set(role.name, role);
        }

        const missingRoleRefs = [...uniqueRoleRefs].filter(
          (roleRef) => !roleByRef.has(roleRef),
        );
        if (missingRoleRefs.length > 0) {
          throw new NotFoundException(
            `Role not found: ${missingRoleRefs.join(', ')}`,
          );
        }

        const permissionRefs = [
          ...new Set(
            normalizedAssignments.flatMap((assignment) =>
              assignment.permission_assignments.map(
                (permissionAssignment) => permissionAssignment.permission_ref,
              ),
            ),
          ),
        ];
        const permissions =
          permissionRefs.length > 0
            ? await permissionRepository.findBy({ _id: In(permissionRefs) })
            : [];
        const permissionByRef = new Map(
          permissions.map((permission) => [permission._id, permission]),
        );
        const missingPermissionRefs = permissionRefs.filter(
          (permissionRef) => !permissionByRef.has(permissionRef),
        );

        if (missingPermissionRefs.length > 0) {
          throw new NotFoundException(
            `Permission not found: ${missingPermissionRefs.join(', ')}`,
          );
        }

        await manager.getRepository(RolePermissionAssignment).delete({
          roleRef: In(roles.map((role) => role._id)),
        });

        const rolePermissionAssignments = normalizedAssignments.flatMap(
          (assignment) => {
            const role = roleByRef.get(assignment.role_ref.trim());
            if (!role) {
              throw new NotFoundException(
                `Role ${assignment.role_ref} not found`,
              );
            }

            return assignment.permission_assignments.map(
              (permissionAssignment) =>
                manager.getRepository(RolePermissionAssignment).create({
                  roleRef: role._id,
                  permissionRef: permissionAssignment.permission_ref,
                  scope: permissionAssignment.scope,
                }),
            );
          },
        );

        if (rolePermissionAssignments.length > 0) {
          await manager
            .getRepository(RolePermissionAssignment)
            .save(rolePermissionAssignments);
        }

        return roleRepository.find({
          where: { isActive: true },
          relations: ROLE_PERMISSION_RELATIONS,
          order: { name: 'ASC' },
        });
      },
    );

    await this.clearRolePermissionCache();
    return roles;
  }

  async removeRole(roleRef: string): Promise<void> {
    const role = await this.findRoleByRef(roleRef);
    await this.roleRepository.remove(role);
    await this.clearRolePermissionCache();
  }

  async createPermission(
    createPermissionDto: CreatePermissionDto,
  ): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({
      where: {
        apiPath: createPermissionDto.apiPath,
        method: createPermissionDto.method,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Permission with this path and method already exists',
      );
    }

    const permission = this.permissionRepository.create(createPermissionDto);
    const savedPermission = await this.permissionRepository.save(permission);
    await this.clearRolePermissionCache();
    return savedPermission;
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { module: 'ASC', name: 'ASC' },
    });
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
    const savedPermission = await this.permissionRepository.save(permission);
    await this.clearRolePermissionCache();
    return savedPermission;
  }

  async removePermission(permissionRef: string): Promise<void> {
    const permission = await this.findPermissionByRef(permissionRef);
    await this.permissionRepository.remove(permission);
    await this.clearRolePermissionCache();
  }
}
