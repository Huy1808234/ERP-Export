import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('products')
@Index('idx_products_hscode', ['hsCode'])
export class Product {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('prod');
    }
  }

  @Column({ unique: true })
  sku: string;

  @Column()
  vietnameseName: string;

  @Column({ type: 'varchar', nullable: true })
  englishName: string | null;

  @Column({ type: 'varchar', nullable: true })
  hsCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  originCountry: string | null;

  @Column({ type: 'varchar', nullable: true })
  unitOfMeasure: string | null;

  @Column({ type: 'varchar', nullable: true })
  packingType: string | null;

  @Column({ type: 'int', nullable: true })
  piecesPerCarton: number | null;

  @Column({ type: 'int', nullable: true })
  cartonsPerPallet: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cartonLengthCm: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cartonWidthCm: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cartonHeightCm: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cbmPerCarton: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  netWeightPerCarton: number | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  grossWeightPerCarton: number | null;

  @Column({ type: 'int', nullable: true })
  palletLayers: number | null;

  @Column({ type: 'int', nullable: true })
  cartonsPerLayer: number | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  purchasePriceVnd: number | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  defaultExportPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  exportCurrency: string | null;

  @Column({ type: 'varchar', nullable: true })
  preferredSupplierId: string | null;

  @ManyToOne(() => Partner, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'preferredSupplierId' })
  preferredSupplier: Partner | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ default: false })
  isBestseller: boolean;

  @Column({ default: false })
  isNew: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  currentStock: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  reservedStock: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 5,
    transformer: new ColumnNumericTransformer(),
  })
  minimumStock: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
