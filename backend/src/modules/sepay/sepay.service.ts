import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import { PortalService } from '@/modules/portal/portal.service';
import {
  PortalPaymentReceipt,
  PortalReceiptStatus,
} from '@/modules/portal/entities/portal-payment-receipt.entity';
import type { SepayWebhookDto } from './dto/sepay-webhook.dto';
import {
  SepayTransaction,
  SepayTransactionStatus,
  SepayTransferType,
} from './entities/sepay-transaction.entity';

type SepayWebhookAuth = {
  authorization?: string;
  apiKey?: string;
  sepayApiKey?: string;
};

type NormalizedSepayPayload = {
  externalTransactionId: string;
  gateway: string | null;
  transactionDate: Date | null;
  accountNumber: string | null;
  subAccount: string | null;
  transferType: SepayTransferType;
  transferAmount: number;
  accumulated: number | null;
  code: string | null;
  content: string | null;
  referenceCode: string | null;
  description: string | null;
  rawPayload: Record<string, unknown>;
};

const SEPAY_RECEIPT_PATTERN = /\bTTR-\d{8}-[A-Z0-9]+\b/gi;

@Injectable()
export class SepayService {
  constructor(
    @InjectRepository(SepayTransaction)
    private readonly transactionRepository: Repository<SepayTransaction>,
    @InjectRepository(PortalPaymentReceipt)
    private readonly receiptRepository: Repository<PortalPaymentReceipt>,
    private readonly portalService: PortalService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeText(value?: string | number | null): string | null {
    const text = value === undefined || value === null ? '' : String(value).trim();
    return text || null;
  }

  private normalizeDate(value?: string | null): Date | null {
    const text = this.normalizeText(value);
    if (!text) return null;

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeAmount(value?: number | string | null): number {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid SePay transfer amount');
    }

    return amount;
  }

  private buildFallbackExternalId(dto: SepayWebhookDto): string {
    return createHash('sha256')
      .update(JSON.stringify({
        gateway: dto.gateway,
        transactionDate: dto.transactionDate,
        accountNumber: dto.accountNumber,
        transferType: dto.transferType,
        transferAmount: dto.transferAmount,
        referenceCode: dto.referenceCode,
        content: dto.content,
      }))
      .digest('hex');
  }

  private normalizePayload(dto: SepayWebhookDto): NormalizedSepayPayload {
    const transferType =
      dto.transferType === SepayTransferType.OUT
        ? SepayTransferType.OUT
        : SepayTransferType.IN;
    const transferAmount = this.normalizeAmount(dto.transferAmount);
    const externalTransactionId =
      this.normalizeText(dto.id) ||
      this.normalizeText(dto.referenceCode) ||
      this.buildFallbackExternalId(dto);

    return {
      externalTransactionId,
      gateway: this.normalizeText(dto.gateway),
      transactionDate: this.normalizeDate(dto.transactionDate),
      accountNumber: this.normalizeText(dto.accountNumber),
      subAccount: this.normalizeText(dto.subAccount),
      transferType,
      transferAmount,
      accumulated: dto.accumulated === undefined ? null : this.normalizeAmount(dto.accumulated),
      code: this.normalizeText(dto.code),
      content: this.normalizeText(dto.content),
      referenceCode: this.normalizeText(dto.referenceCode),
      description: this.normalizeText(dto.description),
      rawPayload: { ...dto },
    };
  }

  private getPresentedWebhookApiKeys(input: SepayWebhookAuth): string[] {
    const authorization = this.normalizeText(input.authorization);
    const bearerToken = authorization?.replace(/^Bearer\s+/i, '').trim();
    const rawApiKey = authorization?.replace(/^ApiKey\s+/i, '').trim();

    return [
      this.normalizeText(input.apiKey),
      this.normalizeText(input.sepayApiKey),
      bearerToken || null,
      rawApiKey || null,
      authorization,
    ].filter((value): value is string => Boolean(value));
  }

  private assertWebhookAuthentication(input: SepayWebhookAuth): void {
    const expectedApiKey = this.normalizeText(
      this.configService.get<string>('SEPAY_WEBHOOK_API_KEY'),
    );
    if (!expectedApiKey) {
      throw new UnauthorizedException(
        'SePay webhook is not configured: SEPAY_WEBHOOK_API_KEY is missing',
      );
    }

    const providedKeys = this.getPresentedWebhookApiKeys(input);
    if (!providedKeys.includes(expectedApiKey)) {
      throw new UnauthorizedException('Invalid SePay webhook API key');
    }
  }

  private extractReceiptReferences(transaction: NormalizedSepayPayload): string[] {
    const directReferences = [
      transaction.code,
      transaction.referenceCode,
    ].filter((value): value is string => Boolean(value));
    const searchableText = [
      transaction.code,
      transaction.referenceCode,
      transaction.content,
      transaction.description,
    ].filter((value): value is string => Boolean(value)).join(' ');
    const receiptNumbers = searchableText.match(SEPAY_RECEIPT_PATTERN) || [];

    return Array.from(new Set([...directReferences, ...receiptNumbers].map((value) => value.trim())));
  }

  private async findMatchingReceipt(
    transaction: NormalizedSepayPayload,
  ): Promise<PortalPaymentReceipt | null> {
    const references = this.extractReceiptReferences(transaction);
    if (!references.length) return null;

    return this.receiptRepository.findOne({
      where: [
        {
          receiptNumber: In(references),
          status: PortalReceiptStatus.SUBMITTED,
        },
        {
          bankReference: In(references),
          status: PortalReceiptStatus.SUBMITTED,
        },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  private isReceiptAmountMatched(
    receipt: PortalPaymentReceipt,
    transaction: NormalizedSepayPayload,
  ): boolean {
    const expectedVnd =
      receipt.currency.toUpperCase() === 'VND'
        ? Number(receipt.amount)
        : Number(receipt.amount) * Number(receipt.exchangeRate || 1);

    return Math.abs(expectedVnd - transaction.transferAmount) <= 1;
  }

  private async matchAndConfirmReceipt(
    transactionEntity: SepayTransaction,
    transaction: NormalizedSepayPayload,
  ): Promise<SepayTransaction> {
    if (transaction.transferType !== SepayTransferType.IN) {
      transactionEntity.status = SepayTransactionStatus.IGNORED;
      transactionEntity.processingNote = 'Outgoing transaction ignored';
      return this.transactionRepository.save(transactionEntity);
    }

    const receipt = await this.findMatchingReceipt(transaction);
    if (!receipt) {
      transactionEntity.status = SepayTransactionStatus.RECEIVED;
      transactionEntity.processingNote = 'No submitted portal receipt matched';
      return this.transactionRepository.save(transactionEntity);
    }

    transactionEntity.matchedPortalReceiptId = receipt._id;
    transactionEntity.matchedAt = new Date();

    if (!this.isReceiptAmountMatched(receipt, transaction)) {
      transactionEntity.status = SepayTransactionStatus.MATCHED;
      transactionEntity.processingNote =
        'Receipt matched but transfer amount does not match expected VND amount';
      return this.transactionRepository.save(transactionEntity);
    }

    await this.portalService.reviewPaymentReceipt(
      receipt._id,
      {
        status: PortalReceiptStatus.CONFIRMED,
        note: `Auto-confirmed from SePay transaction ${transaction.externalTransactionId}`,
      },
      { username: 'sepay_webhook' },
    );

    transactionEntity.status = SepayTransactionStatus.CONFIRMED;
    transactionEntity.processingNote = 'Portal receipt auto-confirmed';
    return this.transactionRepository.save(transactionEntity);
  }

  async handleWebhook(
    dto: SepayWebhookDto,
    auth: SepayWebhookAuth,
  ): Promise<SepayTransaction> {
    this.assertWebhookAuthentication(auth);
    const transaction = this.normalizePayload(dto);

    const existingTransaction = await this.transactionRepository.findOne({
      where: { externalTransactionId: transaction.externalTransactionId },
    });
    if (existingTransaction) {
      return existingTransaction;
    }

    const transactionEntity = await this.transactionRepository.save(
      this.transactionRepository.create({
        ...transaction,
        status: SepayTransactionStatus.RECEIVED,
        matchedPortalReceiptId: null,
        matchedAt: null,
        processingNote: null,
      }),
    );

    return this.matchAndConfirmReceipt(transactionEntity, transaction);
  }

  async findAll(): Promise<SepayTransaction[]> {
    return this.transactionRepository.find({
      order: { transactionDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }
}
