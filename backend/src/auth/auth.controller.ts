import {
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Body,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './passport/local-auth.guard';
import { JwtAuthGuard } from './passport/jwt-auth.guard';
import { Public, ResponseMessage } from '@/decorator/customize';
import { CreateAuthDto, CodeAuthDto, ChangePasswordAuthDto } from './dto/create-auth.dto';
import { MailerService } from '@nestjs-modules/mailer';
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
  
  //@UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
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
  retryActive(@Body("email") email: string) {
    return this.authService.retryActive(email);
  }

  @Post('forgot-password')
  @Public()
  forgotPassword(@Body("email") email: string) {
    return this.authService.forgotPassword(email);
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
