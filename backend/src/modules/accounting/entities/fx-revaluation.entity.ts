import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum FxRevaluationSourceType {
  AR = 'AR',
  AP = 'AP',
}

export enum FxRevaluationStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

@Entity('fx_revaluations')
@Index('idx_fx_revaluations_period_currency', ['periodId', 'currency'])
@Index('idx_fx_revaluations_source', ['sourceType', 'sourceId'])
export class FxRevaluation {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('fx_reval');
    }
  }

  @Column({ unique: true })
  runNumber: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  periodId: string | null;

  @Column({ type: 'enum', enum: FxRevaluationSourceType })
  sourceType: FxRevaluationSourceType;

  @Column({ type: 'varchar', length: 40 })
  sourceId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  partnerId: string | null;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'date' })
  revaluationDate: Date;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  openAmountForeign: number;

  @Column({ type: 'numeric', precision: 15, scale: 6, transformer: new ColumnNumericTransformer() })
  bookRate: number;

  @Column({ type: 'numeric', precision: 15, scale: 6, transformer: new ColumnNumericTransformer() })
  closingRate: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  bookValueVnd: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  revaluedValueVnd: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  gainLossVnd: number;

  @Column({ type: 'enum', enum: FxRevaluationStatus, default: FxRevaluationStatus.DRAFT })
  status: FxRevaluationStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  journalEntryId: string | null;

  @Column({ type: 'varchar' })
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  postedByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  postedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
