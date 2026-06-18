import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExportDocumentsService } from './export-documents.service';

@Processor('document-generation')
export class DocumentProcessor extends WorkerHost {
  constructor(private readonly exportDocsService: ExportDocumentsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Processing job ${job.id} of type ${job.name}...`);

    const { documentId } = job.data;

    // Thực hiện render PDF thực tế
    await this.exportDocsService.generatePdf(documentId);

    return { success: true };
  }
}
