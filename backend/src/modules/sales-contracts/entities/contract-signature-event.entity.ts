import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum ContractSignatureEventType {
  CONTRACT_FROZEN = 'CONTRACT_FROZEN',
  INVITATION_CREATED = 'INVITATION_CREATED',
  EMAIL_SENT = 'EMAIL_SENT',
  EMAIL_FAILED = 'EMAIL_FAILED',
  EMAIL_SKIPPED = 'EMAIL_SKIPPED',
  OPENED = 'OPENED',
  OTP_VERIFIED = 'OTP_VERIFIED',
  OTP_FAILED = 'OTP_FAILED',
  OTP_EXPIRED = 'OTP_EXPIRED',
  BUYER_SIGNED = 'BUYER_SIGNED',
  INTERNAL_SIGNED = 'INTERNAL_SIGNED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ContractSignatureActorType {
  INTERNAL = 'INTERNAL',
  BUYER = 'BUYER',
  SYSTEM = 'SYSTEM',
}

@Entity('contract_signature_events')
@Index('idx_contract_signature_events_contract', ['contractId', 'createdAt'])
@Index('idx_contract_signature_events_invitation', ['invitationId'])
@Index('idx_contract_signature_events_type', ['eventType'])
export class ContractSignatureEvent {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('sc_evt');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  contractId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  invitationId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  signatureId: string | null;

  @Column({ type: 'varchar' })
  eventType: ContractSignatureEventType;

  @Column({ type: 'varchar', default: ContractSignatureActorType.SYSTEM })
  actorType: ContractSignatureActorType;

  @Column({ type: 'varchar', nullable: true })
  actorUsername: string | null;

  @Column({ type: 'varchar', nullable: true })
  signerEmailMasked: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true })
  documentHash: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
