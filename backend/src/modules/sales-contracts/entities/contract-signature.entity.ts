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
import { SalesContract } from './sales-contract.entity';

export enum ContractSignerType {
  BUYER = 'BUYER',
  INTERNAL = 'INTERNAL',
}

@Entity('contract_signatures')
@Index('idx_contract_signatures_contract', ['contractId', 'signerType'])
export class ContractSignature {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('sc_sign');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  contractId: string;

  @ManyToOne(() => SalesContract, (contract) => contract.signatures, {
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

  @Column({ type: 'varchar', nullable: true })
  signedByUsername: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  signatureImageFileId: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamp' })
  signedAt: Date;

  @Column({ type: 'text' })
  consentText: string;

  @Column({ type: 'varchar' })
  documentHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
