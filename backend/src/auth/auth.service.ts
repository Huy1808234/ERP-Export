import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { comparePasswordHelper, hashPasswordHelper } from '@/helpers/util';
import { UsersService } from '@/modules/users/users.service';
import {
  ChangePasswordAuthDto,
  CodeAuthDto,
  CreateAuthDto,
} from './dto/create-auth.dto';
import type { User } from '@/modules/users/entities/user.entity';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

type AccessJwtPayload = {
  _id?: string;
  username: string;
  sub: string;
  roleName?: string | null;
  role?: AuthenticatedUser['role'];
  partnerId?: string | null;
};

type RefreshJwtPayload = {
  username: string;
  sub: string;
  tokenType: 'refresh';
  tokenNonce: string;
};

type DecodedJwt = {
  exp?: number;
};

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(
    usernameOrEmail: string,
    pass: string,
  ): Promise<User | null> {
    const user = usernameOrEmail.includes('@')
      ? await this.usersService.findByEmail(usernameOrEmail)
      : await this.usersService.findByUsername(usernameOrEmail);

    if (!user) {
      throw new UnauthorizedException('Username or password is incorrect');
    }

    const isValidPassword = await comparePasswordHelper(pass, user.password);
    if (!isValidPassword) {
      return null;
    }

    return user;
  }

  private getAccessTokenExpiresIn(): JwtExpiresIn {
    return this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRED',
      '15m',
    ) as JwtExpiresIn;
  }

  private getRefreshTokenExpiresIn(): JwtExpiresIn {
    return this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRED',
      '8h',
    ) as JwtExpiresIn;
  }

  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      `${this.configService.get<string>('JWT_SECRET')}:refresh`
    );
  }

  private buildAccessPayload(user: User): AccessJwtPayload {
    return {
      _id: user._id,
      username: user.username,
      sub: user.username,
      roleName: user.roleName,
      role: user.role
        ? {
            _id: user.role._id,
            name: user.role.name,
          }
        : null,
      partnerId: user.partnerId,
    };
  }

  private signAccessToken(user: User) {
    const accessToken = this.jwtService.sign(this.buildAccessPayload(user), {
      expiresIn: this.getAccessTokenExpiresIn(),
    });
    const decoded = this.jwtService.decode<DecodedJwt>(accessToken);

    return {
      accessToken,
      accessTokenExpiresAt: decoded?.exp
        ? decoded.exp * 1000
        : Date.now() + 15 * 60 * 1000,
    };
  }

  private signRefreshToken(user: User) {
    const refreshToken = this.jwtService.sign(
      {
        username: user.username,
        sub: user.username,
        tokenType: 'refresh',
        tokenNonce: randomBytes(16).toString('hex'),
      } satisfies RefreshJwtPayload,
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.getRefreshTokenExpiresIn(),
      },
    );
    const decoded = this.jwtService.decode<DecodedJwt>(refreshToken);

    return {
      refreshToken,
      refreshTokenExpiresAt: new Date(
        decoded?.exp ? decoded.exp * 1000 : Date.now() + 8 * 60 * 60 * 1000,
      ),
    };
  }

  private digestRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private hashRefreshToken(refreshToken: string): Promise<string> {
    return hashPasswordHelper(this.digestRefreshToken(refreshToken));
  }

  private async compareRefreshToken(
    refreshToken: string,
    refreshTokenHash: string,
  ): Promise<boolean> {
    const digestMatches = await comparePasswordHelper(
      this.digestRefreshToken(refreshToken),
      refreshTokenHash,
    );
    if (digestMatches) {
      return true;
    }

    // Legacy support: tokens issued before refresh-token digesting were bcrypt-hashed raw.
    return Boolean(await comparePasswordHelper(refreshToken, refreshTokenHash));
  }

  private async issueTokenPair(user: User) {
    const { accessToken, accessTokenExpiresAt } = this.signAccessToken(user);
    const { refreshToken, refreshTokenExpiresAt } = this.signRefreshToken(user);
    const refreshTokenHash = await this.hashRefreshToken(refreshToken);

    await this.usersService.updateRefreshToken(
      user.username,
      refreshTokenHash,
      refreshTokenExpiresAt,
    );

    return {
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        roleName: user.roleName,
        role: user.role
          ? {
              _id: user.role._id,
              name: user.role.name,
            }
          : null,
        partnerId: user.partnerId,
        email: user.email,
      },
      access_token: accessToken,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token: refreshToken,
    };
  }

  async login(user: User) {
    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshJwtPayload;

    try {
      payload = this.jwtService.verify<RefreshJwtPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (payload.tokenType !== 'refresh' || !payload.username) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.usersService.findByUsername(payload.username);
    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenHash ||
      !user.refreshTokenExpiresAt
    ) {
      throw new UnauthorizedException('Refresh session is not active');
    }

    if (user.refreshTokenExpiresAt.getTime() <= Date.now()) {
      await this.usersService.updateRefreshToken(user.username, null, null);
      throw new UnauthorizedException('Refresh token is expired');
    }

    const isValidRefreshToken = await this.compareRefreshToken(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!isValidRefreshToken) {
      await this.usersService.updateRefreshToken(user.username, null, null);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    return this.issueTokenPair(user);
  }

  async logout(username: string) {
    await this.usersService.updateRefreshToken(username, null, null);
    return { success: true };
  }

  async handleRegister(registerDto: CreateAuthDto) {
    return this.usersService.handleRegister(registerDto);
  }

  async checkCode(data: CodeAuthDto) {
    return this.usersService.handleActive(data);
  }

  async retryActive(data: string) {
    return this.usersService.retryActive(data);
  }

  async forgotPassword(data: string) {
    return this.usersService.forgotPassword(data);
  }

  async changePassword(data: ChangePasswordAuthDto) {
    return this.usersService.changePassword(data);
  }
}
