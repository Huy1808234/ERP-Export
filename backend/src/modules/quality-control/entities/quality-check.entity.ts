import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Lot } from '../../lots/entities/lot.entity';
import { User } from '../../users/entities/user.entity';

export enum QCResult {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CONDITIONAL = 'CONDITIONAL'
}

@Entity('quality_checks')
export class QualityCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  checkNumber: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: true })
  lotId: string;

  @ManyToOne(() => Lot)
  @JoinColumn({ name: 'lotId' })
  lot: Lot;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  moisture: number; // Độ ẩm (%)

  @Column({ type: 'integer', nullable: true })
  nutCount: number; // Cỡ hạt (hạt/kg)

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  defectRate: number; // Tỷ lệ lỗi (%)

  @Column({ type: 'enum', enum: QCResult, default: QCResult.PASSED })
  result: QCResult;

  @Column({ type: 'text', nullable: true })
  inspectorNotes: string;

  @Column()
  inspectorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inspectorId' })
  inspector: User;

  @CreateDateColumn()
  createdAt: Date;
}
