import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { normalizeRoleName as normalizeRoleAlias } from '@/common/auth/role-catalog';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '@/decorator/customize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';
import { RolesService } from '@/modules/roles/roles.service';

type RequestWithUser = {
  user?: AuthenticatedUser;
};

function normalizeUserRoleName(user?: AuthenticatedUser): string {
  const role = user?.role;
  const roleName =
    typeof role === 'string' ? role : role?.name || user?.roleName;

  return normalizeRoleAlias(roleName);
}

function getRoleRef(user: AuthenticatedUser): string {
  const role = user.role;
  if (typeof role === 'string') return role;
  return role?._id || role?.name || user.roleName || '';
}

function hasRequiredPermissions(
  userPermissions: Set<string>,
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.every((permission) => {
    if (userPermissions.has(permission) || userPermissions.has('manage:all')) {
      return true;
    }

    if (permission.startsWith('read:') && userPermissions.has('read:all')) {
      return true;
    }

    const [actionName, subjectName] = permission.split(':');
    if (
      subjectName &&
      (actionName === 'create' || actionName === 'update') &&
      userPermissions.has(`write:${subjectName}`)
    ) {
      return true;
    }

    return false;
  });
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException(
        'Ban khong co quyen truy cap tai nguyen nay',
      );
    }

    if (normalizeUserRoleName(user) === 'ADMIN') {
      return true;
    }

    const permissionSnapshot =
      await this.rolesService.getAuthPermissionSnapshot(getRoleRef(user));
    user.permissionScopes = permissionSnapshot.permissionScopes;

    const hasPermission = hasRequiredPermissions(
      new Set(permissionSnapshot.permissionNames),
      requiredPermissions,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Ban khong co quyen thuc hien hanh dong nay',
      );
    }

    return true;
  }
}
