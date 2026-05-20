import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { ProductChangeRequest, ProductChangedField } from './product-change-request.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('product_versions')
@Index('idx_product_versions_product', ['productId'])
export class ProductVersion {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('pver');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  productId: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 40, nullable: true })
  changeRequestId: string | null;

  @ManyToOne(() => ProductChangeRequest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changeRequestId' })
  changeRequest: ProductChangeRequest | null;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  changedFields: ProductChangedField[];

  @Column({ type: 'jsonb' })
  beforeSnapshot: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  afterSnapshot: Record<string, unknown>;

  @Column({ type: 'varchar', length: 120 })
  changedByUsername: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  approvedByUsername: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
