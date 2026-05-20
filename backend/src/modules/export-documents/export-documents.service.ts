import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  DocumentChecklistStatus,
  DocumentType,
  ExportDocumentAuditAction,
  ExportDocumentAuditEvent,
  ExportDocument,
} from './entities/export-document.entity';
import { Shipment, ShipmentStatus } from '@/modules/shipments/entities/shipment.entity';
import { UpsertExportDocumentDto } from './dto/upsert-export-document.dto';
import { ReviewExportDocumentDto } from './dto/review-export-document.dto';
import { User } from '@/modules/users/entities/user.entity';
import type { AuthenticatedUser, QueryParams } from '@/common/types/authenticated-user.type';
import { ApprovalMatrixService } from '@/modules/approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '@/modules/approval-matrix/entities/approval-rule.entity';
import { FilesService } from '@/modules/files/files.service';

const PdfPrinter = require('pdfmake');

const REQUIRED_EXPORT_DOCUMENTS = [
  DocumentType.COMMERCIAL_INVOICE,
  DocumentType.PACKING_LIST,
  DocumentType.BILL_OF_LADING,
  DocumentType.CERTIFICATE_OF_ORIGIN,
  DocumentType.CUSTOMS_DECLARATION,
];

const OPTIONAL_EXPORT_DOCUMENTS = [
  DocumentType.AIRWAY_BILL,
  DocumentType.PACKING_DECLARATION,
  DocumentType.PHYTOSANITARY_CERTIFICATE,
  DocumentType.HEALTH_CERTIFICATE,
  DocumentType.FUMIGATION_CERTIFICATE,
  DocumentType.QUALITY_INSPECTION_CERTIFICATE,
  DocumentType.VAT_REFUND_DOSSIER,
  DocumentType.OTHER,
];

type SnapshotDocumentItem = {
  sku?: string | null;
  productName?: string | null;
  hsCode?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  totalPrice: number;
  netWeight?: number | null;
  grossWeight?: number | null;
  cbm?: number | null;
};

type SnapshotDocumentData = Record<string, unknown> & {
  invoiceNumber?: string;
  shipmentNumber?: string;
  contractNumber?: string;
  buyerName?: string | null;
  buyerAddress?: string | null;
  currency?: string;
  totalAmount?: number;
  incoterm?: string;
  paymentTerms?: string | null;
  items?: SnapshotDocumentItem[];
};

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  [DocumentType.COMMERCIAL_INVOICE]: 'Commercial Invoice',
  [DocumentType.PACKING_LIST]: 'Packing List',
  [DocumentType.PROFORMA_INVOICE]: 'Proforma Invoice',
  [DocumentType.BILL_OF_LADING]: 'Bill of Lading',
  [DocumentType.AIRWAY_BILL]: 'Airway Bill',
  [DocumentType.CERTIFICATE_OF_ORIGIN]: 'Certificate of Origin',
  [DocumentType.PACKING_DECLARATION]: 'Packing Declaration',
  [DocumentType.CUSTOMS_DECLARATION]: 'Customs Declaration',
  [DocumentType.PHYTOSANITARY_CERTIFICATE]: 'Phytosanitary Certificate',
  [DocumentType.HEALTH_CERTIFICATE]: 'Health Certificate',
  [DocumentType.FUMIGATION_CERTIFICATE]: 'Fumigation Certificate',
  [DocumentType.QUALITY_INSPECTION_CERTIFICATE]: 'Quality Inspection Certificate',
  [DocumentType.VAT_REFUND_DOSSIER]: 'VAT Refund Dossier',
  [DocumentType.OTHER]: 'Other Document',
};

const BUSINESS_FORM_REQUIRED_FIELDS: Partial<Record<DocumentType, string[]>> = {
  [DocumentType.BILL_OF_LADING]: [
    'blNumber',
    'carrierName',
    'vesselName',
    'voyageNumber',
    'portOfLoading',
    'portOfDischarge',
    'onBoardDate',
    'freightTerms',
  ],
  [DocumentType.AIRWAY_BILL]: [
    'awbNumber',
    'airlineName',
    'flightNumber',
    'airportOfDeparture',
    'airportOfDestination',
    'departureDate',
  ],
  [DocumentType.CERTIFICATE_OF_ORIGIN]: [
    'coNumber',
    'coForm',
    'issuingAuthority',
    'issueDate',
    'originCountry',
  ],
  [DocumentType.CUSTOMS_DECLARATION]: [
    'declarationNumber',
    'customsOffice',
    'declarationDate',
    'clearanceDate',
    'channel',
  ],
  [DocumentType.PACKING_DECLARATION]: [
    'declarationNumber',
    'packingMaterial',
    'treatmentStatement',
    'issueDate',
    'declarantName',
  ],
  [DocumentType.PHYTOSANITARY_CERTIFICATE]: [
    'certificateNumber',
    'issuingAuthority',
    'issueDate',
    'botanicalName',
    'inspectionPlace',
  ],
  [DocumentType.HEALTH_CERTIFICATE]: [
    'certificateNumber',
    'issuingAuthority',
    'issueDate',
    'productDescription',
    'healthStatement',
  ],
  [DocumentType.FUMIGATION_CERTIFICATE]: [
    'certificateNumber',
    'fumigationCompany',
    'fumigationDate',
    'chemicalUsed',
    'dosage',
  ],
  [DocumentType.QUALITY_INSPECTION_CERTIFICATE]: [
    'certificateNumber',
    'inspectionAgency',
    'issueDate',
    'inspectionStandard',
    'inspectionResult',
  ],
};

@Injectable()
export class ExportDocumentsService {
  constructor(
    @InjectRepository(ExportDocument)
    private docsRepository: Repository<ExportDocument>,
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
    @InjectQueue('document-generation')
    private readonly docQueue: Queue,
    private readonly approvalMatrixService: ApprovalMatrixService,
    private readonly filesService: FilesService,
  ) {}

  async findAll(query: QueryParams) {
    const current = Number(typeof query.current === 'string' ? query.current : 1);
    const pageSize = Number(typeof query.pageSize === 'string' ? query.pageSize : 20);
    const skip = (current - 1) * pageSize;

    const where: FindOptionsWhere<ExportDocument> = {};
    const shipmentId = typeof query.shipmentId === 'string' ? query.shipmentId : undefined;
    const documentType = typeof query.documentType === 'string' ? query.documentType : undefined;
    const currentOnly = typeof query.currentOnly === 'string' ? query.currentOnly : undefined;
    if (shipmentId) where.shipmentId = shipmentId;
    if (documentType && Object.values(DocumentType).includes(documentType as DocumentType)) {
      where.documentType = documentType as DocumentType;
    }
    if (currentOnly !== 'false') where.isCurrentVersion = true;

    const [results, total] = await this.docsRepository.findAndCount({
      where,
      relations: ['shipment'],
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip,
    });

    return {
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
    };
  }

  async findByShipment(shipmentId: string) {
    const shipment = await this.loadShipment(shipmentId);
    const documents = await this.docsRepository.find({
      where: { shipmentId },
      order: { documentType: 'ASC', versionNo: 'DESC', createdAt: 'DESC' },
    });
    const currentDocuments = documents.filter((doc) => doc.isCurrentVersion);

    return {
      shipment,
      checklist: this.buildChecklist(shipment, currentDocuments),
      vatRefundDossier: this.buildVatRefundDossier(currentDocuments),
      documents,
    };
  }

  async getDocumentAudit(recordId: string) {
    const document = await this.docsRepository.findOne({ where: { _id: recordId } });
    if (!document) throw new NotFoundException('Export document not found');

    const versions = await this.docsRepository.find({
      where: {
        shipmentId: document.shipmentId,
        documentType: document.documentType,
      },
      order: { versionNo: 'DESC', createdAt: 'DESC' },
    });

    return {
      document,
      versions,
      auditTrail: versions.flatMap((version) => version.auditTrail || []),
    };
  }

  async upsertDocument(dto: UpsertExportDocumentDto, user: User) {
    await this.loadShipment(dto.shipmentId);
    const fileAsset = dto.fileAsset_id ? await this.filesService.findOne(dto.fileAsset_id) : null;
    const businessData = this.normalizeBusinessData(dto.documentType, dto.businessData);
    const documentNumber = dto.documentNumber || this.deriveDocumentNumber(dto.documentType, businessData);
    const customsClearedAt = dto.customsClearedAt || this.getStringValue(businessData, 'clearanceDate');
    const versionNo = await this.getNextVersion(dto.shipmentId, dto.documentType);
    const fileUrl = dto.fileUrl || fileAsset?.url || '';
    const fileName = dto.fileName || fileAsset?.fileName || this.buildFileName(dto.documentType, dto.shipmentId, versionNo);

    await this.markPreviousVersionsAsHistorical(dto.shipmentId, dto.documentType);
    const checklistStatus = dto.checklistStatus ?? (fileUrl ? DocumentChecklistStatus.UPLOADED : DocumentChecklistStatus.DRAFT);
    const auditTrail = [
      this.createAuditEvent(ExportDocumentAuditAction.VERSION_CREATED, user.username, {
        versionNo,
        checklistStatus,
        note: dto.notes,
      }),
    ];

    if (fileUrl) {
      auditTrail.push(this.createAuditEvent(ExportDocumentAuditAction.FILE_UPLOADED, user.username, {
        versionNo,
        checklistStatus,
        fileName: dto.originalFileName || fileAsset?.originalName || fileName || null,
        fileUrl,
        fileAsset_id: fileAsset?._id || null,
      }));
    }

    const doc = this.docsRepository.create({
      shipmentId: dto.shipmentId,
      documentType: dto.documentType,
      documentNumber,
      versionNo,
      isCurrentVersion: true,
      checklistStatus,
      fileName,
      originalFileName: dto.originalFileName || fileAsset?.originalName,
      mimeType: dto.mimeType || fileAsset?.mimeType,
      fileSize: Number(dto.fileSize || fileAsset?.size || 0),
      fileUrl,
      fileAsset_id: fileAsset?._id || null,
      snapshotData: dto.snapshotData,
      businessData,
      auditTrail,
      isGenerated: false,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      customsDeclarationNumber: dto.customsDeclarationNumber || this.getStringValue(businessData, 'declarationNumber'),
      customsClearedAt: customsClearedAt ? new Date(customsClearedAt) : undefined,
      uploadedByUsername: user.username,
      sharedWithBuyer: Boolean(dto.sharedWithBuyer),
      sharedByUsername: dto.sharedWithBuyer ? user.username : undefined,
      sharedAt: dto.sharedWithBuyer ? new Date() : undefined,
      notes: dto.notes,
    });

    const savedDoc = await this.docsRepository.save(doc);
    if (fileAsset) {
      await this.filesService.linkToDocument(fileAsset._id, {
        linkedModule: 'export-documents',
        linkedDocumentType: dto.documentType,
        linkedDocument_id: savedDoc._id,
        username: user.username,
        note: `Linked to export document ${documentNumber || savedDoc._id} v${versionNo}`,
      });
    }

    return savedDoc;
  }

  async setBuyerSharing(recordId: string, sharedWithBuyer: boolean, user: User) {
    const doc = await this.docsRepository.findOne({
      where: { _id: recordId },
      relations: ['shipment', 'shipment.salesContract', 'shipment.salesContract.buyer'],
    });
    if (!doc) throw new NotFoundException('Export document not found');
    if (!doc.isCurrentVersion) {
      throw new BadRequestException('Only current document versions can be shared with buyer');
    }
    if (sharedWithBuyer && !doc.fileUrl && !doc.snapshotData) {
      throw new BadRequestException('Document needs an uploaded file or generated snapshot before sharing');
    }

    doc.sharedWithBuyer = sharedWithBuyer;
    doc.sharedByUsername = sharedWithBuyer ? user.username : null;
    doc.sharedAt = sharedWithBuyer ? new Date() : null;
    this.appendAuditEvent(
      doc,
      sharedWithBuyer ? ExportDocumentAuditAction.SHARED : ExportDocumentAuditAction.UNSHARED,
      user.username,
      {
        versionNo: doc.versionNo,
        checklistStatus: doc.checklistStatus,
        note: sharedWithBuyer ? 'Shared with buyer portal' : 'Removed from buyer portal',
      },
    );
    return this.docsRepository.save(doc);
  }

  async findSharedPortalDocuments(user: AuthenticatedUser) {
    if (!user?.partnerId) {
      throw new BadRequestException('Portal user is not linked to a buyer account');
    }

    const documents = await this.docsRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.shipment', 'shipment')
      .leftJoinAndSelect('shipment.salesContract', 'salesContract')
      .leftJoinAndSelect('salesContract.buyer', 'buyer')
      .where('doc."sharedWithBuyer" = true')
      .andWhere('doc."isCurrentVersion" = true')
      .andWhere('salesContract."buyerId" = :buyerId', { buyerId: user.partnerId })
      .orderBy('doc."sharedAt"', 'DESC', 'NULLS LAST')
      .addOrderBy('doc."createdAt"', 'DESC')
      .getMany();

    return documents.map((doc) => ({
      _id: doc._id,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      versionNo: doc.versionNo,
      checklistStatus: doc.checklistStatus,
      fileName: doc.originalFileName || doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate,
      sharedAt: doc.sharedAt,
      downloadCount: doc.downloadCount,
      shipment: doc.shipment ? {
        _id: doc.shipment._id,
        shipmentNumber: doc.shipment.shipmentNumber,
        status: doc.shipment.status,
        pol: doc.shipment.pol,
        pod: doc.shipment.pod,
        etd: doc.shipment.etd,
        eta: doc.shipment.eta,
        salesContract: doc.shipment.salesContract ? {
          _id: doc.shipment.salesContract._id,
          contractNumber: doc.shipment.salesContract.contractNumber,
        } : null,
      } : null,
    }));
  }

  async downloadSharedPortalDocument(recordId: string, user: AuthenticatedUser) {
    const doc = await this.docsRepository.findOne({
      where: {
        _id: recordId,
        isCurrentVersion: true,
        sharedWithBuyer: true,
      },
      relations: ['shipment', 'shipment.salesContract', 'shipment.salesContract.buyer'],
    });
    if (!doc) throw new NotFoundException('Shared export document not found');
    if (!user?.partnerId || doc.shipment?.salesContract?.buyerId !== user.partnerId) {
      throw new BadRequestException('Document does not belong to this buyer account');
    }

    const file = await this.resolveDocumentDownload(doc);
    doc.downloadCount = Number(doc.downloadCount || 0) + 1;
    doc.lastDownloadedAt = new Date();
    this.appendAuditEvent(doc, ExportDocumentAuditAction.DOWNLOADED, user?.username || 'buyer-portal', {
      versionNo: doc.versionNo,
      checklistStatus: doc.checklistStatus,
      fileName: file.fileName,
      fileUrl: doc.fileUrl,
    });
    await this.docsRepository.save(doc);
    return file;
  }

  async reviewDocument(recordId: string, dto: ReviewExportDocumentDto, user: User) {
    const doc = await this.docsRepository.findOne({ where: { _id: recordId } });
    if (!doc) throw new NotFoundException('Export document not found');

    if (this.requiresReviewApproval(dto.checklistStatus)) {
      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.EXPORT_DOCUMENT_REVIEW,
        0,
        'VND',
      );
      if (!matchingRule) {
        throw new BadRequestException(
          'Chua co approval rule cho export document review; khong duoc review/approve truc tiep',
        );
      }

      const documentNumber = doc.documentNumber || `${doc.documentType}-v${doc.versionNo}`;
      const approvalRequest = await this.approvalMatrixService.createRequest(
        {
          ruleId: matchingRule._id,
          documentType: ApprovalDocumentType.EXPORT_DOCUMENT_REVIEW,
          documentId: doc._id,
          documentNumber,
          title: `Approve Export Document Review ${documentNumber}`,
          currency: 'VND',
          amount: 0,
          amountVnd: 0,
          metadata: {
            source: 'export_documents.reviewDocument',
            shipmentId: doc.shipmentId,
            documentType: doc.documentType,
            versionNo: doc.versionNo,
            targetChecklistStatus: dto.checklistStatus,
            notes: dto.notes || null,
          },
        },
        user,
      );

      doc.approvalWorkflowRequestId = approvalRequest?._id || null;
      if (dto.notes !== undefined) doc.notes = dto.notes;
      this.appendAuditEvent(doc, ExportDocumentAuditAction.REVIEW_REQUESTED, user.username, {
        versionNo: doc.versionNo,
        checklistStatus: dto.checklistStatus,
        note: dto.notes,
      });

      return {
        ...(await this.docsRepository.save(doc)),
        approvalRequest,
      };
    }

    doc.checklistStatus = dto.checklistStatus;
    doc.reviewedByUsername = user.username;
    doc.reviewedAt = new Date();
    if (dto.notes !== undefined) doc.notes = dto.notes;
    this.appendAuditEvent(doc, ExportDocumentAuditAction.REVIEWED, user.username, {
      versionNo: doc.versionNo,
      checklistStatus: dto.checklistStatus,
      note: dto.notes,
    });

    return this.docsRepository.save(doc);
  }

  async completeDocumentReviewWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    metadata?: Record<string, unknown>,
  ) {
    const doc = await this.docsRepository.findOne({ where: { _id: recordId } });
    if (!doc) throw new NotFoundException('Export document not found');

    const targetChecklistStatus =
      typeof metadata?.targetChecklistStatus === 'string' &&
      Object.values(DocumentChecklistStatus).includes(
        metadata.targetChecklistStatus as DocumentChecklistStatus,
      )
        ? (metadata.targetChecklistStatus as DocumentChecklistStatus)
        : DocumentChecklistStatus.APPROVED;

    doc.checklistStatus = targetChecklistStatus;
    doc.reviewedByUsername = username;
    doc.reviewedAt = new Date();
    doc.approvalWorkflowRequestId = requestId;
    if (typeof metadata?.notes === 'string') doc.notes = metadata.notes;
    this.appendAuditEvent(doc, ExportDocumentAuditAction.REVIEWED, username, {
      versionNo: doc.versionNo,
      checklistStatus: doc.checklistStatus,
      note: typeof metadata?.notes === 'string' ? metadata.notes : null,
    });

    return this.docsRepository.save(doc);
  }

  async rejectDocumentReviewWorkflow(
    recordId: string,
    requestId: string,
    username: string,
    reason?: string | null,
  ) {
    const doc = await this.docsRepository.findOne({ where: { _id: recordId } });
    if (!doc) throw new NotFoundException('Export document not found');

    doc.approvalWorkflowRequestId = requestId;
    this.appendAuditEvent(doc, ExportDocumentAuditAction.REVIEW_REJECTED, username, {
      versionNo: doc.versionNo,
      checklistStatus: doc.checklistStatus,
      note: reason || 'Rejected by approval workflow',
    });

    return this.docsRepository.save(doc);
  }

  async generateSnapshotDocument(shipmentId: string, documentType: DocumentType) {
    if (![DocumentType.COMMERCIAL_INVOICE, DocumentType.PACKING_LIST].includes(documentType)) {
      throw new BadRequestException('Only Commercial Invoice and Packing List can be generated automatically');
    }

    return this.createSnapshotFromShipment(shipmentId, documentType);
  }

  /**
   * Render PDF synchronously for immediate download and keep a current snapshot record.
   */
  async generateDocumentPdf(shipmentId: string, type: 'CI' | 'PL'): Promise<Buffer> {
    const documentType = this.shortTypeToDocumentType(type);

    let doc = await this.docsRepository.findOne({
      where: { shipmentId, documentType, isCurrentVersion: true },
      order: { createdAt: 'DESC' },
    });

    if (!doc) {
      doc = await this.createSnapshotFromShipment(shipmentId, documentType);
    }

    return this.renderDocumentBuffer(doc);
  }

  async requestDocumentGeneration(shipmentId: string, type: DocumentType, snapshotData: Record<string, unknown>) {
    await this.loadShipment(shipmentId);
    const versionNo = await this.getNextVersion(shipmentId, type);
    await this.markPreviousVersionsAsHistorical(shipmentId, type);

    const doc = this.docsRepository.create({
      shipmentId,
      documentType: type,
      snapshotData,
      isGenerated: false,
      checklistStatus: DocumentChecklistStatus.DRAFT,
      isCurrentVersion: true,
      versionNo,
      fileName: this.buildFileName(type, shipmentId, versionNo),
      fileUrl: '',
      auditTrail: [
        this.createAuditEvent(ExportDocumentAuditAction.VERSION_CREATED, 'system', {
          versionNo,
          checklistStatus: DocumentChecklistStatus.DRAFT,
          note: 'Queued for PDF generation',
        }),
      ],
    });

    const savedDoc = await this.docsRepository.save(doc);
    await this.docQueue.add('generate-pdf', { documentId: savedDoc._id });

    return {
      message: 'Document generation request has been queued.',
      documentId: savedDoc._id,
    };
  }

  async generatePdf(documentId: string) {
    const doc = await this.docsRepository.findOne({ where: { _id: documentId } });
    if (!doc) return;

    const docDefinition =
      doc.documentType === DocumentType.COMMERCIAL_INVOICE
        ? this.getCommercialInvoiceDefinition(doc)
        : doc.documentType === DocumentType.PACKING_LIST
          ? this.getPackingListDefinition(doc)
          : this.getGenericDocumentDefinition(doc);

    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
      Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
      },
    };

    try {
      const printer = new PdfPrinter(fonts);
      const pdfDoc = printer.createPdfKitDocument(docDefinition);

      const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, doc.fileName || this.buildFileName(doc.documentType, doc.shipmentId, doc.versionNo));
      pdfDoc.pipe(fs.createWriteStream(filePath));
      pdfDoc.end();

      doc.isGenerated = true;
      doc.checklistStatus = DocumentChecklistStatus.GENERATED;
      doc.fileUrl = `/uploads/documents/${path.basename(filePath)}`;
      this.appendAuditEvent(doc, ExportDocumentAuditAction.GENERATED, 'system', {
        versionNo: doc.versionNo,
        checklistStatus: doc.checklistStatus,
        fileName: path.basename(filePath),
        fileUrl: doc.fileUrl,
      });
      await this.docsRepository.save(doc);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  }

  private async createSnapshotFromShipment(shipmentId: string, documentType: DocumentType) {
    const shipment = await this.loadShipment(shipmentId);
    const contract = shipment.salesContract;
    const buyer = contract.buyer;
    const items: SnapshotDocumentItem[] = (contract.items || []).map((item) => {
      const product = item.product;
      const cartons = product?.piecesPerCarton ? Number(item.quantity || 0) / Number(product.piecesPerCarton) : 0;

      return {
        sku: product?.sku,
        productName: product?.englishName || product?.vietnameseName || product?.description || product?.sku,
        hsCode: product?.hsCode,
        quantity: Number(item.quantity || 0),
        unit: product?.unitOfMeasure || 'PCS',
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.quantity || 0) * Number(item.unitPrice || 0),
        netWeight: cartons && product?.netWeightPerCarton ? Number((cartons * Number(product.netWeightPerCarton)).toFixed(2)) : null,
        grossWeight: cartons && product?.grossWeightPerCarton ? Number((cartons * Number(product.grossWeightPerCarton)).toFixed(2)) : null,
        cbm: cartons && product?.cbmPerCarton ? Number((cartons * Number(product.cbmPerCarton)).toFixed(4)) : null,
      };
    });

    const documentNumber =
      documentType === DocumentType.COMMERCIAL_INVOICE
        ? `CI-${shipment.shipmentNumber}`
        : `PL-${shipment.shipmentNumber}`;
    const versionNo = await this.getNextVersion(shipmentId, documentType);
    await this.markPreviousVersionsAsHistorical(shipmentId, documentType);

    const snapshotData: SnapshotDocumentData = {
      invoiceNumber: documentNumber,
      shipmentNumber: shipment.shipmentNumber,
      contractNumber: contract.contractNumber,
      buyerName: buyer?.name,
      buyerAddress: buyer?.address,
      currency: contract.currencyCode || 'USD',
      totalAmount: contract.totalAmount,
      incoterm: contract.incoterm,
      paymentTerms: contract.paymentTerms,
      pol: shipment.pol,
      pod: shipment.pod,
      vesselName: shipment.vesselName,
      voyageNumber: shipment.voyageNumber,
      blNumber: shipment.blNumber,
      containers: shipment.containers || [],
      items,
    };

    const doc = this.docsRepository.create({
      shipmentId,
      documentType,
      documentNumber,
      versionNo,
      isCurrentVersion: true,
      checklistStatus: DocumentChecklistStatus.GENERATED,
      snapshotData,
      businessData: null,
      auditTrail: [
        this.createAuditEvent(ExportDocumentAuditAction.VERSION_CREATED, 'system', {
          versionNo,
          checklistStatus: DocumentChecklistStatus.GENERATED,
          note: 'Generated from shipment snapshot',
        }),
        this.createAuditEvent(ExportDocumentAuditAction.GENERATED, 'system', {
          versionNo,
          checklistStatus: DocumentChecklistStatus.GENERATED,
          note: 'CI/PL snapshot generated',
        }),
      ],
      isGenerated: false,
      fileName: this.buildFileName(documentType, shipment.shipmentNumber, versionNo),
      fileUrl: '',
      issueDate: new Date(),
    });

    return this.docsRepository.save(doc);
  }

  private async loadShipment(shipmentId: string) {
    const shipment = await this.shipmentRepository.findOne({
      where: { _id: shipmentId },
      relations: [
        'salesContract',
        'salesContract.buyer',
        'salesContract.items',
        'salesContract.items.product',
        'containers',
      ],
    });

    if (!shipment?.salesContract) {
      throw new BadRequestException('Shipment or linked sales contract was not found');
    }

    return shipment;
  }

  private async getNextVersion(shipmentId: string, documentType: DocumentType) {
    const latest = await this.docsRepository.findOne({
      where: { shipmentId, documentType },
      order: { versionNo: 'DESC', createdAt: 'DESC' },
    });
    return (latest?.versionNo || 0) + 1;
  }

  private async markPreviousVersionsAsHistorical(shipmentId: string, documentType: DocumentType) {
    await this.docsRepository.update({ shipmentId, documentType, isCurrentVersion: true }, { isCurrentVersion: false });
  }

  private async resolveDocumentDownload(doc: ExportDocument) {
    if (doc.fileUrl) {
      const uploadRoot = path.resolve(process.cwd(), 'uploads');
      const relativePath = doc.fileUrl.replace(/^\/uploads[\\/]/, '').replace(/^uploads[\\/]/, '');
      const filePath = path.resolve(uploadRoot, relativePath);

      if (!filePath.startsWith(uploadRoot) || !fs.existsSync(filePath)) {
        throw new NotFoundException('Document file was not found on storage');
      }

      return {
        buffer: await fs.promises.readFile(filePath),
        mimeType: doc.mimeType || 'application/octet-stream',
        fileName: doc.originalFileName || doc.fileName || path.basename(filePath),
      };
    }

    return {
      buffer: await this.renderDocumentBuffer(doc),
      mimeType: 'application/pdf',
      fileName: doc.fileName || this.buildFileName(doc.documentType, doc.shipmentId, doc.versionNo),
    };
  }

  private async renderDocumentBuffer(doc: ExportDocument): Promise<Buffer> {
    const docDefinition =
      doc.documentType === DocumentType.COMMERCIAL_INVOICE
        ? this.getCommercialInvoiceDefinition(doc)
        : doc.documentType === DocumentType.PACKING_LIST
          ? this.getPackingListDefinition(doc)
          : this.getGenericDocumentDefinition(doc);

    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
      Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
      },
    };

    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: Error) => reject(err));
      pdfDoc.end();
    });
  }

  private buildChecklist(shipment: Shipment, documents: ExportDocument[]) {
    const currentByType = new Map(documents.map((doc) => [doc.documentType, doc]));
    const requiredDocuments = [...REQUIRED_EXPORT_DOCUMENTS];

    if ([ShipmentStatus.CUSTOMS_CLEARED, ShipmentStatus.ON_BOARD, ShipmentStatus.ARRIVED, ShipmentStatus.CLOSED].includes(shipment.status)) {
      requiredDocuments.push(DocumentType.VAT_REFUND_DOSSIER);
    }

    const rows = requiredDocuments.map((documentType) => {
      const doc = currentByType.get(documentType);
      return {
        documentType,
        label: DOCUMENT_LABELS[documentType],
        required: true,
        status: doc?.checklistStatus ?? DocumentChecklistStatus.MISSING,
        document: doc ?? null,
      };
    });

    for (const documentType of OPTIONAL_EXPORT_DOCUMENTS) {
      if (requiredDocuments.includes(documentType)) continue;
      const doc = currentByType.get(documentType);
      if (documentType === DocumentType.OTHER && !doc) continue;
      rows.push({
        documentType,
        label: DOCUMENT_LABELS[documentType],
        required: false,
        status: doc?.checklistStatus ?? DocumentChecklistStatus.MISSING,
        document: doc ?? null,
      });
    }

    return rows;
  }

  private buildVatRefundDossier(documents: ExportDocument[]) {
    const currentByType = new Map(documents.map((doc) => [doc.documentType, doc]));
    const required = [
      DocumentType.COMMERCIAL_INVOICE,
      DocumentType.PACKING_LIST,
      DocumentType.BILL_OF_LADING,
      DocumentType.CERTIFICATE_OF_ORIGIN,
      DocumentType.CUSTOMS_DECLARATION,
    ];

    const checklist = required.map((documentType) => {
      const doc = currentByType.get(documentType);
      const ready = !!doc && ![
        DocumentChecklistStatus.MISSING,
        DocumentChecklistStatus.DRAFT,
        DocumentChecklistStatus.EXPIRED,
        DocumentChecklistStatus.NOT_APPLICABLE,
      ].includes(doc.checklistStatus);

      return {
        documentType,
        label: DOCUMENT_LABELS[documentType],
        ready,
        status: doc?.checklistStatus ?? DocumentChecklistStatus.MISSING,
      };
    });

    return {
      ready: checklist.every((item) => item.ready),
      checklist,
    };
  }

  private shortTypeToDocumentType(type: 'CI' | 'PL') {
    return type === 'CI' ? DocumentType.COMMERCIAL_INVOICE : DocumentType.PACKING_LIST;
  }

  private buildFileName(documentType: DocumentType, reference: string, versionNo: number) {
    return `${documentType}_${reference}_v${versionNo}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  private normalizeBusinessData(documentType: DocumentType, rawData?: Record<string, unknown>) {
    const requiredFields = BUSINESS_FORM_REQUIRED_FIELDS[documentType];
    if (!requiredFields) return rawData || null;

    const businessData = rawData || {};
    const missingFields = requiredFields.filter((field) => !this.getStringValue(businessData, field));
    if (missingFields.length) {
      throw new BadRequestException(`Missing required business fields: ${missingFields.join(', ')}`);
    }

    return businessData;
  }

  private deriveDocumentNumber(documentType: DocumentType, businessData: Record<string, unknown> | null) {
    const numberFieldByType: Partial<Record<DocumentType, string>> = {
      [DocumentType.BILL_OF_LADING]: 'blNumber',
      [DocumentType.AIRWAY_BILL]: 'awbNumber',
      [DocumentType.CERTIFICATE_OF_ORIGIN]: 'coNumber',
      [DocumentType.CUSTOMS_DECLARATION]: 'declarationNumber',
      [DocumentType.PACKING_DECLARATION]: 'declarationNumber',
      [DocumentType.PHYTOSANITARY_CERTIFICATE]: 'certificateNumber',
      [DocumentType.HEALTH_CERTIFICATE]: 'certificateNumber',
      [DocumentType.FUMIGATION_CERTIFICATE]: 'certificateNumber',
      [DocumentType.QUALITY_INSPECTION_CERTIFICATE]: 'certificateNumber',
    };

    const numberField = numberFieldByType[documentType];
    return numberField ? this.getStringValue(businessData, numberField) : undefined;
  }

  private getStringValue(data: Record<string, unknown> | null | undefined, key: string) {
    const value = data?.[key];
    if (value === null || value === undefined || value === '') return undefined;
    return String(value);
  }

  private requiresReviewApproval(status: DocumentChecklistStatus) {
    return [
      DocumentChecklistStatus.REVIEWED,
      DocumentChecklistStatus.APPROVED,
    ].includes(status);
  }

  private createAuditEvent(
    action: ExportDocumentAuditAction,
    username: string,
    extra: Partial<Omit<ExportDocumentAuditEvent, 'action' | 'username' | 'at'>> = {},
  ): ExportDocumentAuditEvent {
    return {
      action,
      username: username || 'system',
      at: new Date().toISOString(),
      ...extra,
    };
  }

  private appendAuditEvent(
    doc: ExportDocument,
    action: ExportDocumentAuditAction,
    username: string,
    extra: Partial<Omit<ExportDocumentAuditEvent, 'action' | 'username' | 'at'>> = {},
  ) {
    doc.auditTrail = [
      ...(Array.isArray(doc.auditTrail) ? doc.auditTrail : []),
      this.createAuditEvent(action, username, extra),
    ];
  }

  private getGenericDocumentDefinition(doc: ExportDocument) {
    return {
      content: [
        { text: DOCUMENT_LABELS[doc.documentType] || doc.documentType, style: 'header' },
        { text: `Shipment ID: ${doc.shipmentId}`, margin: [0, 10] },
        { text: `Document No: ${doc.documentNumber || '-'}`, margin: [0, 5] },
        { text: 'Snapshot Data:', style: 'subheader' },
        { text: JSON.stringify(doc.snapshotData || {}, null, 2), font: 'Courier' },
        { text: '\n\nGenerated by Mini ERP Export System', style: 'footer' },
      ],
      styles: {
        header: { fontSize: 22, bold: true },
        subheader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
        footer: { fontSize: 10, italics: true, alignment: 'center' },
      },
      defaultStyle: { font: 'Helvetica' },
    };
  }

  private getSnapshotData(doc: ExportDocument): SnapshotDocumentData {
    return (doc.snapshotData || {}) as SnapshotDocumentData;
  }

  private getCommercialInvoiceDefinition(doc: ExportDocument) {
    const data = this.getSnapshotData(doc);
    const items = Array.isArray(data.items) ? data.items : [];

    return {
      content: [
        { text: 'COMMERCIAL INVOICE', style: 'header', alignment: 'center' },
        { text: `No: ${data.invoiceNumber || doc.documentNumber || 'N/A'}`, alignment: 'right' },
        { text: `Date: ${new Date().toLocaleDateString()}`, alignment: 'right', margin: [0, 0, 0, 20] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'SELLER:', bold: true },
                { text: 'MINI ERP EXPORT TRADING CO.' },
                { text: 'Ho Chi Minh City, Vietnam' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: 'BUYER:', bold: true },
                { text: data.buyerName || 'N/A' },
                { text: data.buyerAddress || 'N/A' },
              ],
            },
          ],
          margin: [0, 0, 0, 20],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Description', bold: true },
                { text: 'Qty', bold: true },
                { text: 'Unit Price', bold: true },
                { text: 'Amount', bold: true },
              ],
              ...items.map((item) => [
                item.productName || item.sku,
                item.quantity,
                `${item.unitPrice} ${data.currency || 'USD'}`,
                `${item.totalPrice} ${data.currency || 'USD'}`,
              ]),
              [
                { text: 'TOTAL', bold: true, colSpan: 3 },
                {},
                {},
                { text: `${data.totalAmount} ${data.currency || 'USD'}`, bold: true },
              ],
            ],
          },
        },
        { text: `Incoterm: ${data.incoterm || 'FOB'}`, margin: [0, 20, 0, 0] },
        { text: `Payment Terms: ${data.paymentTerms || 'T/T'}`, margin: [0, 5, 0, 0] },
        { text: '\n\nAuthorized Signature', alignment: 'right', margin: [0, 50, 0, 0] },
      ],
      styles: {
        header: { fontSize: 24, bold: true, margin: [0, 0, 0, 10] },
        footer: { fontSize: 10, italics: true, alignment: 'center' },
      },
      defaultStyle: { font: 'Helvetica' },
    };
  }

  private getPackingListDefinition(doc: ExportDocument) {
    const data = this.getSnapshotData(doc);
    const items = Array.isArray(data.items) ? data.items : [];

    return {
      content: [
        { text: 'PACKING LIST', style: 'header', alignment: 'center' },
        { text: `No: ${data.invoiceNumber || doc.documentNumber || 'N/A'}`, alignment: 'right' },
        { text: `Date: ${new Date().toLocaleDateString()}`, alignment: 'right', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Description', bold: true },
                { text: 'Qty', bold: true },
                { text: 'N.W (KGS)', bold: true },
                { text: 'G.W (KGS)', bold: true },
                { text: 'CBM', bold: true },
              ],
              ...items.map((item) => [
                item.productName || item.sku,
                item.quantity,
                item.netWeight || '-',
                item.grossWeight || '-',
                item.cbm || '-',
              ]),
            ],
          },
        },
        { text: '\n\nAuthorized Signature', alignment: 'right', margin: [0, 50, 0, 0] },
      ],
      styles: {
        header: { fontSize: 24, bold: true, margin: [0, 0, 0, 10] },
      },
      defaultStyle: { font: 'Helvetica' },
    };
  }
}
