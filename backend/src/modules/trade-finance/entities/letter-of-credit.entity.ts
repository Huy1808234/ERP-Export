import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { User } from '@/modules/users/entities/user.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

export enum LCStatus {
  DRAFT = 'DRAFT',
  RECEIVED = 'RECEIVED',
  DOCUMENTS_PRESENTED = 'DOCUMENTS_PRESENTED',
  ACCEPTED = 'ACCEPTED',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum LCType {
  AT_SIGHT = 'AT_SIGHT',
  DEFERRED = 'DEFERRED',
  USANCE = 'USANCE'
}

@Entity('letters_of_credit')
export class LetterOfCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  lcNumber: string;

  @Column()
  salesContractId: string;

  @ManyToOne(() => SalesContract)
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column({ type: 'enum', enum: LCStatus, default: LCStatus.DRAFT })
  status: LCStatus;

  @Column({ type: 'enum', enum: LCType, default: LCType.AT_SIGHT })
  lcType: LCType;

  @Column()
  issuingBank: string;

  @Column({ nullable: true })
  advisingBank: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'timestamp' })
  issueDate: Date;

  @Column({ type: 'timestamp' })
  expiryDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  latestShipmentDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  presentationDeadline: Date;

  @Column({ type: 'text', nullable: true })
  descriptionOfGoods: string;

  @Column({ type: 'text', nullable: true })
  documentsRequired: string;

  @Column({ type: 'text', nullable: true })
  additionalConditions: string;

  @Column({ type: 'text', nullable: true })
  discrepancies: string; // Ghi nhận sai sót chứng từ (Mục 7 PRD)

  @Column({ type: 'text', nullable: true })
  handlingInstructions: string; // Cách thức xử lý sai sót

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
