import { Controller, Get, Patch, Param, Post, Body, Req } from '@nestjs/common';
import * as express from 'express';
import { NotificationsService } from './notifications.service';
import { CreateSystemNotificationDto } from './dto/create-system-notification.dto';
import { Public } from '@/decorator/customize';
import { SystemNotificationType } from './entities/system-notification.entity';
import { UsersService } from '../users/users.service';

// We need a dummy type for Request with user, or we can just use any for now
// Assuming Request has user property attached by JwtAuthGuard
interface RequestWithUser extends express.Request {
  user: { _id: string; username: string };
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('test-trigger')
  @Public()
  async triggerTestNotification(@Req() req: express.Request) {
    const queryUser =
      typeof req.query.userId === 'string' ? req.query.userId : undefined;
    let userId = queryUser;

    // If queryUser is a username (e.g. admin_266b1b) instead of an ID (e.g. _user_...)
    if (queryUser && !queryUser.startsWith('_user_')) {
      const user = await this.usersService.findByUsername(queryUser);
      if (user) {
        userId = user._id;
      }
    }

    // If no userId query param is specified, try to parse from the auth header
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadJson = Buffer.from(parts[1], 'base64').toString(
              'utf-8',
            );
            const payload = JSON.parse(payloadJson) as Record<string, any>;
            if (payload && payload._id) {
              userId = payload._id;
            }
          }
        } catch (err) {
          // Ignore decode error
        }
      }
    }

    const newNotif = await this.notificationsService.create({
      userId,
      title: 'Thông báo Test từ Hệ thống',
      content: `Đây là thông báo test được tạo lúc ${new Date().toLocaleTimeString()}. Hệ thống realtime hoạt động tốt!`,
      type: SystemNotificationType.SUCCESS,
      targetUrl: '/dashboard',
    });
    return { message: 'Đã bắn thông báo thành công!', data: newNotif };
  }

  @Post()
  create(@Body() createNotificationDto: CreateSystemNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    const userId = req.user._id;
    return this.notificationsService.findAllForUser(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: RequestWithUser) {
    const userId = req.user._id;
    const count = await this.notificationsService.countUnread(userId);
    return { data: count }; // Wrap in data to match current response structure
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: RequestWithUser) {
    const userId = req.user._id;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    const userId = req.user._id;
    return this.notificationsService.markAsRead(id, userId);
  }
}
