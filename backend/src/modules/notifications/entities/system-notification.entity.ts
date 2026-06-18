import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum SystemNotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  APPROVAL = 'APPROVAL',
  SYSTEM = 'SYSTEM',
  INQUIRY = 'INQUIRY',
}

@Entity('system_notifications')
@Index('idx_sys_notif_user_read', ['userId', 'isRead'])
export class SystemNotification {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('sys_notif');
    }
  }

  @Column({ type: 'varchar', length: 40, nullable: true })
  userId: string | null; // If null, maybe broadcast to all admins? For now, specify a user.

  @Column({
    type: 'enum',
    enum: SystemNotificationType,
    default: SystemNotificationType.INFO,
  })
  type: SystemNotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', nullable: true })
  targetUrl: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
