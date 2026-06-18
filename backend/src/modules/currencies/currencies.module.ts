import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CurrenciesService } from './currencies.service';
import { CurrenciesController } from './currencies.controller';
import { Currency } from './entities/currency.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Currency, ExchangeRate]), HttpModule],
  controllers: [CurrenciesController],
  providers: [CurrenciesService],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
