import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';

@Entity('currencies')
export class Currency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
