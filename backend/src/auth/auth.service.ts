import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { comparePasswordHelper } from '@/helpers/util';
import { CreateAuthDto, CodeAuthDto, ChangePasswordAuthDto } from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  // Đã sửa đổi để nhận cả username hoặc email
  async validateUser(usernameOrEmail: string, pass: string): Promise<any> {
    // 1. Kiểm tra xem người dùng nhập vào là email hay name
    const isEmail = usernameOrEmail.includes('@');
    let user: any = null;

    // 2. Tìm kiếm trong database
    if (isEmail) {
      // Lưu ý: Đảm bảo trong users.service.ts của bạn đã viết hàm findByEmail
      user = await this.usersService.findByEmail(usernameOrEmail);
    } else {
      user = await this.usersService.findByName(usernameOrEmail);
    }

    // 3. Nếu không tìm thấy ai
    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    // 4. Nếu tìm thấy thì so sánh mật khẩu
    const isValidPassword = await comparePasswordHelper(pass, user.password);
    if (!isValidPassword) {
      // Trả về null để Passport tự động văng lỗi 401 Unauthorized
      return null;
    }

    return user;
  }

  async login(user: any) {
    const payload = { username: user.name, sub: user._id };
    return {
      user: {
        email: user.email,
        name: user.name,
        _id: user._id,
      },
      access_token: this.jwtService.sign(payload),
    };
  }

  async handleRegister(registerDto: CreateAuthDto) {
    return await this.usersService.handleRegister(registerDto);
  }

  async checkCode(data: CodeAuthDto) {
    return await this.usersService.handleActive(data);
  }

  async retryActive(data: string) {
    return await this.usersService.retryActive(data);
  }

  async forgotPassword(data: string) {
    return await this.usersService.forgotPassword(data);
  }

  async changePassword(data: ChangePasswordAuthDto) {
    return await this.usersService.changePassword(data);
  }
}
