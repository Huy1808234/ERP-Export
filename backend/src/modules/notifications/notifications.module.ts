import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SystemNotification } from './entities/system-notification.entity';
import { NotificationsListener } from './notifications.listener';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemNotification]),
    UsersModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
