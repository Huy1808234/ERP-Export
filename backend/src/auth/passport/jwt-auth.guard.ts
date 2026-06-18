import { AuthGuard } from '@nestjs/passport';
import {
  ExecutionContext,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import { IS_PUBLIC_KEY } from '@/decorator/customize';
import { Reflector } from '@nestjs/core';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Access token không hợp lệ hoặc không có tại header',
        )
      );
    }
    return user;
  }
}
