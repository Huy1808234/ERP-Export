import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { ExchangeRateType } from './entities/exchange-rate.entity';
import { JwtAuthGuard } from '../../auth/passport/jwt-auth.guard';
import { RolesGuard } from '../../auth/passport/roles.guard';
import { Roles } from '../../decorator/customize';

@Controller('currencies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}
  @Post('sync-vcb')
  @Roles('ADMIN', 'ACCOUNTANT')
  syncExchangeRatesFromVCB() {
    return this.currenciesService.syncExchangeRatesFromVCB();
  }

  @Post()
  @Roles('ADMIN')
  createCurrency(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.createCurrency(createCurrencyDto);
  }

  @Get()
  findAllCurrencies() {
    return this.currenciesService.findAllCurrencies();
  }

  @Get('cross-rate')
  getCrossRate(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('rateType') rateType?: ExchangeRateType,
  ) {
    return this.currenciesService.getCrossRate(
      from,
      to,
      rateType ?? ExchangeRateType.TRANSFER,
    );
  }

  @Get(':_id')
  findCurrencyById(@Param('_id') recordId: string) {
    return this.currenciesService.findCurrencyById(recordId);
  }

  @Patch(':_id')
  @Roles('ADMIN')
  updateCurrency(
    @Param('_id') recordId: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
  ) {
    return this.currenciesService.updateCurrency(recordId, updateCurrencyDto);
  }

  @Post('rates')
  @Roles('ADMIN')
  createExchangeRate(@Body() createExchangeRateDto: CreateExchangeRateDto) {
    return this.currenciesService.createExchangeRate(createExchangeRateDto);
  }

  @Get(':_id/rates')
  findExchangeRatesByCurrency(
    @Param('_id') currency_id: string,
    @Query('rateType') rateType?: ExchangeRateType,
  ) {
    return this.currenciesService.findExchangeRatesByCurrency(
      currency_id,
      rateType,
    );
  }

  @Get(':_id/rates/latest')
  getLatestExchangeRate(
    @Param('_id') currency_id: string,
    @Query('rateType') rateType?: ExchangeRateType,
  ) {
    return this.currenciesService.getLatestExchangeRate(
      currency_id,
      rateType ?? ExchangeRateType.TRANSFER,
    );
  }
}
