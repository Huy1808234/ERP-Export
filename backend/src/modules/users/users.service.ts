import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CodeAuthDto, ChangePasswordAuthDto } from '@/auth/dto/create-auth.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { hashPasswordHelper } from '@/helpers/util';

import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailerService: MailerService,
  ) { }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  isEmailExist = async (email: string) => {
    return await this.userRepository.existsBy({ email });
  };

  async create(createUserDto: CreateUserDto) {
    const { name, email, password, phone, address, image, roleId, isActive } = createUserDto;

    const isExist = await this.isEmailExist(email);
    if (isExist) {
      throw new BadRequestException(
        `Email đã tồn tại: ${email}. Vui lòng sử dụng email khác.`,
      );
    }

    const hashPassword = await hashPasswordHelper(password);

    const user = this.userRepository.create({
      name,
      email,
      password: hashPassword,
      phone,
      address,
      image,
      roleId,
      isActive: isActive ?? false,
    });

    const savedUser = await this.userRepository.save(user);

    return {
      id: savedUser.id,
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

    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    for (const key in filter) {
      const aliasKey = key.includes('.') ? key : `user.${key}`;
      const paramKey = key.replace('.', '_');

      if (filter[key] instanceof RegExp) {
        queryBuilder.andWhere(`${aliasKey} ILIKE :${paramKey}`, { [paramKey]: `%${filter[key].source}%` });
      } else {
        queryBuilder.andWhere(`${aliasKey} = :${paramKey}`, { [paramKey]: filter[key] });
      }
    }

    if (sort) {
      for (const key in sort) {
        queryBuilder.addOrderBy(`user.${key}`, (sort as any)[key] === 1 ? 'ASC' : 'DESC');
      }
    }

    queryBuilder.skip(skip).take(pageSize);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(totalItems / pageSize);

    const results = resultsRaw.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return { results, totalPages, totalItems };
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }
    return await this.userRepository.findOne({
      where: { id },
      relations: ['role']
    });
  }

  async findByEmail(email: string) {
    return await this.userRepository.findOneBy({ email });
  }

  async findByName(name: string) {
    return await this.userRepository.findOneBy({ name });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const { id: dummy, ...updateData } = updateUserDto;

    await this.userRepository.update({ id }, updateData);
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role']
    });

    if (!user) {
      throw new NotFoundException(`User không tồn tại`);
    }

    const { password, ...responseData } = user;

    return {
      message: 'Cập nhật user thành công',
      data: responseData,
    };
  }

  async remove(id: string) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const result = await this.userRepository.delete({ id });

    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy user với id: ${id}`);
    }

    return {
      message: 'Xoá user thành công',
      deletedCount: result.affected,
    };
  }

  async bulkRemove(ids: string[]) {
    const result = await this.userRepository.delete(ids);
    return {
      message: `Xoá thành công ${result.affected} người dùng`,
      deletedCount: result.affected,
    };
  }

  async handleRegister(createUserDto: CreateUserDto) {
    const { name, email, password } = createUserDto;

    const isExist = await this.isEmailExist(email);
    if (isExist) {
      throw new BadRequestException(
        `Email đã tồn tại: ${email}. Vui lòng sử dụng email khác.`,
      );
    }

    const hashPassword = await hashPasswordHelper(password);
    const codeId = uuidv4();

    const user = this.userRepository.create({
      name,
      email,
      password: hashPassword,
      isActive: false,
      codeId: codeId,
      codeExpired: dayjs().add(5, 'minutes').toDate(),
    });
    const savedUser = await this.userRepository.save(user);

    try {
      await this.mailerService.sendMail({
        to: savedUser.email,
        subject: 'Kích hoạt tài khoản amit group ✔',
        template: 'register',
        context: {
          name: savedUser?.name ?? savedUser.email,
          activationCode: savedUser.codeId,
        },
      });
    } catch (error) {
      console.error('Gửi email thất bại:', error.message);
    }

    return {
      id: savedUser.id,
    };
  }

  async handleActive(data: CodeAuthDto) {
    const user = await this.userRepository.findOneBy({
      id: data.id,
      codeId: data.code
    });

    if (!user) {
      throw new BadRequestException(`Code không chính xác hoặc đã hết hạn `);
    }

    const isBeforecheck = dayjs().isBefore(user.codeExpired);
    if (isBeforecheck) {
      await this.userRepository.update(
        { id: data.id },
        { isActive: true, codeId: null, codeExpired: null }
      );
    } else {
      throw new BadRequestException(`Code không chính xác hoặc đã hết hạn `);
    }
    return { isBeforecheck };
  }

  async retryActive(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new BadRequestException(`Tài Khoản Không Tồn Tại`);
    }
    if (user.isActive) {
      throw new BadRequestException(`Tài Khoản Đã Được Kích Hoạt`);
    }

    const codeId = uuidv4();
    await this.userRepository.update(
      { id: user.id },
      {
        codeId: codeId,
        codeExpired: dayjs().add(5, 'minutes').toDate(),
      }
    );

    this.mailerService.sendMail({
      to: user.email,
      subject: 'Kích hoạt tài khoản amit group ',
      template: 'register',
      context: {
        name: user?.name ?? user.email,
        activationCode: codeId,
      },
    });

    return { id: user.id };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new BadRequestException(`Tài Khoản Không Tồn Tại`);
    }

    const codeId = uuidv4();
    await this.userRepository.update(
      { id: user.id },
      {
        codeId: codeId,
        codeExpired: dayjs().add(5, 'minutes').toDate(),
      }
    );

    this.mailerService.sendMail({
      to: user.email,
      subject: 'Mã xác nhận đổi mật khẩu Amit Group',
      template: 'forgot-password',
      context: {
        name: user?.name ?? user.email,
        activationCode: codeId,
      },
    });

    return { id: user.id };
  }

  async changePassword(data: ChangePasswordAuthDto) {
    const user = await this.userRepository.findOneBy({
      id: data.id,
      codeId: data.code
    });

    if (!user) {
      throw new BadRequestException(`Code không chính xác hoặc đã hết hạn`);
    }

    const isBeforeCheck = dayjs().isBefore(user.codeExpired);
    if (isBeforeCheck) {
      const hashPassword = await hashPasswordHelper(data.password);
      await this.userRepository.update(
        { id: user.id },
        {
          password: hashPassword,
          codeId: null,
          codeExpired: null
        }
      );
    } else {
      throw new BadRequestException(`Code không chính xác hoặc đã hết hạn`);
    }

    return { isBeforeCheck };
  }
}
