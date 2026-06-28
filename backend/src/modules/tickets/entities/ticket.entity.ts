import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('tickets')
export class Ticket {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 'OPEN' })
  status: string;

  @Column({ default: 'MEDIUM' })
  priority: string;

  @Column()
  requester_username: string;

  @Column({ nullable: true })
  assignee_username: string;

  @Column({ default: 'PORTAL' })
  source: string;

  @Column('simple-array', { nullable: true })
  attachments: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
