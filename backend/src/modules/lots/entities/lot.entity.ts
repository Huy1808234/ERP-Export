import { BeforeInsert, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('lots')
export class Lot {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('lot');
    }
  }

  @Column({ unique: true })
  lotNumber: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: true })
  supplierId: string;

  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'supplierId' })
  supplier: Partner;

  @Column({ type: 'timestamp', nullable: true })
  manufactureDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ type: 'text', nullable: true })
  certificates: string; // e.g. "Organic, Fairtrade"

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  initialQuantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  currentQuantity: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
