import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { Role } from '@/modules/roles/entities/role.entity';
import { Permission } from '@/modules/roles/entities/permission.entity';
import * as bcrypt from 'bcrypt';
import { createEntityId } from '@/common/ids/entity-id.util';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async onApplicationBootstrap() {
    console.log('[DatabaseSeedService] Starting database seed...');
    try {
      await this.seed();
      console.log(
        '[DatabaseSeedService] Database seed completed successfully.',
      );
    } catch (error) {
      console.error('[DatabaseSeedService] Error during database seed:', error);
    }
  }

  async seed() {
    // 1. Seed Roles
    const rolesToSeed = [
      { name: 'ADMIN', description: 'System Administrator' },
      { name: 'PURCHASING', description: 'Purchasing Staff' },
      { name: 'WAREHOUSE', description: 'Warehouse Keeper' },
      { name: 'CHIEF_ACCOUNTANT', description: 'Chief Accountant' },
      { name: 'MANAGER', description: 'General Manager' },
      { name: 'SALES_EXPORT', description: 'Sales Export Staff' },
      { name: 'ACCOUNTANT', description: 'Accountant' },
      { name: 'DIRECTOR', description: 'Director' },
      { name: 'LOGISTICS', description: 'Logistics Staff' },
    ];

    const roleMap = new Map<string, Role>();
    for (const r of rolesToSeed) {
      let role = await this.roleRepository.findOne({ where: { name: r.name } });
      if (!role) {
        role = this.roleRepository.create({
          _id: createEntityId('role'),
          name: r.name,
          description: r.description,
        });
        role = await this.roleRepository.save(role);
        console.log(`[DatabaseSeedService] Created role: ${r.name}`);
      }
      roleMap.set(r.name, role);
    }

    // 2. Seed Permissions
    const permissionsToSeed = [
      {
        _id: '_perm_read_accounting',
        name: 'read:accounting',
        apiPath: '/api/v1/accounting',
        method: 'GET',
        module: 'ACCOUNTING',
      },
      {
        _id: '_perm_write_accounting',
        name: 'write:accounting',
        apiPath: '/api/v1/accounting',
        method: 'POST/PATCH',
        module: 'ACCOUNTING',
      },
    ];

    for (const p of permissionsToSeed) {
      let perm = await this.permissionRepository.findOne({
        where: { _id: p._id },
      });
      if (!perm) {
        perm = this.permissionRepository.create(p);
        await this.permissionRepository.save(perm);
        console.log(`[DatabaseSeedService] Created permission: ${p.name}`);
      }
    }

    // 3. Seed Users
    const defaultPasswordHash = await bcrypt.hash('123456', 10);
    const usersToSeed = [
      {
        username: 'admin_266b1b',
        name: 'Admin User',
        email: 'admin@gmail.com',
        roleName: 'ADMIN',
      },
      {
        username: 'purchasing',
        name: 'Purchasing User',
        email: 'purchasing_test@gmail.com',
        roleName: 'PURCHASING',
      },
      {
        username: 'warehouse',
        name: 'Warehouse User',
        email: 'warehouse_test@gmail.com',
        roleName: 'WAREHOUSE',
      },
      {
        username: 'chief_accountant',
        name: 'Chief Accountant',
        email: 'chief_accountant_test@gmail.com',
        roleName: 'CHIEF_ACCOUNTANT',
      },
      {
        username: 'manager',
        name: 'Manager User',
        email: 'manager_test@gmail.com',
        roleName: 'MANAGER',
      },
      {
        username: 'sales',
        name: 'Sales User',
        email: 'sales_test@gmail.com',
        roleName: 'SALES_EXPORT',
      },
      {
        username: 'accountant',
        name: 'Accountant User',
        email: 'accountant_test@gmail.com',
        roleName: 'ACCOUNTANT',
      },
      {
        username: 'director_test',
        name: 'Director User',
        email: 'director_test@gmail.com',
        roleName: 'DIRECTOR',
      },
    ];

    for (const u of usersToSeed) {
      const exists = await this.userRepository.findOne({
        where: { username: u.username },
      });
      if (!exists) {
        const user = this.userRepository.create({
          _id: createEntityId('user'),
          username: u.username,
          name: u.name,
          email: u.email,
          password: defaultPasswordHash,
          roleName: u.roleName,
          isActive: true,
        });
        await this.userRepository.save(user);
        console.log(`[DatabaseSeedService] Created user: ${u.username}`);
      }
    }
  }
}
