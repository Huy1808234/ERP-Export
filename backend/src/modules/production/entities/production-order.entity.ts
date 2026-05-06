import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Lot } from '../../lots/entities/lot.entity';
import { User } from '../../users/entities/user.entity';

export enum ProductionStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Entity('production_orders')
export class ProductionOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNumber: string;

  @Column()
  rawProductId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'rawProductId' })
  rawProduct: Product;

  @Column()
  rawLotId: string;

  @ManyToOne(() => Lot)
  @JoinColumn({ name: 'rawLotId' })
  rawLot: Lot;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  rawQuantity: number;

  @Column({ type: 'enum', enum: ProductionStatus, default: ProductionStatus.PLANNED })
  status: ProductionStatus;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => ProductionOutput, (output) => output.productionOrder, { cascade: true })
  outputs: ProductionOutput[];
}

@Entity('production_outputs')
export class ProductionOutput {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productionOrderId: string;

  @ManyToOne(() => ProductionOrder, (order) => order.outputs)
  @JoinColumn({ name: 'productionOrderId' })
  productionOrder: ProductionOrder;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  quantity: number;

  @Column({ nullable: true })
  outputLotNumber: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  recoveryRate: number; // Tỷ lệ thu hồi (%)

  @Column({ type: 'text', nullable: true })
  qualityNotes: string;
}
