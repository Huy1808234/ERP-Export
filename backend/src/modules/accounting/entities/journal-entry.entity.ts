import { BeforeInsert, Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, DeleteDateColumn, Index } from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum JournalStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED'
}

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('je');
    }
  }

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
  createdByUsername: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
