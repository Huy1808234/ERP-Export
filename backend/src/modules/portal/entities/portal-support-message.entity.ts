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
import {
  PortalAttachment,
  PortalSupportTicket,
} from './portal-support-ticket.entity';

export enum PortalMessageAuthorType {
  BUYER = 'BUYER',
  STAFF = 'STAFF',
}

@Entity('portal_support_messages')
@Index('idx_portal_support_messages_ticket', ['ticket_id'])
export class PortalSupportMessage {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('portal_msg');
    }
  }

  @Column({ type: 'varchar', length: 40 })
  ticket_id: string;

  @ManyToOne(() => PortalSupportTicket, (ticket) => ticket.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: PortalSupportTicket;

  @Column()
  authorUsername: string;

  @Column({ type: 'enum', enum: PortalMessageAuthorType })
  authorType: PortalMessageAuthorType;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: PortalAttachment[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
