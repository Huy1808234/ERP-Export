import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import dayjs from 'dayjs';
import {
  AccountingPeriod,
  AccountingPeriodStatus,
} from './entities/accounting-period.entity';

export type AccountingPostingGuardInput = {
  entryDate: Date | string;
  referenceType?: string | null;
  reference_id?: string | null;
  description?: string | null;
};

@Injectable()
export class AccountingPeriodGuardService {
  constructor(private readonly dataSource: DataSource) {}

  async assertPostingAllowed(
    input: AccountingPostingGuardInput,
    manager?: EntityManager,
  ): Promise<AccountingPeriod> {
    const entryDate = dayjs(input.entryDate);
    if (!entryDate.isValid()) {
      throw new BadRequestException('Posting date is invalid.');
    }

    const postingDate = entryDate.format('YYYY-MM-DD');
    const repository = (manager || this.dataSource.manager).getRepository(
      AccountingPeriod,
    );
    const period = await repository
      .createQueryBuilder('period')
      .where('period.startDate <= :postingDate', { postingDate })
      .andWhere('period.endDate >= :postingDate', { postingDate })
      .orderBy('period.startDate', 'DESC')
      .getOne();

    if (!period) {
      throw new BadRequestException(
        `Posting date ${postingDate} is outside configured accounting periods. Open an accounting period before posting.`,
      );
    }

    if (period.status !== AccountingPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Cannot post ${input.referenceType || 'journal'} into ${period.status} accounting period for ${postingDate}.`,
      );
    }

    return period;
  }
}
