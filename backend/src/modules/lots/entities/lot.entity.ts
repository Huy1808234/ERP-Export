import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

@Entity('lots')
export class Lot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
  productionDate: Date;

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
