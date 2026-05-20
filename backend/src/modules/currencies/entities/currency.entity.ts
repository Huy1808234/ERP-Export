import { BeforeInsert, Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('currencies')
export class Currency {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('currency');
    }
  }

  @Column({ unique: true, length: 3 })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  symbol: string;

  @Column({ default: false })
  isBase: boolean;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ExchangeRate, rate => rate.currency)
  exchangeRates: ExchangeRate[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
