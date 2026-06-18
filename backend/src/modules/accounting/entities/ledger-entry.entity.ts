import {
  BeforeInsert,
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('ledger');
    }
  }

  @Column()
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, (je) => je.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journalEntryId' })
  journalEntry: JournalEntry;

  @Column()
  accountCode: string; // e.g., '131', '511', '156'

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  debit: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  credit: number;

  @Column({ nullable: true })
  partnerId: string; // For AR/AP tracking per partner

  @Column({ nullable: true })
  shipmentId: string; // For Multi-dimension Cost Allocation

  @Column({ nullable: true })
  salesContractId: string; // For Revenue/Cost tracking per contract

  @CreateDateColumn()
  createdAt: Date;
}
