import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { GoodsReceiptItem } from '@/modules/goods-receipts/entities/goods-receipt-item.entity';
import { GoodsReceipt } from '@/modules/goods-receipts/entities/goods-receipt.entity';
import { Lot } from '@/modules/lots/entities/lot.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { PurchaseReturn } from '@/modules/purchase-returns/entities/purchase-return.entity';
import { User } from '@/modules/users/entities/user.entity';

export enum QCResult {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CONDITIONAL = 'CONDITIONAL',
}

export enum QCExceptionStatus {
  NONE = 'NONE',
  QUARANTINED = 'QUARANTINED',
  RETURN_CREATED = 'RETURN_CREATED',
  CLAIM_OPEN = 'CLAIM_OPEN',
  CLOSED = 'CLOSED',
}

export enum QCClaimStatus {
  NONE = 'NONE',
  OPEN = 'OPEN',
  SENT = 'SENT',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export enum QCResolutionType {
  NONE = 'NONE',
  REPLACEMENT = 'REPLACEMENT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  ACCEPT_AS_IS = 'ACCEPT_AS_IS',
  CANCELLED = 'CANCELLED',
  OTHER = 'OTHER',
}

@Entity('quality_checks')
export class QualityCheck {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('qc');
    }
  }

  @Column()
  checkNumber: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 40, nullable: true })
  lotId: string | null;

  @ManyToOne(() => Lot, { nullable: true })
  @JoinColumn({ name: 'lotId' })
  lot: Lot | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  goodsReceiptId: string | null;

  @ManyToOne(() => GoodsReceipt, { nullable: true })
  @JoinColumn({ name: 'goodsReceiptId' })
  goodsReceipt: GoodsReceipt | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  goodsReceiptItemId: string | null;

  @ManyToOne(() => GoodsReceiptItem, { nullable: true })
  @JoinColumn({ name: 'goodsReceiptItemId' })
  goodsReceiptItem: GoodsReceiptItem | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseOrderId: string | null;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  moisture: number | null;

  @Column({ type: 'integer', nullable: true })
  nutCount: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  defectRate: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  receivedQuantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  acceptedQuantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  rejectedQuantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  quarantineQuantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  backorderQuantity: number;

  @Column({ type: 'enum', enum: QCResult, default: QCResult.PASSED })
  result: QCResult;

  @Column({ type: 'varchar', default: QCExceptionStatus.NONE })
  exceptionStatus: QCExceptionStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  purchaseReturnId: string | null;

  @ManyToOne(() => PurchaseReturn, { nullable: true })
  @JoinColumn({ name: 'purchaseReturnId' })
  purchaseReturn: PurchaseReturn | null;

  @Column({ type: 'varchar', nullable: true })
  claimNumber: string | null;

  @Column({ type: 'varchar', default: QCClaimStatus.NONE })
  claimStatus: QCClaimStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  claimSentByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimSentAt: Date | null;

  @Column({ type: 'varchar', default: QCResolutionType.NONE })
  resolutionType: QCResolutionType;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  creditAmount: number;

  @Column({ type: 'date', nullable: true })
  replacementDueDate: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resolvedByUsername: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ type: 'text', nullable: true })
  inspectorNotes: string | null;

  @Column({ type: 'text', nullable: true })
  correctiveAction: string | null;

  @Column()
  inspectorUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inspectorUsername', referencedColumnName: 'username' })
  inspector: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
