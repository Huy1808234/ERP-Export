import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '@/decorator/customize';

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

    const request = context.switchToHttp().getRequest();
    const userRoleObj = request.user?.role;
    
    // Support both string fallback and Role object
    const userRoleRaw = typeof userRoleObj === 'string' ? userRoleObj : userRoleObj?.name;

    if (!userRoleRaw) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    const userRole = userRoleRaw.toUpperCase();
    const normalizedRequiredRoles = requiredRoles.map(r => r.toUpperCase());

    // Special case: "SUPER ADMIN" or "ADMIN" should both count as "ADMIN"
    const hasRole = normalizedRequiredRoles.some(required => {
        if (required === 'ADMIN') {
            return userRole === 'ADMIN' || userRole === 'SUPER ADMIN';
        }
        return userRole === required;
    });

    if (!hasRole) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }

    return true;
  }
}
