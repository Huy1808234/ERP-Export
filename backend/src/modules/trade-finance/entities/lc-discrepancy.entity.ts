import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { User } from '@/modules/users/entities/user.entity';
import { LetterOfCredit } from './letter-of-credit.entity';

export enum LCDiscrepancySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum LCDiscrepancyStatus {
  OPEN = 'OPEN',
  AMENDED = 'AMENDED',
  WAIVED = 'WAIVED',
  ACCEPTED_BY_BUYER = 'ACCEPTED_BY_BUYER',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

@Entity('lc_discrepancies')
export class LCDiscrepancy {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('lc_disc');
    }
  }

  @Column()
  lcId: string;

  @ManyToOne(() => LetterOfCredit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lcId' })
  letterOfCredit: LetterOfCredit;

  @Column({ nullable: true })
  exportDocumentId: string;

  @Column({ nullable: true })
  documentType: string;

  @Column({ type: 'varchar', default: LCDiscrepancySeverity.MEDIUM })
  severity: LCDiscrepancySeverity;

  @Column({ type: 'varchar', default: LCDiscrepancyStatus.OPEN })
  status: LCDiscrepancyStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column()
  reportedByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reportedByUsername', referencedColumnName: 'username' })
  reportedBy: User;

  @Column({ nullable: true })
  resolvedByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'resolvedByUsername', referencedColumnName: 'username' })
  resolvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
