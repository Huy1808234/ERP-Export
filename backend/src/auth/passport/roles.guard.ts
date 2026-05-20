import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '@/decorator/customize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';
import { normalizeRoleName } from '@/common/auth/role-catalog';

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userRoleObj = request.user?.role;
    
    // Support both string fallback and Role object
    const userRoleRaw =
      typeof userRoleObj === 'string'
        ? userRoleObj
        : userRoleObj?.name || request.user?.roleName;

    if (!userRoleRaw) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    const userRole = normalizeRoleName(userRoleRaw);
    const normalizedRequiredRoles = requiredRoles.map(normalizeRoleName);

    const hasRole = normalizedRequiredRoles.includes(userRole);

    if (!hasRole) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    return true;
  }
}
