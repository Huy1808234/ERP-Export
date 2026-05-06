import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
export enum PartnerType { CUSTOMER = 'CUSTOMER', SUPPLIER = 'SUPPLIER', LOGISTICS = 'LOGISTICS' }
export enum BuyerRegion { EU = 'EU', US = 'US', ASEAN = 'ASEAN', APAC = 'APAC', MIDDLE_EAST = 'MIDDLE_EAST', OTHER = 'OTHER' }
export enum BuyerPaymentTerm { TT = 'T/T', LC = 'L/C', DP = 'D/P', DA = 'D/A' }
export enum BuyerRiskLevel { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }

@Entity('partners')
export class Partner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: PartnerType })
  partnerType: PartnerType;

  @Column({ type: 'enum', enum: BuyerRegion, nullable: true })
  region: BuyerRegion | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: BuyerPaymentTerm, nullable: true })
  defaultPaymentTerm: BuyerPaymentTerm | null;

  @Column({ type: 'varchar', nullable: true })
  defaultCurrency: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  creditLimit: number | null;

  // Bắt buộc theo Prompt 1: Quản lý công nợ và phân loại rủi ro
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  currentDebt: number;

  @Column({ type: 'enum', enum: BuyerRiskLevel, default: BuyerRiskLevel.LOW })
  riskLevel: BuyerRiskLevel;

  @Column({ default: false })
  isManualRisk: boolean;

  @Column({ type: 'enum', enum: BuyerRiskLevel, nullable: true })
  manualRiskLevel: BuyerRiskLevel | null;

  @Column({ type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAccountName: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAccountNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankSwiftCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAddress: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  vendorCategory: string | null;

  @Column({ type: 'varchar', nullable: true })
  vendorPaymentTerm: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  qualityScore: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  deliveryScore: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  priceScore: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  apBalance: number | null;

  @Column({ type: 'timestamp', nullable: true })
  paymentDueDate: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  taxCode: string | null;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}

