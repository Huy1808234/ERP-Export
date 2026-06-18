import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Index('UQ_settings_key', { unique: true })
  @Column()
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('setting');
    }
  }
}
