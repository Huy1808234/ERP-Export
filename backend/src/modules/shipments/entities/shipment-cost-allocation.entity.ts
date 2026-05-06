import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Shipment } from './shipment.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

@Entity('shipment_cost_allocations')
export class ShipmentCostAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shipmentId: string;

  @ManyToOne(() => Shipment)
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  allocatedFreightCost: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  allocatedLocalCharge: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalAllocatedCost: number;

  @Column({ nullable: true })
  allocationMethod: string; // CBM, WEIGHT, etc.

  @CreateDateColumn()
  createdAt: Date;
}
