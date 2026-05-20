import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '@/modules/products/entities/product.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';
import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import { ProformaInvoice } from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { PurchaseRequest } from '@/modules/purchase-requests/entities/purchase-request.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/entities/purchase-order.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { CommercialInvoice } from '@/modules/commercial-invoices/entities/commercial-invoice.entity';
import { ExportDocument } from '@/modules/export-documents/entities/export-document.entity';
import { AccountReceivable } from '@/modules/account-receivables/entities/account-receivable.entity';
import { AccountPayable } from '@/modules/account-payables/entities/account-payable.entity';

export type GlobalSearchEntityType =
  | 'PRODUCT'
  | 'PARTNER'
  | 'QUOTATION'
  | 'PROFORMA_INVOICE'
  | 'SALES_CONTRACT'
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_ORDER'
  | 'SHIPMENT'
  | 'COMMERCIAL_INVOICE'
  | 'EXPORT_DOCUMENT'
  | 'ACCOUNT_RECEIVABLE'
  | 'ACCOUNT_PAYABLE';

export interface GlobalSearchResult {
  _id: string;
  type: GlobalSearchEntityType;
  title: string;
  subtitle: string | null;
  status: string | null;
  targetHref: string;
  updatedAt: Date | null;
  matchedFields: string[];
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  results: GlobalSearchResult[];
}

interface RawSearchRow {
  _id: string;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  updatedAt: Date | string | null;
}

type SearchProducer = (term: string, perSourceLimit: number) => Promise<GlobalSearchResult[]>;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(ProformaInvoice)
    private readonly piRepository: Repository<ProformaInvoice>,
    @InjectRepository(SalesContract)
    private readonly salesContractRepository: Repository<SalesContract>,
    @InjectRepository(PurchaseRequest)
    private readonly purchaseRequestRepository: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(CommercialInvoice)
    private readonly commercialInvoiceRepository: Repository<CommercialInvoice>,
    @InjectRepository(ExportDocument)
    private readonly exportDocumentRepository: Repository<ExportDocument>,
    @InjectRepository(AccountReceivable)
    private readonly accountReceivableRepository: Repository<AccountReceivable>,
    @InjectRepository(AccountPayable)
    private readonly accountPayableRepository: Repository<AccountPayable>,
  ) {}

  async globalSearch(query: string, limit = 20): Promise<GlobalSearchResponse> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      throw new BadRequestException('Search query must contain at least 2 characters.');
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const perSourceLimit = Math.min(Math.max(Math.ceil(safeLimit / 4), 4), 8);
    const term = this.toLikeTerm(normalizedQuery);
    const producers: SearchProducer[] = [
      this.searchProducts.bind(this),
      this.searchPartners.bind(this),
      this.searchQuotations.bind(this),
      this.searchProformaInvoices.bind(this),
      this.searchSalesContracts.bind(this),
      this.searchPurchaseRequests.bind(this),
      this.searchPurchaseOrders.bind(this),
      this.searchShipments.bind(this),
      this.searchCommercialInvoices.bind(this),
      this.searchExportDocuments.bind(this),
      this.searchAccountReceivables.bind(this),
      this.searchAccountPayables.bind(this),
    ];

    const settledGroups = await Promise.allSettled(
      producers.map((producer) => producer(term, perSourceLimit)),
    );
    const resultGroups = settledGroups.flatMap((group, index) => {
      if (group.status === 'fulfilled') {
        return group.value;
      }

      console.warn(
        `[GlobalSearch] Producer ${index + 1} failed:`,
        group.reason instanceof Error ? group.reason.message : group.reason,
      );
      return [];
    });
    const results = resultGroups
      .sort((left, right) => this.toTime(right.updatedAt) - this.toTime(left.updatedAt))
      .slice(0, safeLimit);

    return {
      query: normalizedQuery,
      total: results.length,
      results,
    };
  }

  private async searchProducts(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.productRepository
      .createQueryBuilder('product')
      .select('product._id', '_id')
      .addSelect('COALESCE("product"."sku", \'\') || \' - \' || COALESCE("product"."vietnameseName", "product"."englishName", \'\')', 'title')
      .addSelect('COALESCE("product"."hsCode", \'\') || CASE WHEN "product"."category" IS NULL THEN \'\' ELSE \' / \' || "product"."category" END', 'subtitle')
      .addSelect('CASE WHEN "product"."isActive" THEN \'ACTIVE\' ELSE \'INACTIVE\' END', 'status')
      .addSelect('product.updatedAt', 'updatedAt')
      .where('"product"."deletedAt" IS NULL')
      .andWhere(
        "(\"product\".\"sku\" ILIKE :term ESCAPE '\\' OR \"product\".\"vietnameseName\" ILIKE :term ESCAPE '\\' OR \"product\".\"englishName\" ILIKE :term ESCAPE '\\' OR \"product\".\"hsCode\" ILIKE :term ESCAPE '\\')",
        { term },
      )
      .orderBy('product.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'PRODUCT', '/dashboard/product', ['sku', 'name', 'hsCode']));
  }

  private async searchPartners(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.partnerRepository
      .createQueryBuilder('partner')
      .select('partner._id', '_id')
      .addSelect('partner.name', 'title')
      .addSelect('COALESCE("partner"."partnerType"::text, \'\') || CASE WHEN "partner"."country" IS NULL THEN \'\' ELSE \' / \' || "partner"."country" END', 'subtitle')
      .addSelect('"partner"."riskLevel"::text', 'status')
      .addSelect('partner.updatedAt', 'updatedAt')
      .where('"partner"."deletedAt" IS NULL')
      .andWhere(
        "(\"partner\".\"name\" ILIKE :term ESCAPE '\\' OR \"partner\".\"country\" ILIKE :term ESCAPE '\\' OR \"partner\".\"contactName\" ILIKE :term ESCAPE '\\' OR \"partner\".\"phone\" ILIKE :term ESCAPE '\\')",
        { term },
      )
      .orderBy('partner.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'PARTNER', '/dashboard/partners', ['name', 'country', 'contact']));
  }

  private async searchQuotations(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoin('quotation.customer', 'customer')
      .select('quotation._id', '_id')
      .addSelect('quotation.quotationNumber', 'title')
      .addSelect('COALESCE("customer"."name", \'\') || CASE WHEN "quotation"."currency" IS NULL THEN \'\' ELSE \' / \' || "quotation"."currency" END', 'subtitle')
      .addSelect('quotation.status::text', 'status')
      .addSelect('quotation.updatedAt', 'updatedAt')
      .where('"quotation"."deletedAt" IS NULL')
      .andWhere("(\"quotation\".\"quotationNumber\" ILIKE :term ESCAPE '\\' OR \"customer\".\"name\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('quotation.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'QUOTATION', '/dashboard/quotation', ['quotationNumber', 'buyer']));
  }

  private async searchProformaInvoices(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.piRepository
      .createQueryBuilder('pi')
      .leftJoin('pi.customer', 'customer')
      .select('pi._id', '_id')
      .addSelect('pi.piNumber', 'title')
      .addSelect('COALESCE("customer"."name", \'\') || CASE WHEN "pi"."currency" IS NULL THEN \'\' ELSE \' / \' || "pi"."currency" END', 'subtitle')
      .addSelect('pi.status::text', 'status')
      .addSelect('pi.updatedAt', 'updatedAt')
      .where('"pi"."deletedAt" IS NULL')
      .andWhere("(\"pi\".\"piNumber\" ILIKE :term ESCAPE '\\' OR \"customer\".\"name\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('pi.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'PROFORMA_INVOICE', '/dashboard/proforma-invoice', ['piNumber', 'buyer']));
  }

  private async searchSalesContracts(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.salesContractRepository
      .createQueryBuilder('contract')
      .leftJoin('contract.buyer', 'buyer')
      .select('contract._id', '_id')
      .addSelect('contract.contractNumber', 'title')
      .addSelect('COALESCE("buyer"."name", \'\') || CASE WHEN "contract"."currencyCode" IS NULL THEN \'\' ELSE \' / \' || "contract"."currencyCode" END', 'subtitle')
      .addSelect('contract.status::text', 'status')
      .addSelect('contract.updatedAt', 'updatedAt')
      .where("\"contract\".\"contractNumber\" ILIKE :term ESCAPE '\\' OR \"buyer\".\"name\" ILIKE :term ESCAPE '\\'", { term })
      .orderBy('contract.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'SALES_CONTRACT', '/dashboard/sales-contract', ['contractNumber', 'buyer']));
  }

  private async searchPurchaseRequests(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.purchaseRequestRepository
      .createQueryBuilder('pr')
      .select('pr._id', '_id')
      .addSelect('pr.prNumber', 'title')
      .addSelect('COALESCE("pr"."department", \'\') || CASE WHEN "pr"."purpose" IS NULL THEN \'\' ELSE \' / \' || "pr"."purpose" END', 'subtitle')
      .addSelect('pr.status::text', 'status')
      .addSelect('pr.updatedAt', 'updatedAt')
      .where('"pr"."deletedAt" IS NULL')
      .andWhere("(\"pr\".\"prNumber\" ILIKE :term ESCAPE '\\' OR \"pr\".\"department\" ILIKE :term ESCAPE '\\' OR \"pr\".\"purpose\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('pr.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'PURCHASE_REQUEST', '/dashboard/purchase-request', ['prNumber', 'department', 'purpose']));
  }

  private async searchPurchaseOrders(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .leftJoin('po.vendor', 'vendor')
      .select('po._id', '_id')
      .addSelect('po.poNumber', 'title')
      .addSelect('COALESCE("vendor"."name", \'\') || CASE WHEN "po"."currency" IS NULL THEN \'\' ELSE \' / \' || "po"."currency" END', 'subtitle')
      .addSelect('po.status::text', 'status')
      .addSelect('po.updatedAt', 'updatedAt')
      .where('"po"."deletedAt" IS NULL')
      .andWhere("(\"po\".\"poNumber\" ILIKE :term ESCAPE '\\' OR \"vendor\".\"name\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('po.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'PURCHASE_ORDER', `/dashboard/purchase-orders?poId=${row._id}&action=detail`, ['poNumber', 'vendor']));
  }

  private async searchShipments(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.shipmentRepository
      .createQueryBuilder('shipment')
      .leftJoin('shipment.salesContract', 'contract')
      .leftJoin('contract.buyer', 'buyer')
      .select('shipment._id', '_id')
      .addSelect('shipment.shipmentNumber', 'title')
      .addSelect('COALESCE("buyer"."name", \'\') || CASE WHEN "shipment"."pol" IS NULL THEN \'\' ELSE \' / \' || "shipment"."pol" END || CASE WHEN "shipment"."pod" IS NULL THEN \'\' ELSE \' -> \' || "shipment"."pod" END', 'subtitle')
      .addSelect('shipment.status::text', 'status')
      .addSelect('shipment.updatedAt', 'updatedAt')
      .where('"shipment"."deletedAt" IS NULL')
      .andWhere(
        "(\"shipment\".\"shipmentNumber\" ILIKE :term ESCAPE '\\' OR \"shipment\".\"blNumber\" ILIKE :term ESCAPE '\\' OR \"shipment\".\"bookingNumber\" ILIKE :term ESCAPE '\\' OR \"buyer\".\"name\" ILIKE :term ESCAPE '\\')",
        { term },
      )
      .orderBy('shipment.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'SHIPMENT', '/dashboard/shipment', ['shipmentNumber', 'bookingNumber', 'buyer']));
  }

  private async searchCommercialInvoices(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.commercialInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.buyer', 'buyer')
      .leftJoin('invoice.salesContract', 'contract')
      .select('invoice._id', '_id')
      .addSelect('invoice.invoiceNumber', 'title')
      .addSelect('COALESCE("buyer"."name", \'\') || CASE WHEN "contract"."contractNumber" IS NULL THEN \'\' ELSE \' / \' || "contract"."contractNumber" END', 'subtitle')
      .addSelect('invoice.status::text', 'status')
      .addSelect('invoice.updatedAt', 'updatedAt')
      .where("(\"invoice\".\"invoiceNumber\" ILIKE :term ESCAPE '\\' OR \"buyer\".\"name\" ILIKE :term ESCAPE '\\' OR \"contract\".\"contractNumber\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('invoice.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'COMMERCIAL_INVOICE', '/dashboard/commercial-invoices', ['invoiceNumber', 'buyer', 'contractNumber']));
  }

  private async searchExportDocuments(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.exportDocumentRepository
      .createQueryBuilder('document')
      .leftJoin('document.shipment', 'shipment')
      .select('document._id', '_id')
      .addSelect('COALESCE("document"."documentNumber", "document"."documentType")', 'title')
      .addSelect('"document"."documentType" || CASE WHEN "shipment"."shipmentNumber" IS NULL THEN \'\' ELSE \' / \' || "shipment"."shipmentNumber" END', 'subtitle')
      .addSelect('"document"."checklistStatus"::text', 'status')
      .addSelect('document.updatedAt', 'updatedAt')
      .where(
        "(\"document\".\"documentNumber\" ILIKE :term ESCAPE '\\' OR \"document\".\"documentType\" ILIKE :term ESCAPE '\\' OR \"document\".\"fileName\" ILIKE :term ESCAPE '\\' OR \"shipment\".\"shipmentNumber\" ILIKE :term ESCAPE '\\')",
        { term },
      )
      .orderBy('document.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'EXPORT_DOCUMENT', '/dashboard/document', ['documentNumber', 'documentType', 'shipment']));
  }

  private async searchAccountReceivables(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.accountReceivableRepository
      .createQueryBuilder('ar')
      .leftJoin('ar.buyer', 'buyer')
      .select('ar._id', '_id')
      .addSelect('ar.invoiceNumber', 'title')
      .addSelect('COALESCE("buyer"."name", \'\') || CASE WHEN "ar"."currency" IS NULL THEN \'\' ELSE \' / \' || "ar"."currency" END', 'subtitle')
      .addSelect('ar.status::text', 'status')
      .addSelect('ar.updatedAt', 'updatedAt')
      .where("(\"ar\".\"invoiceNumber\" ILIKE :term ESCAPE '\\' OR \"buyer\".\"name\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('ar.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'ACCOUNT_RECEIVABLE', '/dashboard/account-receivables', ['invoiceNumber', 'buyer']));
  }

  private async searchAccountPayables(term: string, limit: number): Promise<GlobalSearchResult[]> {
    const rows = await this.accountPayableRepository
      .createQueryBuilder('ap')
      .leftJoin('ap.vendor', 'vendor')
      .select('ap._id', '_id')
      .addSelect('COALESCE("ap"."invoiceNumber", "ap"."invoiceSeries", "ap"."_id")', 'title')
      .addSelect('COALESCE("vendor"."name", \'\') || CASE WHEN "ap"."currency" IS NULL THEN \'\' ELSE \' / \' || "ap"."currency" END', 'subtitle')
      .addSelect('ap.status::text', 'status')
      .addSelect('ap.updatedAt', 'updatedAt')
      .where("(\"ap\".\"invoiceNumber\" ILIKE :term ESCAPE '\\' OR \"ap\".\"invoiceSeries\" ILIKE :term ESCAPE '\\' OR \"vendor\".\"name\" ILIKE :term ESCAPE '\\')", { term })
      .orderBy('ap.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<RawSearchRow>();

    return rows.map((row) => this.toResult(row, 'ACCOUNT_PAYABLE', '/dashboard/account-payables', ['invoiceNumber', 'vendor']));
  }

  private toResult(
    row: RawSearchRow,
    type: GlobalSearchEntityType,
    targetHref: string,
    matchedFields: string[],
  ): GlobalSearchResult {
    return {
      _id: row._id,
      type,
      title: row.title || row._id,
      subtitle: row.subtitle || null,
      status: row.status || null,
      targetHref,
      updatedAt: this.toDate(row.updatedAt),
      matchedFields,
    };
  }

  private toLikeTerm(value: string): string {
    return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
  }

  private toDate(value: Date | string | null): Date | null {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
  }

  private toTime(value: Date | null): number {
    return value ? value.getTime() : 0;
  }
}
