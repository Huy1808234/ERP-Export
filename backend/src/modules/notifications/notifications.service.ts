import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemNotification } from './entities/system-notification.entity';
import { CreateSystemNotificationDto } from './dto/create-system-notification.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createEntityId } from '@/common/ids/entity-id.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(SystemNotification)
    private readonly notificationRepository: Repository<SystemNotification>,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue,
  ) {}

  async create(createDto: CreateSystemNotificationDto) {
    const _id = createEntityId('sys_notif');
    const jobData = {
      _id,
      ...createDto,
      createdAt: new Date(),
    };

    // Enqueue the job for async background processing
    await this.notificationsQueue.add('send', jobData);

    return jobData;
  }

  async processNotification(data: Partial<SystemNotification>) {
    const notification = this.notificationRepository.create(data);
    const saved = await this.notificationRepository.save(notification);

    // Emit event to Socket Gateway
    this.eventEmitter.emit('notification.new_system', saved);

    // Calculate new unread count and emit
    if (saved.userId) {
      const count = await this.countUnread(saved.userId);
      this.eventEmitter.emit('notification.unread_count', {
        userId: saved.userId,
        count,
      });
    }

    return saved;
  }

  async findAllForUser(userId: string, limit: number = 30) {
    const [data, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return { data, total };
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { _id: id, userId },
    });

    if (!notification || notification.isRead) return;

    notification.isRead = true;
    notification.readAt = new Date();
    await this.notificationRepository.save(notification);

    // Broadcast new count
    const count = await this.countUnread(userId);
    this.eventEmitter.emit('notification.unread_count', { userId, count });
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    // Broadcast new count
    this.eventEmitter.emit('notification.unread_count', { userId, count: 0 });
  }
}
