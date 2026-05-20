import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'dayjs';
import { MailerService } from '@nestjs-modules/mailer';
import { In, Repository } from 'typeorm';
import { CodeAuthDto, ChangePasswordAuthDto } from '@/auth/dto/create-auth.dto';
import { normalizeRoleName } from '@/common/auth/role-catalog';
import { createOpaqueCode, normalizeUsername } from '@/common/ids/entity-id.util';
import { hashPasswordHelper } from '@/helpers/util';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private mailerService: MailerService,
  ) {}

  async isEmailExist(email: string) {
    return this.userRepository.existsBy({ email });
  }

  async isUsernameExist(username: string, excludeUserRef?: string) {
    const existing = await this.userRepository.findOne({
      where: { username },
      select: ['_id', 'username'],
    });

    if (!existing) {
      return false;
    }

    return existing._id !== excludeUserRef && existing.username !== excludeUserRef;
  }

  private async resolveRoleName(roleName?: string | null): Promise<string | null> {
    if (!roleName) {
      return null;
    }

    const normalizedRoleName = normalizeRoleName(roleName);
    const role = await this.roleRepository.findOne({ where: { name: normalizedRoleName } });
    if (!role) {
      throw new BadRequestException(`Role does not exist: ${roleName}`);
    }

    return role.name;
  }

  private async createAvailableUsername(seed: string, excludeUserRef?: string) {
    const base = normalizeUsername(seed) || `user.${Date.now()}`;
    let username = base;
    let attempt = 1;

    while (await this.isUsernameExist(username, excludeUserRef)) {
      attempt += 1;
      username = `${base}.${attempt}`;
    }

    return username;
  }

  private sanitizeUser(user: User | null) {
    if (!user) {
      return null;
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }

  async create(createUserDto: CreateUserDto) {
    const { name, email, password, phone, address, image, roleName, username, isActive } =
      createUserDto;

    if (await this.isEmailExist(email)) {
      throw new BadRequestException(`Email already exists: ${email}`);
    }

    const safeUsername = await this.createAvailableUsername(username || email.split('@')[0] || name);
    const resolvedRoleName = await this.resolveRoleName(roleName);
    const hashPassword = await hashPasswordHelper(password);

    const user = this.userRepository.create({
      name,
      username: safeUsername,
      email,
      password: hashPassword,
      phone,
      address,
      image,
      roleName: resolvedRoleName,
      isActive: isActive ?? false,
    });

    const savedUser = await this.userRepository.save(user);

    return {
      _id: savedUser._id,
      username: savedUser.username,
    };
  }

  async findAll(query: string, current: number, pageSize: number) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;
    if (filter.limit) delete filter.limit;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const skip = (current - 1) * pageSize;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions');

    for (const key in filter) {
      const aliasKey = key.includes('.') ? key : `user.${key}`;
      const paramKey = key.replace('.', '_');

      if (filter[key] instanceof RegExp) {
        queryBuilder.andWhere(`${aliasKey} ILIKE :${paramKey}`, {
          [paramKey]: `%${filter[key].source}%`,
        });
      } else {
        queryBuilder.andWhere(`${aliasKey} = :${paramKey}`, { [paramKey]: filter[key] });
      }
    }

    if (sort) {
      for (const key in sort) {
        queryBuilder.addOrderBy(`user.${key}`, (sort as any)[key] === 1 ? 'ASC' : 'DESC');
      }
    } else {
      queryBuilder.addOrderBy('user.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(pageSize);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(totalItems / pageSize);
    const results = resultsRaw.map((user) => this.sanitizeUser(user));

    return { results, totalPages, totalItems };
  }

  async findOne(userRef: string) {
    const user = await this.userRepository.findOne({
      where: [{ _id: userRef }, { username: userRef }],
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userRef}`);
    }

    return this.sanitizeUser(user);
  }

  async findByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
      relations: ['role', 'role.permissions'],
    });
  }

  async findByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username },
      relations: ['role', 'role.permissions'],
    });
  }

  async updateRefreshToken(
    username: string,
    refreshTokenHash: string | null,
    refreshTokenExpiresAt: Date | null,
  ) {
    await this.userRepository.update(
      { username },
      {
        refreshTokenHash,
        refreshTokenExpiresAt,
      },
    );
  }

  async findByName(name: string) {
    return this.userRepository.findOne({
      where: { name },
      relations: ['role', 'role.permissions'],
    });
  }

  async update(userRef: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: [{ _id: userRef }, { username: userRef }],
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    const updateData: Partial<User> = { ...updateUserDto };

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      updateData.username = await this.createAvailableUsername(updateUserDto.username, user._id);
    }

    if (Object.prototype.hasOwnProperty.call(updateUserDto, 'roleName')) {
      updateData.roleName = await this.resolveRoleName(updateUserDto.roleName);
    }

    await this.userRepository.update({ _id: user._id }, updateData);
    const updatedUser = await this.userRepository.findOne({
      where: { _id: user._id },
      relations: ['role', 'role.permissions'],
    });

    return {
      message: 'User updated successfully',
      data: this.sanitizeUser(updatedUser),
    };
  }

  async remove(userRef: string) {
    const user = await this.userRepository.findOne({
      where: [{ _id: userRef }, { username: userRef }],
      select: ['_id', 'username'],
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userRef}`);
    }

    const result = await this.userRepository.delete({ _id: user._id });

    return {
      message: 'User deleted successfully',
      deletedCount: result.affected,
    };
  }

  async bulkRemove(userRefs: string[]) {
    const result = await this.userRepository.delete({ _id: In(userRefs) });
    return {
      message: `Deleted ${result.affected} users successfully`,
      deletedCount: result.affected,
    };
  }

  async handleRegister(createUserDto: CreateUserDto) {
    const { name, email, password, username } = createUserDto;

    if (await this.isEmailExist(email)) {
      throw new BadRequestException(`Email already exists: ${email}`);
    }

    const hashPassword = await hashPasswordHelper(password);
    const codeId = createOpaqueCode('activation');
    const safeUsername = await this.createAvailableUsername(username || email.split('@')[0] || name);

    const user = this.userRepository.create({
      name,
      username: safeUsername,
      email,
      password: hashPassword,
      isActive: false,
      codeId,
      codeExpired: dayjs().add(5, 'minutes').toDate(),
    });
    const savedUser = await this.userRepository.save(user);

    try {
      await this.mailerService.sendMail({
        to: savedUser.email,
        subject: 'Activate your Mini ERP account',
        template: 'register',
        context: {
          name: savedUser?.name ?? savedUser.username,
          activationCode: savedUser.codeId,
        },
      });
    } catch (error) {
      console.error('Failed to send activation email:', error.message);
    }

    return {
      _id: savedUser._id,
      username: savedUser.username,
    };
  }

  async handleActive(data: CodeAuthDto) {
    const user = await this.userRepository.findOneBy({
      _id: data.accountRef,
      codeId: data.code,
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired activation code');
    }

    const isBeforecheck = dayjs().isBefore(user.codeExpired);
    if (isBeforecheck) {
      await this.userRepository.update(
        { _id: data.accountRef },
        { isActive: true, codeId: null, codeExpired: null },
      );
    } else {
      throw new BadRequestException('Invalid or expired activation code');
    }
    return { isBeforecheck };
  }

  async retryActive(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new BadRequestException('Account does not exist');
    }
    if (user.isActive) {
      throw new BadRequestException('Account is already active');
    }

    const codeId = createOpaqueCode('activation');
    await this.userRepository.update(
      { _id: user._id },
      {
        codeId,
        codeExpired: dayjs().add(5, 'minutes').toDate(),
      },
    );

    this.mailerService.sendMail({
      to: user.email,
      subject: 'Activate your Mini ERP account',
      template: 'register',
      context: {
        name: user?.name ?? user.username,
        activationCode: codeId,
      },
    });

    return { _id: user._id, username: user.username };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new BadRequestException('Account does not exist');
    }

    const codeId = createOpaqueCode('password');
    await this.userRepository.update(
      { _id: user._id },
      {
        codeId,
        codeExpired: dayjs().add(5, 'minutes').toDate(),
      },
    );

    this.mailerService.sendMail({
      to: user.email,
      subject: 'Mini ERP password reset code',
      template: 'forgot-password',
      context: {
        name: user?.name ?? user.username,
        activationCode: codeId,
      },
    });

    return { _id: user._id, username: user.username };
  }

  async changePassword(data: ChangePasswordAuthDto) {
    const user = await this.userRepository.findOneBy({
      _id: data.accountRef,
      codeId: data.code,
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password code');
    }

    const isBeforeCheck = dayjs().isBefore(user.codeExpired);
    if (isBeforeCheck) {
      const hashPassword = await hashPasswordHelper(data.password);
      await this.userRepository.update(
        { _id: user._id },
        {
          password: hashPassword,
          codeId: null,
          codeExpired: null,
        },
      );
    } else {
      throw new BadRequestException('Invalid or expired password code');
    }

    return { isBeforeCheck };
  }
}
