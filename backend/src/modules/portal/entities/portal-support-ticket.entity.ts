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
import { createEntityId } from '@/common/ids/entity-id.util';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { PortalSupportMessage } from './portal-support-message.entity';

export enum PortalTicketCategory {
  QUALITY = 'QUALITY',
  LOGISTICS = 'LOGISTICS',
  FINANCE = 'FINANCE',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}

export enum PortalTicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum PortalTicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_INTERNAL = 'WAITING_INTERNAL',
  WAITING_BUYER = 'WAITING_BUYER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export type PortalAttachment = {
  fileAsset_id: string;
  fileName: string;
  url?: string | null;
};

export type PortalTicketAuditEvent = {
  action:
    | 'CREATED'
    | 'MESSAGE_ADDED'
    | 'INTERNAL_NOTE_ADDED'
    | 'STATUS_CHANGED'
    | 'ASSIGNED'
    | 'UNASSIGNED'
    | 'CLOSED';
  username: string;
  at: string;
  fromStatus?: PortalTicketStatus | null;
  toStatus?: PortalTicketStatus | null;
  fromAssigneeUsername?: string | null;
  toAssigneeUsername?: string | null;
  note?: string | null;
};

@Entity('portal_support_tickets')
@Index('idx_portal_support_tickets_buyer', ['buyerId'])
@Index('idx_portal_support_tickets_status', ['status'])
export class PortalSupportTicket {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('portal_ticket');
    }
  }

  @Column({ unique: true })
  ticketNumber: string;

  @Column({ type: 'varchar', length: 40 })
  buyerId: string;

  @ManyToOne(() => Partner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: Partner;

  @Column({ type: 'varchar', length: 40, nullable: true })
  shipmentId: string | null;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment | null;

  @Column()
  subject: string;

  @Column({
    type: 'enum',
    enum: PortalTicketCategory,
    default: PortalTicketCategory.OTHER,
  })
  category: PortalTicketCategory;

  @Column({
    type: 'enum',
    enum: PortalTicketPriority,
    default: PortalTicketPriority.MEDIUM,
  })
  priority: PortalTicketPriority;

  @Column({
    type: 'enum',
    enum: PortalTicketStatus,
    default: PortalTicketStatus.OPEN,
  })
  status: PortalTicketStatus;

  @Column()
  createdByUsername: string;

  @Column({ type: 'varchar', nullable: true })
  assignedToUsername: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: PortalAttachment[] | null;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: PortalTicketAuditEvent[] | null;

  @OneToMany(() => PortalSupportMessage, (message) => message.ticket)
  messages: PortalSupportMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
