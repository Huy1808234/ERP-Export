import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: any) {
    console.log('>>> Check JWT Payload in Strategy:', payload);

    // Trả về Object này sẽ được NestJS gán vào req.user
    return { 
      id: payload.sub,        // Đổi _id thành id cho chuẩn Postgres
      username: payload.username, 
      role: payload.role      // Đảm bảo payload.role là string 'ADMIN'
    };
  }
}