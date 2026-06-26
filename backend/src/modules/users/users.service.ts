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
import {
  createOpaqueCode,
  normalizeUsername,
} from '@/common/ids/entity-id.util';
import { hashPasswordHelper } from '@/helpers/util';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';
import { Role } from '../roles/entities/role.entity';
import { Partner, PartnerType } from '../partners/entities/partner.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

type UserListQuery = Record<string, unknown>;

export type SafeUser = Omit<
  User,
  'password' | 'refreshTokenHash' | 'codeId' | 'codeExpired' | 'assignId'
>;

export interface UserListSummary {
  total: number;
  active: number;
  admin: number;
}

export interface UserListResponse {
  results: SafeUser[];
  totalPages: number;
  totalItems: number;
  summary: UserListSummary;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    private mailerService: MailerService,
  ) {}

  async isEmailExist(email: string, excludeUserRef?: string) {
    const existing = await this.userRepository.findOne({
      where: { email: this.normalizeEmail(email) },
      select: ['_id', 'username', 'email'],
    });

    if (!existing) {
      return false;
    }

    return (
      existing._id !== excludeUserRef && existing.username !== excludeUserRef
    );
  }

  async isUsernameExist(username: string, excludeUserRef?: string) {
    const existing = await this.userRepository.findOne({
      where: { username },
      select: ['_id', 'username'],
    });

    if (!existing) {
      return false;
    }

    return (
      existing._id !== excludeUserRef && existing.username !== excludeUserRef
    );
  }

  private async resolveRoleName(
    roleName?: string | null,
  ): Promise<string | null> {
    if (!roleName) {
      return null;
    }

    const normalizedRoleName = normalizeRoleName(roleName);
    const role = await this.roleRepository.findOne({
      where: { name: normalizedRoleName },
    });
    if (!role) {
      throw new BadRequestException(`Role does not exist: ${roleName}`);
    }

    return role.name;
  }

  private async ensureCustomerRoleName(): Promise<string> {
    const roleName = 'CUSTOMER';
    const existingRole = await this.roleRepository.findOne({
      where: { name: roleName },
    });

    if (existingRole) {
      return existingRole.name;
    }

    const role = this.roleRepository.create({
      name: roleName,
      description: 'B2B customer portal account',
      isActive: true,
    });
    const savedRole = await this.roleRepository.save(role);

    return savedRole.name;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeQueryText(value: unknown) {
    const raw = Array.isArray(value) ? (value[0] as unknown) : value;
    if (raw === undefined || raw === null) {
      return undefined;
    }

    const text = String(raw).trim();
    if (!text) {
      return undefined;
    }

    const regexLikeValue = text.match(/^\/(.+)\/[a-z]*$/i);
    return regexLikeValue?.[1] || text;
  }

  private normalizeQueryBoolean(value: unknown) {
    const text = this.normalizeQueryText(value)?.toLowerCase();
    if (text === undefined) {
      return undefined;
    }

    if (['true', '1', 'active'].includes(text)) {
      return true;
    }

    if (['false', '0', 'inactive'].includes(text)) {
      return false;
    }

    throw new BadRequestException('Invalid user status filter');
  }

  private isAdminRole(roleName?: string | null) {
    if (!roleName) {
      return false;
    }

    return ['ADMIN', 'SUPER_ADMIN'].includes(normalizeRoleName(roleName));
  }

  private async assertUsernameAvailable(
    username: string,
    excludeUserRef?: string,
  ) {
    if (await this.isUsernameExist(username, excludeUserRef)) {
      throw new BadRequestException(`Username already exists: ${username}`);
    }
  }

  private async assertEmailAvailable(email: string, excludeUserRef?: string) {
    if (await this.isEmailExist(email, excludeUserRef)) {
      throw new BadRequestException(`Email already exists: ${email}`);
    }
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

  private async findOrCreateCustomerPartner(user: User): Promise<Partner> {
    if (user.partnerId) {
      const linkedPartner = await this.partnerRepository.findOne({
        where: { _id: user.partnerId },
      });

      if (linkedPartner) {
        return linkedPartner;
      }
    }

    const existingBuyer = await this.partnerRepository.findOne({
      where: {
        email: user.email,
        partnerType: PartnerType.CUSTOMER,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingBuyer) {
      return existingBuyer;
    }

    const partner = this.partnerRepository.create({
      name: user.name || user.username,
      partnerType: PartnerType.CUSTOMER,
      contactName: user.name || user.username,
      email: user.email,
      phone: user.phone,
      address: user.address,
      defaultCurrency: 'USD',
      isActive: true,
    });

    return this.partnerRepository.save(partner);
  }

  async ensureCustomerPortalAccount(user: User): Promise<User> {
    if (!user) {
      throw new NotFoundException(
        'User is required to ensure a customer portal account',
      );
    }

    const normalizedRole = user.roleName
      ? normalizeRoleName(user.roleName)
      : null;

    // SAFETY: Never turn staff (ADMIN/MANAGER/...) into a CUSTOMER. Only
    // CUSTOMER (or users without a role, e.g. fresh registration) qualify.
    if (normalizedRole && normalizedRole !== 'CUSTOMER') {
      return user;
    }

    // If the user is already a configured CUSTOMER_PORTAL account, do nothing.
    if (
      normalizedRole === 'CUSTOMER' &&
      user.partnerId &&
      user.accountType === 'CUSTOMER_PORTAL'
    ) {
      const current = await this.userRepository.findOne({
        where: { _id: user._id },
        relations: ['role', 'role.permissions', 'partner'],
      });
      return current || user;
    }

    const customerRoleName = await this.ensureCustomerRoleName();
    const partner = await this.findOrCreateCustomerPartner(user);

    if (user.roleName === customerRoleName && user.partnerId === partner._id) {
      return user;
    }

    await this.userRepository.update(
      { _id: user._id },
      {
        roleName: customerRoleName,
        partnerId: partner._id,
        accountType: 'CUSTOMER_PORTAL',
      },
    );

    const updatedUser = await this.userRepository.findOne({
      where: { _id: user._id },
      relations: ['role', 'role.permissions', 'partner'],
    });

    if (!updatedUser) {
      throw new NotFoundException(`User not found: ${user._id}`);
    }

    return updatedUser;
  }

  private sanitizeUser(user: User | null): SafeUser | null {
    if (!user) {
      return null;
    }

    const {
      password: _password,
      refreshTokenHash: _refreshTokenHash,
      codeId: _codeId,
      codeExpired: _codeExpired,
      ...safeUser
    } = user;
    return safeUser as SafeUser;
  }

  async create(createUserDto: CreateUserDto) {
    const {
      name,
      email,
      password,
      phone,
      address,
      image,
      roleName,
      username,
      isActive,
    } = createUserDto;

    const normalizedEmail = this.normalizeEmail(email);
    const safeUsername = normalizeUsername(username || '');
    if (!safeUsername) {
      throw new BadRequestException('Username is required');
    }

    await this.assertEmailAvailable(normalizedEmail);
    await this.assertUsernameAvailable(safeUsername);

    const resolvedRoleName = await this.resolveRoleName(roleName);
    const hashPassword = await hashPasswordHelper(password);

    const user = this.userRepository.create({
      name,
      username: safeUsername,
      email: normalizedEmail,
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

  async findAll(
    query: UserListQuery = {},
    current?: number,
    pageSize?: number,
  ): Promise<UserListResponse> {
    const page = Math.max(Number(current) || 1, 1);
    const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = this.normalizeQueryText(query.search ?? query.name);
    const roleName = this.normalizeQueryText(
      query.roleName ?? query['role.name'],
    );
    const isActive = this.normalizeQueryBoolean(query.isActive);

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions');

    if (search) {
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.username ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (roleName) {
      queryBuilder.andWhere('user.roleName = :roleName', {
        roleName: normalizeRoleName(roleName),
      });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit);
    const results = resultsRaw
      .map((user) => this.sanitizeUser(user))
      .filter((user): user is SafeUser => user !== null);
    const summary: UserListSummary = {
      total: await this.userRepository.count(),
      active: await this.userRepository.count({ where: { isActive: true } }),
      admin: await this.userRepository.count({
        where: { roleName: In(['ADMIN', 'SUPER_ADMIN']) },
      }),
    };

    return { results, totalPages, totalItems, summary };
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

    const { username, email, roleName, isActive, ...editableFields } =
      updateUserDto;
    const updateData: Partial<User> = { ...editableFields };

    if (
      username !== undefined &&
      normalizeUsername(username) !== user.username
    ) {
      throw new BadRequestException(
        'Username cannot be changed after creation',
      );
    }

    if (email !== undefined) {
      const normalizedEmail = this.normalizeEmail(email);
      await this.assertEmailAvailable(normalizedEmail, user._id);
      updateData.email = normalizedEmail;
    }

    if (Object.prototype.hasOwnProperty.call(updateUserDto, 'roleName')) {
      updateData.roleName = await this.resolveRoleName(roleName);
    }

    if (isActive !== undefined) {
      if (!isActive && user.isActive) {
        throw new BadRequestException(
          'Use the deactivate endpoint to disable a user account',
        );
      }

      updateData.isActive = isActive;
      if (isActive && !user.isActive) {
        updateData.deactivatedAt = null;
        updateData.deactivatedByUsername = null;
        updateData.deactivationReason = null;
      }
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

  private async assertCanDeactivate(users: User[], actor?: AuthenticatedUser) {
    const actorUsername = actor?.username;
    if (!actorUsername) {
      throw new BadRequestException('Missing actor username');
    }

    if (users.some((user) => user.username === actorUsername)) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const activeAdminCount = await this.userRepository.count({
      where: { roleName: In(['ADMIN', 'SUPER_ADMIN']), isActive: true },
    });
    const activeAdminTargets = users.filter(
      (user) => user.isActive && this.isAdminRole(user.roleName),
    ).length;

    if (activeAdminTargets > 0 && activeAdminCount - activeAdminTargets < 1) {
      throw new BadRequestException(
        'Cannot deactivate the last active admin account',
      );
    }
  }

  async deactivate(userRef: string, reason: string, actor?: AuthenticatedUser) {
    const reasonText = reason?.trim();
    if (!reasonText || reasonText.length < 3) {
      throw new BadRequestException('Deactivation reason is required');
    }

    const user = await this.userRepository.findOne({
      where: [{ _id: userRef }, { username: userRef }],
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userRef}`);
    }

    await this.assertCanDeactivate([user], actor);

    if (!user.isActive) {
      return {
        message: 'User is already inactive',
        data: this.sanitizeUser(user),
      };
    }

    await this.userRepository.update(
      { _id: user._id },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedByUsername: actor?.username || 'system',
        deactivationReason: reasonText,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    );

    const deactivatedUser = await this.userRepository.findOne({
      where: { _id: user._id },
      relations: ['role', 'role.permissions'],
    });

    return {
      message: 'User deactivated successfully',
      data: this.sanitizeUser(deactivatedUser),
    };
  }

  async bulkDeactivate(
    userRefs: string[],
    reason: string,
    actor?: AuthenticatedUser,
  ) {
    const reasonText = reason?.trim();
    if (!reasonText || reasonText.length < 3) {
      throw new BadRequestException('Deactivation reason is required');
    }

    const uniqueRefs = Array.from(
      new Set(userRefs.map((ref) => ref.trim()).filter(Boolean)),
    );
    if (uniqueRefs.length === 0) {
      throw new BadRequestException('No users selected');
    }

    const users = await this.userRepository.find({
      where: [{ _id: In(uniqueRefs) }, { username: In(uniqueRefs) }],
      relations: ['role', 'role.permissions'],
    });
    const foundRefs = new Set(
      users.flatMap((user) => [user._id, user.username]),
    );
    const missingRefs = uniqueRefs.filter((ref) => !foundRefs.has(ref));
    if (missingRefs.length > 0) {
      throw new NotFoundException(`Users not found: ${missingRefs.join(', ')}`);
    }

    await this.assertCanDeactivate(users, actor);

    const activeUsers = users.filter((user) => user.isActive);
    if (activeUsers.length === 0) {
      return {
        message: 'No active users to deactivate',
        deactivatedCount: 0,
      };
    }

    const result = await this.userRepository.update(
      { _id: In(activeUsers.map((user) => user._id)) },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedByUsername: actor?.username || 'system',
        deactivationReason: reasonText,
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    );

    return {
      message: `Deactivated ${result.affected || 0} users successfully`,
      deactivatedCount: result.affected || 0,
    };
  }

  remove(): never {
    throw new BadRequestException(
      'Physical user deletion is disabled. Use deactivate instead.',
    );
  }

  bulkRemove(): never {
    throw new BadRequestException(
      'Physical user deletion is disabled. Use bulkDeactivate instead.',
    );
  }

  async handleRegister(createUserDto: CreateUserDto) {
    const { name, email, password, username } = createUserDto;
    const normalizedEmail = this.normalizeEmail(email);

    if (await this.isEmailExist(normalizedEmail)) {
      throw new BadRequestException(`Email already exists: ${normalizedEmail}`);
    }

    const hashPassword = await hashPasswordHelper(password);
    const codeId = createOpaqueCode('activation');
    const safeUsername = await this.createAvailableUsername(
      username || normalizedEmail.split('@')[0] || name,
    );
    const customerRoleName = await this.ensureCustomerRoleName();

    const user = this.userRepository.create({
      name,
      username: safeUsername,
      email: normalizedEmail,
      password: hashPassword,
      roleName: customerRoleName,
      isActive: false,
      codeId,
      codeExpired: dayjs().add(5, 'minutes').toDate(),
    });
    const savedUserWithoutPartner = await this.userRepository.save(user);
    const savedUser = await this.ensureCustomerPortalAccount(
      savedUserWithoutPartner,
    );

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
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to send activation email:', message);
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

    void this.mailerService.sendMail({
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

    void this.mailerService.sendMail({
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
