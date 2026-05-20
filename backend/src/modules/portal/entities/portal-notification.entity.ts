import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum PortalNotificationType {
  FINANCE = 'FINANCE',
  DOCUMENT = 'DOCUMENT',
  SHIPMENT = 'SHIPMENT',
  SUPPORT = 'SUPPORT',
  SYSTEM = 'SYSTEM',
}

export enum PortalNotificationSeverity {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

@Entity('portal_notifications')
@Index('idx_portal_notifications_buyer_read', ['buyerId', 'readAt'])
export class PortalNotification {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('portal_notif');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @Column({ type: 'enum', enum: PortalNotificationType })
  type: PortalNotificationType;

  @Column({ type: 'enum', enum: PortalNotificationSeverity, default: PortalNotificationSeverity.INFO })
  severity: PortalNotificationSeverity;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  referenceId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
