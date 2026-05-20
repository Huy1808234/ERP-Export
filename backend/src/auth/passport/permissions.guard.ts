import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '@/decorator/customize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

type RequestWithUser = {
  user?: AuthenticatedUser;
};

function normalizeRoleName(user?: AuthenticatedUser): string {
  const role = user?.role;
  const roleName = typeof role === 'string' ? role : role?.name || user?.roleName;

  return roleName?.toUpperCase() || '';
}

function getPermissionNames(user: AuthenticatedUser): Set<string> {
  const role = user.role;
  const rolePermissions =
    role && typeof role === 'object' && Array.isArray(role.permissions)
      ? role.permissions
      : [];

  return new Set(
    rolePermissions
      .map((permission) => permission.name)
      .filter((name): name is string => Boolean(name)),
  );
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    
    if (!user || !user.role) {
        throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    // Admin has all permissions
    const userRole = normalizeRoleName(user);
    if (userRole === 'ADMIN' || userRole === 'SUPER ADMIN') {
        return true;
    }

    const userPermissions = getPermissionNames(user);
    
    const hasPermission = requiredPermissions.every(permission => 
        userPermissions.has(permission) ||
        userPermissions.has('read:all') ||
        userPermissions.has('manage:all')
    );

    if (!hasPermission) {
      throw new ForbiddenException('Bạn không có quyền thực hiện hành động này');
    }

    return true;
  }
}
