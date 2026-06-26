import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import { AccountingPeriod } from '@/modules/accounting/entities/accounting-period.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(AccountingPeriod);

  // Check if period for 2026-06 already exists
  const existing = await repo.findOne({
    where: {
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
    },
  });

  if (!existing) {
    const period = new AccountingPeriod();
    period._id = createEntityId('period');
    period.startDate = new Date('2026-06-01');
    period.endDate = new Date('2026-06-30');
    period.status = 'OPEN' as any;
    
    await repo.save(period);
    console.log('Successfully created accounting period for 2026-06');
  } else {
    existing.status = 'OPEN' as any;
    await repo.save(existing);
    console.log('Accounting period for 2026-06 already exists, updated status to OPEN');
  }

  await app.close();
}

bootstrap();
