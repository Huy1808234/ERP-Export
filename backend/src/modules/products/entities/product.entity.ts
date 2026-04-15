import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  _id: string;

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

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  cbmPerCarton: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  netWeightPerCarton: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  grossWeightPerCarton: string | null;

  @Column({ type: 'int', nullable: true })
  palletLayers: number | null;

  @Column({ type: 'int', nullable: true })
  cartonsPerLayer: number | null;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Partner, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'preferredSupplierId' })
  preferredSupplier: Partner | null;

  @Column({ type: 'uuid', nullable: true })
  preferredSupplierId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}