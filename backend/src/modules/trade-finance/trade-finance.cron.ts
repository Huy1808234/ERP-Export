import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository, In } from 'typeorm';
import { LetterOfCredit, LCStatus } from './entities/letter-of-credit.entity';
import dayjs from 'dayjs';
import { TradeFinanceService } from './trade-finance.service';

@Injectable()
export class TradeFinanceCron {
  private readonly logger = new Logger(TradeFinanceCron.name);

  constructor(
    @InjectRepository(LetterOfCredit)
    private lcRepository: Repository<LetterOfCredit>,
    private tradeFinanceService: TradeFinanceService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleLCChecks() {
    this.logger.log('Running Trade Finance Expiration Checks...');
    
    const sevenDaysFromNow = dayjs().add(7, 'days').toDate();
    const today = dayjs().toDate();

    // 1. Find LCs with expiryDate or deadlines within 7 days
    const alerts = await this.lcRepository.find({
      where: [
        {
          expiryDate: LessThan(sevenDaysFromNow),
          status: In([LCStatus.RECEIVED, LCStatus.DOCUMENTS_PRESENTED, LCStatus.ACCEPTED])
        },
        {
          latestShipmentDate: LessThan(sevenDaysFromNow),
          status: LCStatus.RECEIVED
        },
        {
          presentationDeadline: LessThan(sevenDaysFromNow),
          status: In([LCStatus.RECEIVED, LCStatus.DOCUMENTS_PRESENTED])
        }
      ],
    });

    if (alerts.length > 0) {
      this.logger.warn(`Found ${alerts.length} LCs with upcoming deadlines/expiry within 7 days!`);
      alerts.forEach(lc => {
          if (dayjs(lc.expiryDate).isBefore(sevenDaysFromNow)) this.logger.warn(`- LC ${lc.lcNumber}: EXPIRY DATE ALERT (${dayjs(lc.expiryDate).format('YYYY-MM-DD')})`);
          if (lc.latestShipmentDate && dayjs(lc.latestShipmentDate).isBefore(sevenDaysFromNow)) this.logger.warn(`- LC ${lc.lcNumber}: SHIPMENT DEADLINE ALERT (${dayjs(lc.latestShipmentDate).format('YYYY-MM-DD')})`);
          if (lc.presentationDeadline && dayjs(lc.presentationDeadline).isBefore(sevenDaysFromNow)) this.logger.warn(`- LC ${lc.lcNumber}: PRESENTATION DEADLINE ALERT (${dayjs(lc.presentationDeadline).format('YYYY-MM-DD')})`);
      });
    }

    const notificationResult = await this.tradeFinanceService.publishDeadlineNotifications(7, 'system');
    if (notificationResult.emitted > 0) {
      this.logger.warn(`Published ${notificationResult.emitted} Trade Finance deadline notification(s).`);
    }

    // 2. Auto-expire LCs that passed their expiryDate
    const pastExpiry = await this.lcRepository.find({
      where: {
        expiryDate: LessThan(today),
        status: In([LCStatus.RECEIVED, LCStatus.DOCUMENTS_PRESENTED, LCStatus.ACCEPTED])
      }
    });

    for (const lc of pastExpiry) {
      lc.status = LCStatus.EXPIRED;
      await this.lcRepository.save(lc);
      this.logger.log(`LC ${lc.lcNumber} has been marked as EXPIRED.`);
    }
  }
}
