import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('accounting_audit_events')
@Index('idx_accounting_audit_events_entity', ['entityType', 'entityId'])
@Index('idx_accounting_audit_events_reference', ['referenceType', 'referenceId'])
@Index('idx_accounting_audit_events_hash', ['eventHash'], { unique: true })
export class AccountingAuditEvent {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('acct_audit');
    }
  }

  @Column({ type: 'varchar' })
  eventType: string;

  @Column({ type: 'varchar' })
  entityType: string;

  @Column({ type: 'varchar', length: 40 })
  entityId: string;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'timestamp' })
  eventAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  previousHash: string | null;

  @Column({ type: 'varchar' })
  eventHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
