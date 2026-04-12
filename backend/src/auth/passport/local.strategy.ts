import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(username, password);

    // 1. Kiểm tra tài khoản hoặc mật khẩu sai
    if (!user) {
      throw new UnauthorizedException('Username or password is incorrect');
    }

    // 2.Kiểm tra nếu tài khoản chưa kích hoạt (isActive = false)
    if (user.isActive === false) {
      throw new BadRequestException(
        'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email để kích hoạt tài khoản.',
      );
    }

    return user;
  }
}
