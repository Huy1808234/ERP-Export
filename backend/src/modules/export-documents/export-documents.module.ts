import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportDocumentsService } from './export-documents.service';
import { ExportDocument } from './entities/export-document.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessor } from './document.processor';
import {
  ExportDocumentsController,
  PortalExportDocumentsController,
} from './export-documents.controller';
import { ApprovalMatrixModule } from '@/modules/approval-matrix/approval-matrix.module';
import { ExportDocumentApprovalListener } from './export-document-approval.listener';
import { FilesModule } from '@/modules/files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExportDocument, Shipment]),
    BullModule.registerQueue({
      name: 'document-generation',
    }),
    ApprovalMatrixModule,
    FilesModule,
  ],
  controllers: [ExportDocumentsController, PortalExportDocumentsController],
  providers: [
    ExportDocumentsService,
    DocumentProcessor,
    ExportDocumentApprovalListener,
  ],
  exports: [ExportDocumentsService],
})
export class ExportDocumentsModule {}
