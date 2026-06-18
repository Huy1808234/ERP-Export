import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

type JwtPayload = {
  _id?: string;
  username: string;
  sub?: string;
  roleName?: string | null;
  role?: AuthenticatedUser['role'];
  partnerId?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return {
      _id: payload._id,
      username: payload.username,
      roleName: payload.roleName,
      role: payload.role,
      partnerId: payload.partnerId,
    };
  }
}
