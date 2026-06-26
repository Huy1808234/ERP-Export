import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    console.log('[DatabaseSeedService] Starting database seed...');
    try {
      await this.ensurePurchaseReturnSchema();
      await this.seed();
      console.log(
        '[DatabaseSeedService] Database seed completed successfully.',
      );
    } catch (error) {
      console.error('[DatabaseSeedService] Error during database seed:', error);
    }
  }

  /**
   * Make sure the purchase_return tables exist AND have all the columns
   * the latest entities expect. Idempotent — every step uses IF NOT EXISTS
   * or column-existence checks. Lets developers pick up schema changes
   * without running a migration file.
   */
  private async ensurePurchaseReturnSchema(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const enumExists = async (name: string) => {
        const rows = await queryRunner.query(
          `SELECT 1 FROM pg_type WHERE typname = $1`,
          [name],
        );
        return rows.length > 0;
      };
      const tableExists = async (name: string) => {
        const rows = await queryRunner.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
          [name],
        );
        return rows.length > 0;
      };
      const columnExists = async (table: string, column: string) => {
        const rows = await queryRunner.query(
          `SELECT 1 FROM information_schema.columns
             WHERE table_name = $1 AND column_name = $2`,
          [table, column],
        );
        return rows.length > 0;
      };

      // ----- Enums (created first so tables can reference them) -----
      if (!(await enumExists('purchase_returns_status_enum'))) {
        await queryRunner.query(`
          CREATE TYPE "purchase_returns_status_enum" AS ENUM (
            'DRAFT', 'PENDING_VENDOR', 'SENT', 'CREDITED',
            'REPLACED', 'CLOSED', 'CANCELLED'
          )
        `);
      }
      if (!(await enumExists('purchase_returns_reasoncode_enum'))) {
        await queryRunner.query(`
          CREATE TYPE "purchase_returns_reasoncode_enum" AS ENUM (
            'DEFECTIVE', 'EXPIRED', 'WRONG_SPEC', 'DAMAGED_IN_TRANSIT',
            'OVERSUPPLY', 'QUALITY_REJECT', 'OTHER'
          )
        `);
      }
      if (!(await enumExists('purchase_return_items_condition_enum'))) {
        await queryRunner.query(`
          CREATE TYPE "purchase_return_items_condition_enum" AS ENUM (
            'GOOD', 'DAMAGED', 'DEFECTIVE', 'EXPIRED', 'WRONG_SPEC'
          )
        `);
      }

      // ----- purchase_returns table -----
      if (!(await tableExists('purchase_returns'))) {
        await queryRunner.query(`
          CREATE TABLE "purchase_returns" (
            "_id" varchar(40) NOT NULL,
            "returnNumber" varchar NOT NULL,
            "purchaseOrderId" varchar(40),
            "qualityCheckId" varchar(40),
            "claimNumber" varchar,
            "status" "purchase_returns_status_enum" NOT NULL DEFAULT 'DRAFT',
            "sentByUsername" varchar(120),
            "sentAt" timestamptz,
            "resolvedByUsername" varchar(120),
            "resolvedAt" timestamptz,
            "settlementType" varchar,
            "settlementNote" text,
            "returnDate" timestamp NOT NULL,
            "reasonCode" "purchase_returns_reasoncode_enum",
            "reason" text,
            "createdByUsername" varchar NOT NULL,
            "totalRefundableAmount" numeric(18,2) NOT NULL DEFAULT 0,
            "currency" varchar(8) NOT NULL DEFAULT 'VND',
            "creditNoteNumber" varchar(80),
            "replacementPurchaseOrderId" varchar(40),
            "carrierTrackingRef" varchar(120),
            "expectedPickupAt" timestamptz,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_purchase_returns" PRIMARY KEY ("_id")
          )
        `);
      }
      if (!(await tableExists('purchase_return_items'))) {
        await queryRunner.query(`
          CREATE TABLE "purchase_return_items" (
            "_id" varchar(40) NOT NULL,
            "purchaseReturnId" varchar NOT NULL,
            "productId" varchar NOT NULL,
            "quantity" numeric(12,2) NOT NULL,
            "unit" varchar,
            "unitPrice" numeric(18,2) NOT NULL DEFAULT 0,
            "lineRefundAmount" numeric(18,2) NOT NULL DEFAULT 0,
            "condition" "purchase_return_items_condition_enum" NOT NULL DEFAULT 'DAMAGED',
            "batchNumber" varchar(80),
            "expiryDate" timestamptz,
            "note" text,
            CONSTRAINT "PK_purchase_return_items" PRIMARY KEY ("_id")
          )
        `);
      }

      const addColumn = async (
        table: string,
        column: string,
        definition: string,
      ) => {
        if (!(await columnExists(table, column))) {
          await queryRunner.query(
            `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`,
          );
        }
      };

      await addColumn(
        'purchase_returns',
        'reasonCode',
        '"purchase_returns_reasoncode_enum"',
      );
      await addColumn(
        'purchase_returns',
        'totalRefundableAmount',
        'numeric(18,2) NOT NULL DEFAULT 0',
      );
      await addColumn(
        'purchase_returns',
        'currency',
        `varchar(8) NOT NULL DEFAULT 'VND'`,
      );
      await addColumn('purchase_returns', 'creditNoteNumber', 'varchar(80)');
      await addColumn(
        'purchase_returns',
        'replacementPurchaseOrderId',
        'varchar(40)',
      );
      await addColumn(
        'purchase_returns',
        'carrierTrackingRef',
        'varchar(120)',
      );
      await addColumn('purchase_returns', 'expectedPickupAt', 'timestamptz');

      await addColumn(
        'purchase_return_items',
        'unitPrice',
        'numeric(18,2) NOT NULL DEFAULT 0',
      );
      await addColumn(
        'purchase_return_items',
        'lineRefundAmount',
        'numeric(18,2) NOT NULL DEFAULT 0',
      );
      await addColumn(
        'purchase_return_items',
        'condition',
        `"purchase_return_items_condition_enum" NOT NULL DEFAULT 'DAMAGED'`,
      );
      await addColumn('purchase_return_items', 'batchNumber', 'varchar(80)');
      await addColumn('purchase_return_items', 'expiryDate', 'timestamptz');
      await addColumn('purchase_return_items', 'note', 'text');

      // Attachments table.
      if (!(await tableExists('purchase_return_attachments'))) {
        await queryRunner.query(`
          CREATE TABLE "purchase_return_attachments" (
            "_id" varchar(40) NOT NULL,
            "purchaseReturnId" varchar(40) NOT NULL,
            "fileUrl" varchar(500) NOT NULL,
            "fileName" varchar(200),
            "mimeType" varchar(80),
            "fileSize" integer,
            "category" varchar(30) NOT NULL DEFAULT 'EVIDENCE',
            "uploadedByUsername" varchar(120),
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_purchase_return_attachments" PRIMARY KEY ("_id")
          )
        `);
        await queryRunner.query(`
          CREATE INDEX "IDX_purchase_return_attachments_purchaseReturnId"
            ON "purchase_return_attachments" ("purchaseReturnId")
        `);
        await queryRunner.query(`
          ALTER TABLE "purchase_return_attachments"
            ADD CONSTRAINT "FK_purchase_return_attachments_purchaseReturn"
            FOREIGN KEY ("purchaseReturnId")
            REFERENCES "purchase_returns"("_id")
            ON DELETE CASCADE
        `);
      }
    } finally {
      await queryRunner.release();
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
      { name: 'CUSTOMER', description: 'B2B Customer Portal User' },
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
