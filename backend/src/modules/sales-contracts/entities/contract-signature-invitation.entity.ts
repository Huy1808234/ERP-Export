import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { SalesContract } from './sales-contract.entity';
import { ContractSignerType } from './contract-signature.entity';

export enum ContractSignatureInvitationStatus {
  CREATED = 'CREATED',
  SENT = 'SENT',
  OPENED = 'OPENED',
  OTP_VERIFIED = 'OTP_VERIFIED',
  SIGNED = 'SIGNED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export type ContractSignatureInvitationAuditEvent = {
  action: string;
  at: string;
  actorUsername?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  note?: string | null;
};

@Entity('contract_signature_invitations')
@Index('idx_contract_signature_invitations_contract', ['contractId', 'status'])
@Index('idx_contract_signature_invitations_token', ['tokenHash'], {
  unique: true,
})
export class ContractSignatureInvitation {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('sc_invite');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  contractId: string;

  @ManyToOne(() => SalesContract, (contract) => contract.signatureInvitations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contractId', referencedColumnName: '_id' })
  contract: SalesContract;

  @Column({ type: 'varchar' })
  signerType: ContractSignerType;

  @Column({ type: 'varchar' })
  signerName: string;

  @Column({ type: 'varchar', nullable: true })
  signerTitle: string | null;

  @Column({ type: 'varchar', nullable: true })
  signerEmail: string | null;

  @Column({
    type: 'varchar',
    default: ContractSignatureInvitationStatus.CREATED,
  })
  status: ContractSignatureInvitationStatus;

  @Column({ type: 'varchar' })
  tokenHash: string;

  @Column({ type: 'varchar', nullable: true })
  otpHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  otpAttemptCount: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true })
  sentByUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  revokedByUsername: string | null;

  @Column({ type: 'text', nullable: true })
  revokeReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  certificateNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  certificateHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: ContractSignatureInvitationAuditEvent[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
