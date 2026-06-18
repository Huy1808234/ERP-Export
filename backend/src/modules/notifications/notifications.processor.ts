import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    console.log(`Processing notification job ${job.id} of type ${job.name}...`);
    const data = job.data;

    await this.notificationsService.processNotification(data);

    return { success: true };
  }
}
