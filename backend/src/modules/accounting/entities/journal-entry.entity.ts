import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, DeleteDateColumn, Index } from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';

export enum JournalStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED'
}

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  entryNumber: string;

  @Index()
  @Column({ type: 'timestamp' })
  entryDate: Date;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: JournalStatus, default: JournalStatus.DRAFT })
  status: JournalStatus;

  @Column({ nullable: true })
  referenceType: string; // e.g., 'GRN', 'PI', 'SHIPMENT'

  @Column({ nullable: true })
  referenceId: string;

  @OneToMany(() => LedgerEntry, (item) => item.journalEntry, { cascade: true })
  items: LedgerEntry[];

  @Column({ nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
