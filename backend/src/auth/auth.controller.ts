import {
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './passport/local-auth.guard';
import { Public, ResponseMessage, User } from '@/decorator/customize';
import {
  ChangePasswordAuthDto,
  CodeAuthDto,
  CreateAuthDto,
  ForgotPasswordAuthDto,
  RefreshTokenAuthDto,
} from './dto/create-auth.dto';
import { MailerService } from '@nestjs-modules/mailer';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
  ) {}

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @ResponseMessage('Đăng nhập thành công')
  handleLogin(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @Public()
  refresh(@Body() refreshDto: RefreshTokenAuthDto) {
    return this.authService.refresh(refreshDto.refreshToken);
  }

  @Post('logout')
  logout(@User() user: AuthenticatedUser) {
    return this.authService.logout(user.username || '');
  }

  //@UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@User() user: AuthenticatedUser) {
    if (!user.username) {
      throw new UnauthorizedException('User session is invalid');
    }

    return this.authService.getCurrentProfile(user.username);
  }

  @Post('register')
  @Public()
  register(@Body() registerDto: CreateAuthDto) {
    return this.authService.handleRegister(registerDto);
  }

  @Post('check-code')
  @Public()
  checkCode(@Body() registerDto: CodeAuthDto) {
    return this.authService.checkCode(registerDto);
  }

  @Post('retry-active')
  @Public()
  retryActive(@Body('email') email: string) {
    return this.authService.retryActive(email);
  }

  @Post('forgot-password')
  @Public()
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordAuthDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('me/password-reset-code')
  requestCurrentUserPasswordResetCode(@User() user: AuthenticatedUser) {
    if (!user.username) {
      throw new UnauthorizedException('User session is invalid');
    }

    return this.authService.requestCurrentUserPasswordOtp(user.username);
  }

  @Post('change-password')
  @Public()
  changePassword(@Body() data: ChangePasswordAuthDto) {
    return this.authService.changePassword(data);
  }

  @Get('mail')
  @Public()
  testmail() {
    this.mailerService.sendMail({
      to: 'haihuy.nguyen.amg@gmail.com', // list of receivers
      subject: 'Testing Nest MailerModule ✔', // Subject line
      template: 'register',
      context: {
        name: 'Phan An',
        activationCode: 'Hello Well Come to Mini ERP System Amit Group',
      },
    });
    return 'ok';
  }
}
