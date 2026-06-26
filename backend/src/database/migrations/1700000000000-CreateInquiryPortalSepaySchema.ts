import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration for the new product_inquiries, portal_* and
 * sepay_transactions tables. Mirrors the TypeORM entity definitions exactly
 * (column names, nullability, enums, indexes, FKs) so that production deploys
 * no longer depend on `synchronize: true`.
 */
export class CreateInquiryPortalSepaySchema1700000000000 implements MigrationInterface {
  name = 'CreateInquiryPortalSepaySchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- Enums ----------
    await queryRunner.query(`
      CREATE TYPE "product_inquiries_status_enum" AS ENUM (
        'SUBMITTED', 'IN_REVIEW', 'QUOTED', 'CLOSED',
        'PENDING', 'PROCESSED', 'REJECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_notifications_type_enum" AS ENUM (
        'FINANCE', 'DOCUMENT', 'SHIPMENT', 'SUPPORT', 'SYSTEM'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_notifications_severity_enum" AS ENUM (
        'INFO', 'SUCCESS', 'WARNING', 'ERROR'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_payment_receipts_rectype_enum" AS ENUM (
        'TT_ADVANCE', 'TT_BALANCE'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_payment_receipts_status_enum" AS ENUM (
        'SUBMITTED', 'CONFIRMED', 'REJECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_support_tickets_category_enum" AS ENUM (
        'QUALITY', 'LOGISTICS', 'FINANCE', 'DOCUMENT', 'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_support_tickets_priority_enum" AS ENUM (
        'LOW', 'MEDIUM', 'HIGH', 'URGENT'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_support_tickets_status_enum" AS ENUM (
        'OPEN', 'IN_PROGRESS', 'WAITING_BUYER', 'RESOLVED', 'CLOSED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "portal_support_messages_authortype_enum" AS ENUM (
        'BUYER', 'STAFF'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "sepay_transactions_transfertype_enum" AS ENUM ('in', 'out')
    `);

    await queryRunner.query(`
      CREATE TYPE "sepay_transactions_status_enum" AS ENUM (
        'RECEIVED', 'MATCHED', 'CONFIRMED', 'IGNORED', 'FAILED'
      )
    `);

    // ---------- product_inquiries ----------
    await queryRunner.query(`
      CREATE TABLE "product_inquiries" (
        "_id" varchar(40) NOT NULL,
        "inquiryNumber" varchar UNIQUE,
        "buyer_id" varchar(40),
        "customerName" varchar NOT NULL,
        "customerEmail" varchar NOT NULL,
        "customerPhone" varchar,
        "productId" varchar(40) NOT NULL,
        "productSnapshotName" varchar,
        "productSnapshotCode" varchar,
        "lineItems" jsonb NOT NULL DEFAULT '[]',
        "quantity" numeric(12,2) NOT NULL DEFAULT 1,
        "incoterm" varchar,
        "destinationPort" varchar,
        "expectedShipmentDate" TIMESTAMP,
        "targetPriceCurrency" varchar,
        "note" text,
        "status" "product_inquiries_status_enum" NOT NULL DEFAULT 'SUBMITTED',
        "assigned_sales_username" varchar,
        "created_by_username" varchar,
        "sourceIp" varchar,
        "idempotencyKey" varchar,
        "requestSnapshot" jsonb,
        "auditTrail" jsonb NOT NULL DEFAULT '[]',
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_product_inquiries" PRIMARY KEY ("_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_product_inquiries_buyer" ON "product_inquiries" ("buyer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_inquiries_status" ON "product_inquiries" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_product_inquiries_created" ON "product_inquiries" ("createdAt")`,
    );

    // ---------- portal_notifications ----------
    await queryRunner.query(`
      CREATE TABLE "portal_notifications" (
        "_id" varchar(40) NOT NULL,
        "buyerId" varchar(40) NOT NULL,
        "type" "portal_notifications_type_enum" NOT NULL,
        "severity" "portal_notifications_severity_enum" NOT NULL DEFAULT 'INFO',
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "referenceType" varchar,
        "referenceId" varchar(40),
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_portal_notifications" PRIMARY KEY ("_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_portal_notifications_buyer_read" ON "portal_notifications" ("buyerId", "readAt")`,
    );

    // ---------- portal_payment_receipts ----------
    await queryRunner.query(`
      CREATE TABLE "portal_payment_receipts" (
        "_id" varchar(40) NOT NULL,
        "receiptNumber" varchar NOT NULL UNIQUE,
        "buyerId" varchar(40) NOT NULL,
        "accountReceivableId" varchar(40),
        "salesContractId" varchar(40),
        "receiptType" "portal_payment_receipts_rectype_enum" NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'USD',
        "exchangeRate" numeric(15,6) NOT NULL DEFAULT 1,
        "bankReference" varchar,
        "remittingBank" varchar,
        "transactionDate" TIMESTAMP,
        "fileAsset_id" varchar(40) NOT NULL,
        "tradeFinanceTransactionId" varchar(40),
        "status" "portal_payment_receipts_status_enum" NOT NULL DEFAULT 'SUBMITTED',
        "submittedByUsername" varchar NOT NULL,
        "submittedAt" TIMESTAMP NOT NULL,
        "reviewedByUsername" varchar,
        "reviewedAt" TIMESTAMP,
        "rejectionReason" text,
        "note" text,
        "auditTrail" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_portal_payment_receipts" PRIMARY KEY ("_id"),
        CONSTRAINT "FK_portal_payment_receipts_buyer"
          FOREIGN KEY ("buyerId") REFERENCES "partners"("_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_portal_payment_receipts_ar"
          FOREIGN KEY ("accountReceivableId") REFERENCES "account_receivables"("_id") ON DELETE SET NULL,
        CONSTRAINT "FK_portal_payment_receipts_contract"
          FOREIGN KEY ("salesContractId") REFERENCES "sales_contracts"("_id") ON DELETE SET NULL,
        CONSTRAINT "FK_portal_payment_receipts_file"
          FOREIGN KEY ("fileAsset_id") REFERENCES "file_assets"("_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_portal_payment_receipts_tftx"
          FOREIGN KEY ("tradeFinanceTransactionId") REFERENCES "trade_finance_transactions"("_id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_portal_payment_receipts_buyer" ON "portal_payment_receipts" ("buyerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_portal_payment_receipts_ar" ON "portal_payment_receipts" ("accountReceivableId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_portal_payment_receipts_contract" ON "portal_payment_receipts" ("salesContractId")`,
    );

    // ---------- portal_support_tickets ----------
    await queryRunner.query(`
      CREATE TABLE "portal_support_tickets" (
        "_id" varchar(40) NOT NULL,
        "ticketNumber" varchar NOT NULL UNIQUE,
        "buyerId" varchar(40) NOT NULL,
        "shipmentId" varchar(40),
        "subject" varchar NOT NULL,
        "category" "portal_support_tickets_category_enum" NOT NULL DEFAULT 'OTHER',
        "priority" "portal_support_tickets_priority_enum" NOT NULL DEFAULT 'MEDIUM',
        "status" "portal_support_tickets_status_enum" NOT NULL DEFAULT 'OPEN',
        "createdByUsername" varchar NOT NULL,
        "assignedToUsername" varchar,
        "lastMessageAt" TIMESTAMP,
        "closedAt" TIMESTAMP,
        "attachments" jsonb,
        "auditTrail" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_portal_support_tickets" PRIMARY KEY ("_id"),
        CONSTRAINT "FK_portal_support_tickets_buyer"
          FOREIGN KEY ("buyerId") REFERENCES "partners"("_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_portal_support_tickets_shipment"
          FOREIGN KEY ("shipmentId") REFERENCES "shipments"("_id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_portal_support_tickets_buyer" ON "portal_support_tickets" ("buyerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_portal_support_tickets_status" ON "portal_support_tickets" ("status")`,
    );

    // ---------- portal_support_messages ----------
    await queryRunner.query(`
      CREATE TABLE "portal_support_messages" (
        "_id" varchar(40) NOT NULL,
        "ticket_id" varchar(40) NOT NULL,
        "authorUsername" varchar NOT NULL,
        "authorType" "portal_support_messages_authortype_enum" NOT NULL,
        "message" text NOT NULL,
        "attachments" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_portal_support_messages" PRIMARY KEY ("_id"),
        CONSTRAINT "FK_portal_support_messages_ticket"
          FOREIGN KEY ("ticket_id") REFERENCES "portal_support_tickets"("_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_portal_support_messages_ticket" ON "portal_support_messages" ("ticket_id")`,
    );

    // ---------- sepay_transactions ----------
    await queryRunner.query(`
      CREATE TABLE "sepay_transactions" (
        "_id" varchar(40) NOT NULL,
        "externalTransactionId" varchar NOT NULL UNIQUE,
        "gateway" varchar,
        "transactionDate" TIMESTAMP,
        "accountNumber" varchar,
        "subAccount" varchar,
        "transferType" "sepay_transactions_transfertype_enum" NOT NULL,
        "transferAmount" numeric(20,2) NOT NULL,
        "accumulated" numeric(20,2),
        "code" varchar,
        "content" text,
        "referenceCode" varchar,
        "description" text,
        "status" "sepay_transactions_status_enum" NOT NULL,
        "matchedPortalReceiptId" varchar(40),
        "matchedAt" TIMESTAMP,
        "processingNote" text,
        "rawPayload" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sepay_transactions" PRIMARY KEY ("_id"),
        CONSTRAINT "FK_sepay_transactions_receipt"
          FOREIGN KEY ("matchedPortalReceiptId") REFERENCES "portal_payment_receipts"("_id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sepay_transactions_reference" ON "sepay_transactions" ("referenceCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sepay_transactions_code" ON "sepay_transactions" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sepay_transactions_status" ON "sepay_transactions" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sepay_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_support_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_support_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_payment_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_inquiries"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "sepay_transactions_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "sepay_transactions_transfertype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_support_messages_authortype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_support_tickets_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_support_tickets_priority_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_support_tickets_category_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_payment_receipts_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_payment_receipts_rectype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_notifications_severity_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "portal_notifications_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "product_inquiries_status_enum"`,
    );
  }
}
