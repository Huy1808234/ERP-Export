import { BeforeInsert, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum CollectionOrderStatus {
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  PAID = 'PAID',
  DISHONOURED = 'DISHONOURED',
  CANCELLED = 'CANCELLED'
}

export enum CollectionOrderType {
  DP = 'DP', // Documents against Payment
  DA = 'DA'  // Documents against Acceptance
}

@Entity('collection_orders')
export class CollectionOrder {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('collection');
    }
  }

  @Column({ unique: true })
  orderNumber: string; // Số lệnh nhờ thu

  @Column()
  salesContractId: string;

  @ManyToOne(() => SalesContract)
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column({
    type: 'enum',
    enum: CollectionOrderType,
    default: CollectionOrderType.DP
  })
  type: CollectionOrderType;

  @Column()
  remittingBank: string; // Ngân hàng gửi lệnh (Bên bán)

  @Column({ nullable: true })
  collectingBank: string; // Ngân hàng thu hộ (Bên mua)

  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  amount: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'timestamp' })
  presentationDate: Date; // Ngày xuất trình chứng từ

  @Column({ type: 'timestamp', nullable: true })
  maturityDate: Date | null; // Ngày đáo hạn (Riêng cho D/A)

  @Column({
    type: 'enum',
    enum: CollectionOrderStatus,
    default: CollectionOrderStatus.SENT
  })
  status: CollectionOrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
