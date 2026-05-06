import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { AccountPayablesController } from './account-payables.controller';
import { AccountPayablesService } from './account-payables.service';
import { AccountPayable } from './entities/account-payable.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccountPayable, Partner])],
  controllers: [AccountPayablesController],
  providers: [AccountPayablesService],
  exports: [AccountPayablesService],
})
export class AccountPayablesModule {}
