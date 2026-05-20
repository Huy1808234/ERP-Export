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
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { Product } from '@/modules/products/entities/product.entity';
import { Partner, BuyerRegion } from '@/modules/partners/entities/partner.entity';
import { Incoterm } from '@/modules/quotations/entities/quotation.entity';
import { PricingPolicy } from './pricing-policy.entity';

export enum SalesPriceSourceType {
  QUOTATION = 'QUOTATION',
  PROFORMA_INVOICE = 'PROFORMA_INVOICE',
  SALES_CONTRACT = 'SALES_CONTRACT',
  MANUAL = 'MANUAL',
}

@Entity('sales_price_history')
@Index('idx_sales_price_history_buyer_product', ['buyerId', 'productId', 'occurredAt'])
export class SalesPriceHistory {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('sales_price');
    }
  }

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @ManyToOne(() => Partner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  pricingPolicyId: string | null;

  @ManyToOne(() => PricingPolicy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pricingPolicyId' })
  pricingPolicy: PricingPolicy | null;

  @Column({ type: 'enum', enum: SalesPriceSourceType })
  sourceType: SalesPriceSourceType;

  @Column({ type: 'varchar', length: 40 })
  sourceId: string;

  @Column({ type: 'varchar', nullable: true })
  sourceNumber: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  salesContractId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  quotationId: string | null;

  @Column({ type: 'enum', enum: BuyerRegion, nullable: true })
  marketRegion: BuyerRegion | null;

  @Column({ type: 'varchar', nullable: true })
  country: string | null;

  @Column({ type: 'enum', enum: Incoterm })
  incoterm: Incoterm;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  quantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 4, transformer: new ColumnNumericTransformer() })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 15, scale: 6, default: 1, transformer: new ColumnNumericTransformer() })
  exchangeRate: number;

  @Column()
  createdByUsername: string;

  @Column({ type: 'timestamp' })
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
