import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, (je) => je.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journalEntryId' })
  journalEntry: JournalEntry;

  @Column()
  accountCode: string; // e.g., '131', '511', '156'

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  debit: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  credit: number;

  @Column({ nullable: true })
  partnerId: string; // For AR/AP tracking per partner

  @CreateDateColumn()
  createdAt: Date;
}
