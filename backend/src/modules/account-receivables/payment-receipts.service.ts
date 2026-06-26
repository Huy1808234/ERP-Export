import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PaymentReceipt,
  PaymentReceiptStatus,
  BankChargeType,
  PaymentReceiptSource,
} from './entities/payment-receipt.entity';
import { AccountReceivable, ARStatus } from './entities/account-receivable.entity';
import {
  CreatePaymentReceiptDto,
  ApprovePaymentReceiptDto,
  RejectPaymentReceiptDto,
} from './dto/create-payment-receipt.dto';
import { createEntityId } from '@/common/ids/entity-id.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class PaymentReceiptsService {
  constructor(
    @InjectRepository(PaymentReceipt)
    private readonly receiptRepo: Repository<PaymentReceipt>,
    @InjectRepository(AccountReceivable)
    private readonly arRepo: Repository<AccountReceivable>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private generateReceiptNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PR-${year}${month}-${random}`;
  }

  async create(
    dto: CreatePaymentReceiptDto,
    user: { username: string },
  ): Promise<PaymentReceipt> {
    // Validate Account Receivable exists
    const ar = await this.arRepo.findOne({
      where: { _id: dto.accountReceivableId },
      relations: ['buyer'],
    });

    if (!ar) {
      throw new NotFoundException('Account receivable not found');
    }

    // Validate amount doesn't exceed open amount
    const openAmount = new Decimal(ar.amountForeign || 0).minus(ar.paidAmountForeign || 0);
    const paymentAmount = new Decimal(dto.amountPaidForeign || 0);

    if (paymentAmount.greaterThan(openAmount)) {
      throw new BadRequestException(
        `Payment amount (${paymentAmount.toFixed(2)}) exceeds open amount (${openAmount.toFixed(2)})`,
      );
    }

    // Calculate VND amount
    const exchangeRate = new Decimal(dto.exchangeRate || 1);
    const amountPaidVnd = paymentAmount.times(exchangeRate).toDecimalPlaces(2).toNumber();

    // Determine initial status based on source
    // - source = SEPAY_WEBHOOK: Auto-approve (bank verified this transaction)
    // - source = CUSTOMER_PORTAL_UPLOAD: PENDING (needs accountant review)
    // - source = CUSTOMER_QR_INITIATED: PENDING (waiting for SePay webhook to confirm)
    // - source = MANUAL_ENTRY: PENDING (kế toán nhập tay)
    const source = dto.source || PaymentReceiptSource.CUSTOMER_PORTAL_UPLOAD;

    let initialStatus: PaymentReceiptStatus;
    if (source === PaymentReceiptSource.SEPAY_WEBHOOK) {
      // SePay webhook - bank verified this transaction → Auto approve
      initialStatus = PaymentReceiptStatus.APPROVED;
    } else {
      // All other sources - needs confirmation
      initialStatus = PaymentReceiptStatus.PENDING;
    }

    const receipt = this.receiptRepo.create({
      ...dto,
      _id: createEntityId('pr'),
      receiptNumber: this.generateReceiptNumber(),
      buyerId: ar.buyerId,
      accountReceivableId: ar._id,
      currency: dto.currency || ar.currency || 'USD',
      amountPaidVnd,
      status: initialStatus,
      source,
      createdByUsername: user.username,
    });

    const saved = await this.receiptRepo.save(receipt);

    // If auto-approved (SePay webhook), update AR balance immediately
    if (initialStatus === PaymentReceiptStatus.APPROVED) {
      receipt.approvedByUsername = user.username;
      receipt.approvedAt = new Date();
      await this.updateArBalance(receipt, ar);
    } else {
      // Emit event for notifications (manual upload needs accountant review)
      this.eventEmitter.emit('payment-receipt.created', {
        receipt: saved,
        ar,
        buyer: ar.buyer,
      });
    }

    return saved;
  }

  private async updateArBalance(
    receipt: PaymentReceipt,
    ar: AccountReceivable,
  ): Promise<void> {
    // Update paid amounts
    const paidForeign = new Decimal(ar.paidAmountForeign || 0)
      .plus(receipt.amountPaidForeign)
      .toNumber();
    const paidVnd = new Decimal(ar.paidAmountVnd || 0)
      .plus(receipt.amountPaidVnd)
      .toNumber();

    const openForeign = new Decimal(ar.amountForeign || 0).minus(paidForeign);

    let newArStatus = ARStatus.UNPAID;
    if (openForeign.lessThanOrEqualTo(0)) {
      newArStatus = ARStatus.PAID;
    } else if (paidForeign > 0) {
      newArStatus = ARStatus.PARTIAL;
    }

    await this.arRepo.update(ar._id, {
      paidAmountForeign: paidForeign,
      paidAmountVnd: paidVnd,
      status: newArStatus,
    });

    // Emit event for auto-approved payment
    this.eventEmitter.emit('payment-receipt.approved', {
      receipt,
      ar,
      autoApproved: true,
    });
  }

  async findAll(query: Record<string, string> = {}): Promise<{ data: PaymentReceipt[]; total: number }> {
    const { status, buyerId, source, fromDate, toDate, page = 1, limit = 20 } = query;

    const qb = this.receiptRepo
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.buyer', 'buyer')
      .leftJoinAndSelect('receipt.accountReceivable', 'ar');

    if (status) {
      qb.andWhere('receipt.status = :status', { status });
    }

    if (buyerId) {
      qb.andWhere('receipt.buyerId = :buyerId', { buyerId });
    }

    if (source) {
      qb.andWhere('receipt.source = :source', { source });
    }

    if (fromDate) {
      qb.andWhere('receipt.paymentDate >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('receipt.paymentDate <= :toDate', { toDate });
    }

    const [data, total] = await qb
      .orderBy('receipt.createdAt', 'DESC')
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<PaymentReceipt> {
    const receipt = await this.receiptRepo.findOne({
      where: { _id: id },
      relations: ['buyer', 'accountReceivable'],
    });

    if (!receipt) {
      throw new NotFoundException('Payment receipt not found');
    }

    return receipt;
  }

  async approve(
    id: string,
    dto: ApprovePaymentReceiptDto,
    user: { username: string },
  ): Promise<PaymentReceipt> {
    const receipt = await this.findOne(id);

    if (receipt.status !== PaymentReceiptStatus.PENDING) {
      throw new BadRequestException('Only pending receipts can be approved');
    }

    // Update receipt status
    receipt.status = PaymentReceiptStatus.APPROVED;
    receipt.approvedByUsername = user.username;
    receipt.approvedAt = new Date();
    if (dto.note) {
      receipt.note = dto.note;
    }
    await this.receiptRepo.save(receipt);

    // Update AR balance
    const ar = await this.arRepo.findOne({
      where: { _id: receipt.accountReceivableId ?? undefined },
    });

    if (ar) {
      await this.updateArBalance(receipt, ar);
    }

    return receipt;
  }

  async reject(
    id: string,
    dto: RejectPaymentReceiptDto,
    user: { username: string },
  ): Promise<PaymentReceipt> {
    const receipt = await this.findOne(id);

    if (receipt.status !== PaymentReceiptStatus.PENDING) {
      throw new BadRequestException('Only pending receipts can be rejected');
    }

    receipt.status = PaymentReceiptStatus.REJECTED;
    receipt.rejectedByUsername = user.username;
    receipt.rejectedAt = new Date();
    receipt.rejectionReason = dto.rejectionReason;

    const saved = await this.receiptRepo.save(receipt);

    // Emit event
    this.eventEmitter.emit('payment-receipt.rejected', {
      receipt: saved,
    });

    return saved;
  }

  async cancel(
    id: string,
    user: { username: string },
  ): Promise<PaymentReceipt> {
    const receipt = await this.findOne(id);

    if (receipt.status === PaymentReceiptStatus.APPROVED) {
      throw new BadRequestException('Cannot cancel an approved receipt');
    }

    receipt.status = PaymentReceiptStatus.CANCELLED;
    const saved = await this.receiptRepo.save(receipt);

    this.eventEmitter.emit('payment-receipt.cancelled', {
      receipt: saved,
    });

    return saved;
  }
}
