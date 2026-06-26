import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration for contract_signature_invitations table and related enums.
 */
export class CreateContractSignatureInvitationsTable1710000000000 implements MigrationInterface {
  name = 'CreateContractSignatureInvitationsTable1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- Enums ----------
    await queryRunner.query(`
      CREATE TYPE "contract_signature_invitation_status_enum" AS ENUM (
        'CREATED', 'SENT', 'OPENED', 'OTP_VERIFIED', 'SIGNED',
        'EXPIRED', 'REVOKED', 'CANCELLED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "contract_signature_invitation_signertype_enum" AS ENUM (
        'BUYER', 'SELLER', 'WITNESS', 'LEGAL', 'GUARANTOR'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "contract_signature_event_type_enum" AS ENUM (
        'CREATED', 'SENT', 'OPENED', 'OTP_REQUESTED', 'OTP_SENT', 'OTP_VERIFIED',
        'OTP_FAILED', 'OTP_EXPIRED', 'SIGNED', 'EXPIRED', 'REVOKED',
        'CANCELLED', 'EMAIL_SENT', 'EMAIL_FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "contract_signature_actor_type_enum" AS ENUM (
        'BUYER', 'SELLER', 'SYSTEM', 'ADMIN'
      )
    `);

    // ---------- contract_signature_invitations ----------
    await queryRunner.query(`
      CREATE TABLE "contract_signature_invitations" (
        "_id" varchar(40) NOT NULL,
        "contract_id" varchar(40) NOT NULL,
        "signerType" "contract_signature_invitation_signertype_enum" NOT NULL DEFAULT 'BUYER',
        "signerName" varchar NOT NULL,
        "signerTitle" varchar,
        "signerEmail" varchar,
        "tokenHash" varchar NOT NULL,
        "otpHash" varchar,
        "otpExpiresAt" TIMESTAMP,
        "otpAttemptCount" int NOT NULL DEFAULT 0,
        "status" "contract_signature_invitation_status_enum" NOT NULL DEFAULT 'CREATED',
        "expiresAt" TIMESTAMP NOT NULL,
        "sentByUsername" varchar,
        "sentAt" TIMESTAMP,
        "openedAt" TIMESTAMP,
        "verifiedAt" TIMESTAMP,
        "signedAt" TIMESTAMP,
        "revokedAt" TIMESTAMP,
        "revokedByUsername" varchar,
        "revokeReason" text,
        "certificateNumber" varchar,
        "certificateHash" varchar,
        "auditTrail" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contract_signature_invitations" PRIMARY KEY ("_id"),
        CONSTRAINT "FK_contract_signature_invitations_contract"
          FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("_id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_contract_signature_invitations_contract" ON "contract_signature_invitations" ("contract_id", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_contract_signature_invitations_token" ON "contract_signature_invitations" ("tokenHash")`,
    );

    // ---------- contract_signature_events ----------
    await queryRunner.query(`
      CREATE TABLE "contract_signature_events" (
        "_id" varchar(40) NOT NULL,
        "contract_id" varchar(40) NOT NULL,
        "invitation_id" varchar(40),
        "signature_id" varchar(40),
        "eventType" "contract_signature_event_type_enum" NOT NULL,
        "actorType" "contract_signature_actor_type_enum" NOT NULL,
        "actorUsername" varchar,
        "signerEmail" varchar,
        "ipAddress" varchar,
        "userAgent" varchar,
        "documentHash" varchar,
        "note" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contract_signature_events" PRIMARY KEY ("_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_contract_signature_events_contract" ON "contract_signature_events" ("contract_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_contract_signature_events_invitation" ON "contract_signature_events" ("invitation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_contract_signature_events_created" ON "contract_signature_events" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_signature_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_signature_invitations"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "contract_signature_actor_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contract_signature_event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contract_signature_invitation_signertype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contract_signature_invitation_status_enum"`);
  }
}
