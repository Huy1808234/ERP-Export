import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesContractShipmentDocumentType1718000000000
  implements MigrationInterface
{
  name = 'AddSalesContractShipmentDocumentType1718000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'shipment_documents_documenttype_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum enum_value
          JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
          WHERE enum_type.typname = 'shipment_documents_documenttype_enum'
            AND enum_value.enumlabel = 'SALES_CONTRACT'
        ) THEN
          ALTER TYPE "shipment_documents_documenttype_enum"
            ADD VALUE 'SALES_CONTRACT';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
  }
}
