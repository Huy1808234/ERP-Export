import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { MarketRegionCode } from '@/common/geo.util';

@Entity('countries')
export class Country {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('country');
    }
  }

  @Column({ unique: true, type: 'varchar', length: 2 })
  code: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  nameVi: string;

  @Column({ type: 'varchar', length: 50 })
  region: MarketRegionCode;

  @Column({ type: 'simple-array', nullable: true })
  aliases: string[] | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
