import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum ApprovalDocumentType {
  PURCHASE_REQUEST = 'PURCHASE_REQUEST',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  QUOTATION = 'QUOTATION',
  PROFORMA_INVOICE = 'PROFORMA_INVOICE',
  SALES_CONTRACT = 'SALES_CONTRACT',
  AP_PAYMENT_BATCH = 'AP_PAYMENT_BATCH',
  AP_PAYMENT_REVERSAL = 'AP_PAYMENT_REVERSAL',
  INVENTORY_COUNT = 'INVENTORY_COUNT',
  INVENTORY_ADJUSTMENT = 'INVENTORY_ADJUSTMENT',
  PRODUCT_CHANGE_REQUEST = 'PRODUCT_CHANGE_REQUEST',
  VAT_REFUND = 'VAT_REFUND',
  ACCOUNTING_PERIOD_REOPEN = 'ACCOUNTING_PERIOD_REOPEN',
  ACCOUNTING_PERIOD_LOCK = 'ACCOUNTING_PERIOD_LOCK',
  SALES_CONTRACT_CANCEL = 'SALES_CONTRACT_CANCEL',
  EXPORT_DOCUMENT_REVIEW = 'EXPORT_DOCUMENT_REVIEW',
  TRADE_FINANCE = 'TRADE_FINANCE',
  PRICING_POLICY = 'PRICING_POLICY',
}

@Entity('approval_rules')
@Index('idx_approval_rules_type_active', ['documentType', 'isActive'])
@Index('idx_approval_rules_amount', ['minAmountVnd', 'maxAmountVnd'])
export class ApprovalRule {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('approval_rule');
    }
  }

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  documentType: ApprovalDocumentType;

  @Column({ type: 'varchar', nullable: true })
  currency: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  minAmountVnd: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  maxAmountVnd: number | null;

  @Column({ type: 'integer', default: 100 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar' })
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  updatedByUsername: string | null;

  @OneToMany(() => ApprovalRuleStep, (step) => step.rule, { cascade: true })
  steps: ApprovalRuleStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('approval_rule_steps')
@Index('idx_approval_rule_steps_rule_order', ['ruleId', 'stepOrder'], {
  unique: true,
})
export class ApprovalRuleStep {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('approval_rule_step');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  ruleId: string;

  @Column({ type: 'integer' })
  stepOrder: number;

  @Column({ type: 'varchar' })
  approverRoleName: string;

  @Column({ type: 'varchar', nullable: true })
  approverUsername: string | null;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'boolean', default: true })
  isRequired: boolean;

  @ManyToOne(() => ApprovalRule, (rule) => rule.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ruleId' })
  rule: ApprovalRule;
}
