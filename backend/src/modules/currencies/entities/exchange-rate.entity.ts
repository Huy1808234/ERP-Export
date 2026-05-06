import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Currency } from './currency.entity';
import { Decimal } from 'decimal.js';

export enum ExchangeRateType {
  TRANSFER = 'TRANSFER',
  BUY = 'BUY',
  SELL = 'SELL',
  ACCOUNTING = 'ACCOUNTING',
}

export class DecimalTransformer {
  to(data: number | Decimal): string {
    return data ? data.toString() : '0';
  }
  from(data: string): number {
    return data ? parseFloat(data) : 0;
  }
}

@Entity('exchange_rates')
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  currencyId: string;

  @ManyToOne(() => Currency, currency => currency.exchangeRates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currencyId' })
  currency: Currency;

  @Column('decimal', { precision: 15, scale: 6, transformer: new DecimalTransformer() })
  rate: number;

  @Column({ type: 'varchar', length: 20, default: ExchangeRateType.TRANSFER })
  rateType: ExchangeRateType;

  @Column({ type: 'date' })
  effectiveDate: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
