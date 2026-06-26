import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { Public, Roles } from '@/decorator/customize';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { SepayTransaction } from './entities/sepay-transaction.entity';
import { SepayService } from './sepay.service';

@Controller('sepay')
export class SepayController {
  constructor(private readonly sepayService: SepayService) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  async handleWebhook(
    @Body() dto: SepayWebhookDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-api-key') apiKey?: string,
    @Headers('x-sepay-api-key') sepayApiKey?: string,
    @Res({ passthrough: false }) res?: ExpressResponse,
  ): Promise<void> {
    await this.sepayService.handleWebhook(dto, {
      authorization,
      apiKey,
      sepayApiKey,
    });

    // SePay validates the response payload as { success: true } at the top
    // level. Bypass the global transform interceptor for this endpoint.
    if (res) {
      res.status(200).json({ success: true });
    }
  }

  @Get('transactions')
  @Roles('ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT')
  findAll(): Promise<SepayTransaction[]> {
    return this.sepayService.findAll();
  }
}
