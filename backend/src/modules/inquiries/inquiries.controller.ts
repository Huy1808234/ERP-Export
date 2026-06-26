import {
  Controller,
  Post,
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { Public, Roles, User } from '@/decorator/customize';
import { InquiryStatus } from './entities/inquiry.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, map } from 'rxjs';
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type';

@Controller('inquiries')
export class InquiriesController {
  constructor(
    private readonly inquiriesService: InquiriesService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Sse('stream')
  sse(): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'notification.new_inquiry').pipe(
      map((payload: any) => ({ data: payload }) as MessageEvent),
    );
  }

  @Public() // Allow guests to submit inquiries
  @Post()
  async create(@Body() data: any) {
    return {
      data: await this.inquiriesService.create(data),
    };
  }

  @Get('unread')
  async findUnread() {
    return {
      data: await this.inquiriesService.findUnread(),
    };
  }

  @Get('unread/count')
  async countUnread() {
    return {
      data: await this.inquiriesService.countUnread(),
    };
  }

  @Get()
  async findAll(@Query() query: any) {
    return {
      data: await this.inquiriesService.findAll(query),
    };
  }

  @Patch('read-all')
  async markAllAsRead() {
    return {
      data: await this.inquiriesService.markAllAsRead(),
    };
  }

  @Patch(':_id/status')
  @Roles('ADMIN', 'MANAGER', 'SALES_EXPORT')
  async updateStatus(
    @Param('_id') recordId: string,
    @Body('status') status: InquiryStatus,
    @User() user?: AuthenticatedUser,
  ) {
    return {
      data: await this.inquiriesService.updateStatus(
        recordId,
        status,
        user?.username || 'system',
      ),
    };
  }

  @Patch(':_id/read')
  async markAsRead(@Param('_id') recordId: string) {
    return {
      data: await this.inquiriesService.markAsRead(recordId),
    };
  }

  @Post('bulk-delete')
  @Roles('ADMIN', 'MANAGER')
  async bulkRemove(@Body('ids') ids: string[]) {
    return {
      data: await this.inquiriesService.bulkRemove(ids),
    };
  }

  @Delete(':_id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('_id') recordId: string) {
    return {
      data: await this.inquiriesService.remove(recordId),
    };
  }
}
