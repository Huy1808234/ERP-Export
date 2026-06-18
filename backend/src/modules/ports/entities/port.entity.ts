import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum PortType {
  SEA = 'SEA',
  INLAND = 'INLAND',
  AIR = 'AIR',
}

@Entity('ports')
@Index(['countryCode', 'name'])
export class Port {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('port');
    }
  }

  @Column({ type: 'varchar', length: 12, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  localName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 120 })
  country: string;

  @Column({ type: 'varchar', length: 2 })
  countryCode: string;

  @Column({ type: 'varchar', default: PortType.SEA })
  type: PortType;

  @Column({ type: 'varchar', length: 80, nullable: true })
  timezone: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'simple-array', nullable: true })
  aliases: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  createdByUsername: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  updatedByUsername: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
