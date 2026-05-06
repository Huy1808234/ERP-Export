import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SalesContract } from './sales-contract.entity';
import { Product } from '../../products/entities/product.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';

@Entity('sales_contract_items')
export class SalesContractItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  salesContractId: string;

  @ManyToOne(() => SalesContract, contract => contract.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  totalPrice: number; // quantity * unitPrice
}
