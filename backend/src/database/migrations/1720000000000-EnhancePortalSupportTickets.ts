import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhancePortalSupportTickets1720000000000
  implements MigrationInterface
{
  name = 'EnhancePortalSupportTickets1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "portal_support_messages"
      ADD COLUMN IF NOT EXISTS "visibility" varchar(20) NOT NULL DEFAULT 'PUBLIC'
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'portal_support_tickets_status_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'portal_support_tickets_status_enum'
            AND e.enumlabel = 'WAITING_INTERNAL'
        ) THEN
          ALTER TYPE "portal_support_tickets_status_enum" ADD VALUE 'WAITING_INTERNAL';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "portal_support_messages"
      DROP COLUMN IF EXISTS "visibility"
    `);
  }
}
