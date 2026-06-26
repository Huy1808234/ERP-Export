import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds new fields to purchase_returns / purchase_return_items and a new
 * purchase_return_attachments table. Mirrors the latest TypeORM entity.
 */
export class AddPurchaseReturnEnhancements1717000000000 implements MigrationInterface {
  name = 'AddPurchaseReturnEnhancements1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- Enums ----------
    await queryRunner.query(`
      CREATE TYPE "purchase_returns_reasoncode_enum" AS ENUM (
        'DEFECTIVE', 'EXPIRED', 'WRONG_SPEC', 'DAMAGED_IN_TRANSIT',
        'OVERSUPPLY', 'QUALITY_REJECT', 'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "purchase_return_items_condition_enum" AS ENUM (
        'GOOD', 'DAMAGED', 'DEFECTIVE', 'EXPIRED', 'WRONG_SPEC'
      )
    `);

    // ---------- purchase_returns ----------
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "reasonCode" "purchase_returns_reasoncode_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "totalRefundableAmount" numeric(18,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "currency" varchar(8) NOT NULL DEFAULT 'VND'
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "creditNoteNumber" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "replacementPurchaseOrderId" varchar(40)
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "carrierTrackingRef" varchar(120)
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        ADD COLUMN "expectedPickupAt" timestamptz
    `);

    // Index for the credit-note lookup (must be unique where present).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_purchase_returns_creditNoteNumber_unique"
        ON "purchase_returns" ("creditNoteNumber")
        WHERE "creditNoteNumber" IS NOT NULL
    `);

    // Index for the replacement PO lookup.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_purchase_returns_replacementPurchaseOrderId_unique"
        ON "purchase_returns" ("replacementPurchaseOrderId")
        WHERE "replacementPurchaseOrderId" IS NOT NULL
    `);

    // ---------- purchase_return_items ----------
    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        ADD COLUMN "unitPrice" numeric(18,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        ADD COLUMN "lineRefundAmount" numeric(18,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        ADD COLUMN "condition" "purchase_return_items_condition_enum"
        NOT NULL DEFAULT 'DAMAGED'
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        ADD COLUMN "batchNumber" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        ADD COLUMN "expiryDate" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        ADD COLUMN "note" text
    `);

    // ---------- purchase_return_attachments ----------
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_return_attachments" DROP CONSTRAINT IF EXISTS "FK_purchase_return_attachments_purchaseReturn"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_return_attachments"`);

    await queryRunner.query(`
      ALTER TABLE "purchase_return_items"
        DROP COLUMN IF EXISTS "note",
        DROP COLUMN IF EXISTS "expiryDate",
        DROP COLUMN IF EXISTS "batchNumber",
        DROP COLUMN IF EXISTS "condition",
        DROP COLUMN IF EXISTS "lineRefundAmount",
        DROP COLUMN IF EXISTS "unitPrice"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "purchase_return_items_condition_enum"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchase_returns_replacementPurchaseOrderId_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchase_returns_creditNoteNumber_unique"`,
    );
    await queryRunner.query(`
      ALTER TABLE "purchase_returns"
        DROP COLUMN IF EXISTS "expectedPickupAt",
        DROP COLUMN IF EXISTS "carrierTrackingRef",
        DROP COLUMN IF EXISTS "replacementPurchaseOrderId",
        DROP COLUMN IF EXISTS "creditNoteNumber",
        DROP COLUMN IF EXISTS "currency",
        DROP COLUMN IF EXISTS "totalRefundableAmount",
        DROP COLUMN IF EXISTS "reasonCode"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "purchase_returns_reasoncode_enum"`);
  }
}
