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
import { Role } from '../../roles/entities/role.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity()
export class User {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  username: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ type: 'varchar', nullable: true })
  signatureImage: string | null;

  @Column({ type: 'varchar', nullable: true })
  roleName: string | null;

  @ManyToOne(() => Role, (role) => role.users, { eager: true, nullable: true })
  @JoinColumn({ name: 'roleName', referencedColumnName: 'name' })
  role: Role | null;

  @Column({ nullable: true })
  partnerId: string;

  @ManyToOne(() => Partner, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

  @Column({ default: 'BRONZE' })
  membershipLevel: string;

  @Column({ default: 'LOCAL' })
  accountType: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deactivatedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deactivatedByUsername: string | null;

  @Column({ type: 'text', nullable: true })
  deactivationReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  codeId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  codeExpired: Date | null;

  @Column({ type: 'varchar', nullable: true })
  refreshTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('user');
    }
  }
}
