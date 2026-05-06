import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportDocumentsService } from './export-documents.service';
import { ExportDocument } from './entities/export-document.entity';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessor } from './document.processor';
import { ExportDocumentsController } from './export-documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExportDocument]),
    BullModule.registerQueue({
      name: 'document-generation',
    }),
  ],
  controllers: [ExportDocumentsController],
  providers: [ExportDocumentsService, DocumentProcessor],
  exports: [ExportDocumentsService],
})
export class ExportDocumentsModule {}
