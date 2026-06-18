import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export type InventoryPeriodSnapshotLine = {
  productId: string;
  sku: string;
  productName: string | null;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unitCost: number;
  inventoryValue: number;
  valuationMethod: 'FIFO' | 'AVG';
};

@Entity('inventory_period_snapshots')
@Index(
  'idx_inventory_period_snapshots_period_method',
  ['periodKey', 'valuationMethod'],
  {
    unique: true,
  },
)
export class InventoryPeriodSnapshot {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('inv_snap');
    }
  }

  @Column({ type: 'varchar', length: 60, unique: true })
  snapshotNumber: string;

  @Column({ type: 'varchar', length: 40 })
  periodKey: string;

  @Column({ type: 'date' })
  periodStartDate: string;

  @Column({ type: 'date' })
  periodEndDate: string;

  @Column({ type: 'varchar', length: 10, default: 'FIFO' })
  valuationMethod: 'FIFO' | 'AVG';

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalQuantity: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalValue: number;

  @Column({ type: 'integer', default: 0 })
  lineCount: number;

  @Column({ type: 'jsonb' })
  snapshotData: InventoryPeriodSnapshotLine[];

  @Column({ type: 'varchar', length: 120 })
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  immutableHash: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
