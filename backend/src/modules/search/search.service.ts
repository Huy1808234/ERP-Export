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
import { Inquiry } from '@/modules/inquiries/entities/inquiry.entity';
import { PricingPolicy } from '@/modules/pricing-policies/entities/pricing-policy.entity';
import { GoodsReceipt } from '@/modules/goods-receipts/entities/goods-receipt.entity';
import { VendorInvoice } from '@/modules/vendor-invoices/entities/vendor-invoice.entity';
import { PurchaseReturn } from '@/modules/purchase-returns/entities/purchase-return.entity';
import { InventoryCount } from '@/modules/inventory/entities/inventory-count.entity';
import { ExportDelivery } from '@/modules/inventory/entities/export-delivery.entity';
import { CustomerReturn } from '@/modules/inventory/entities/customer-return.entity';
import { LetterOfCredit } from '@/modules/trade-finance/entities/letter-of-credit.entity';
import { CollectionOrder } from '@/modules/trade-finance/entities/collection-order.entity';
import { TradeFinanceTransaction } from '@/modules/trade-finance/entities/trade-finance-transaction.entity';
import { JournalEntry } from '@/modules/accounting/entities/journal-entry.entity';
import { RedisCacheService } from '@/common/cache/redis-cache.service';

const GLOBAL_SEARCH_CACHE_TTL_SECONDS = 30;

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
  | 'ACCOUNT_PAYABLE'
  | 'INQUIRY'
  | 'PRICING_POLICY'
  | 'GOODS_RECEIPT'
  | 'VENDOR_INVOICE'
  | 'PURCHASE_RETURN'
  | 'INVENTORY_COUNT'
  | 'EXPORT_DELIVERY'
  | 'CUSTOMER_RETURN'
  | 'LETTER_OF_CREDIT'
  | 'COLLECTION_ORDER'
  | 'TRADE_FINANCE_TRANSACTION'
  | 'JOURNAL_ENTRY';

export interface GlobalSearchResult {
  _id: string;
  type: GlobalSearchEntityType;
  title: string;
  subtitle: string | null;
  status: string | null;
  targetHref: string;
  updatedAt: string | null;
  matchedFields: string[];
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  results: GlobalSearchResult[];
}

/**
 * Base type for raw SQL query results from search operations.
 * Each search method should map to this with specific fields.
 * Using a stricter approach - no index signature allowed.
 */
interface BaseSearchRow {
  _id: string;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  updatedAt: Date | string | null;
}

/**
 * Extended search row type for searches that return additional fields.
 * E.g., searchExportDocuments returns shipmentId for navigation.
 */
interface ExportDocumentSearchRow extends BaseSearchRow {
  shipmentId: string | null;
}

type SearchProducer = (
  term: string,
  perSourceLimit: number,
) => Promise<GlobalSearchResult[]>;

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
    @InjectRepository(Inquiry)
    private readonly inquiryRepository: Repository<Inquiry>,
    @InjectRepository(PricingPolicy)
    private readonly pricingPolicyRepository: Repository<PricingPolicy>,
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepository: Repository<GoodsReceipt>,
    @InjectRepository(VendorInvoice)
    private readonly vendorInvoiceRepository: Repository<VendorInvoice>,
    @InjectRepository(PurchaseReturn)
    private readonly purchaseReturnRepository: Repository<PurchaseReturn>,
    @InjectRepository(InventoryCount)
    private readonly inventoryCountRepository: Repository<InventoryCount>,
    @InjectRepository(ExportDelivery)
    private readonly exportDeliveryRepository: Repository<ExportDelivery>,
    @InjectRepository(CustomerReturn)
    private readonly customerReturnRepository: Repository<CustomerReturn>,
    @InjectRepository(LetterOfCredit)
    private readonly letterOfCreditRepository: Repository<LetterOfCredit>,
    @InjectRepository(CollectionOrder)
    private readonly collectionOrderRepository: Repository<CollectionOrder>,
    @InjectRepository(TradeFinanceTransaction)
    private readonly tradeFinanceTransactionRepository: Repository<TradeFinanceTransaction>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    private readonly cache: RedisCacheService,
  ) {}

  async globalSearch(query: string, limit = 20): Promise<GlobalSearchResponse> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      throw new BadRequestException(
        'Search query must contain at least 2 characters.',
      );
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const cacheKey = this.cache.makeKey('search:global', {
      query: normalizedQuery,
      limit: safeLimit,
    });

    return this.cache.getOrSet(
      cacheKey,
      GLOBAL_SEARCH_CACHE_TTL_SECONDS,
      async () => {
        const perSourceLimit = Math.min(
          Math.max(Math.ceil(safeLimit / 4), 4),
          8,
        );
        const term = this.toLikeTerm(normalizedQuery);
        const producers: SearchProducer[] = [
          this.searchProducts.bind(this),
          this.searchPartners.bind(this),
          this.searchInquiries.bind(this),
          this.searchQuotations.bind(this),
          this.searchPricingPolicies.bind(this),
          this.searchProformaInvoices.bind(this),
          this.searchSalesContracts.bind(this),
          this.searchPurchaseRequests.bind(this),
          this.searchPurchaseOrders.bind(this),
          this.searchGoodsReceipts.bind(this),
          this.searchVendorInvoices.bind(this),
          this.searchPurchaseReturns.bind(this),
          this.searchShipments.bind(this),
          this.searchCommercialInvoices.bind(this),
          this.searchExportDocuments.bind(this),
          this.searchInventoryCounts.bind(this),
          this.searchExportDeliveries.bind(this),
          this.searchCustomerReturns.bind(this),
          this.searchLettersOfCredit.bind(this),
          this.searchCollectionOrders.bind(this),
          this.searchTradeFinanceTransactions.bind(this),
          this.searchAccountReceivables.bind(this),
          this.searchAccountPayables.bind(this),
          this.searchJournalEntries.bind(this),
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
          .sort(
            (left, right) =>
              this.toTime(right.updatedAt) - this.toTime(left.updatedAt),
          )
          .slice(0, safeLimit);

        return {
          query: normalizedQuery,
          total: results.length,
          results,
        };
      },
    );
  }

  private async searchProducts(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.productRepository
      .createQueryBuilder('product')
      .select('product._id', '_id')
      .addSelect(
        'COALESCE("product"."sku", \'\') || \' - \' || COALESCE("product"."vietnameseName", "product"."englishName", \'\')',
        'title',
      )
      .addSelect(
        'COALESCE("product"."hsCode", \'\') || CASE WHEN "product"."category" IS NULL THEN \'\' ELSE \' / \' || "product"."category" END',
        'subtitle',
      )
      .addSelect(
        'CASE WHEN "product"."isActive" THEN \'ACTIVE\' ELSE \'INACTIVE\' END',
        'status',
      )
      .addSelect('product.updatedAt', 'updatedAt')
      .where('"product"."deletedAt" IS NULL')
      .andWhere(
        '("product"."sku" ILIKE :term ESCAPE \'\\\' OR "product"."vietnameseName" ILIKE :term ESCAPE \'\\\' OR "product"."englishName" ILIKE :term ESCAPE \'\\\' OR "product"."hsCode" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('product.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'PRODUCT', '/dashboard/product', [
        'sku',
        'name',
        'hsCode',
      ]),
    );
  }

  private async searchPartners(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.partnerRepository
      .createQueryBuilder('partner')
      .select('partner._id', '_id')
      .addSelect('partner.name', 'title')
      .addSelect(
        'COALESCE("partner"."partnerType"::text, \'\') || CASE WHEN "partner"."country" IS NULL THEN \'\' ELSE \' / \' || "partner"."country" END',
        'subtitle',
      )
      .addSelect('"partner"."riskLevel"::text', 'status')
      .addSelect('partner.updatedAt', 'updatedAt')
      .where('"partner"."deletedAt" IS NULL')
      .andWhere(
        '("partner"."name" ILIKE :term ESCAPE \'\\\' OR "partner"."country" ILIKE :term ESCAPE \'\\\' OR "partner"."contactName" ILIKE :term ESCAPE \'\\\' OR "partner"."phone" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('partner.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'PARTNER', '/dashboard/partners', [
        'name',
        'country',
        'contact',
      ]),
    );
  }

  private async searchInquiries(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.inquiryRepository
      .createQueryBuilder('inquiry')
      .leftJoin('inquiry.product', 'product')
      .select('inquiry._id', '_id')
      .addSelect(
        'COALESCE("inquiry"."productSnapshotCode", "product"."sku", "inquiry"."_id")',
        'title',
      )
      .addSelect(
        'COALESCE("inquiry"."customerName", \'\') || CASE WHEN "inquiry"."productSnapshotName" IS NULL THEN \'\' ELSE \' / \' || "inquiry"."productSnapshotName" END',
        'subtitle',
      )
      .addSelect('inquiry.status::text', 'status')
      .addSelect('inquiry.updatedAt', 'updatedAt')
      .where('"inquiry"."deletedAt" IS NULL')
      .andWhere(
        '("inquiry"."customerName" ILIKE :term ESCAPE \'\\\' OR "inquiry"."customerEmail" ILIKE :term ESCAPE \'\\\' OR "inquiry"."customerPhone" ILIKE :term ESCAPE \'\\\' OR "inquiry"."productSnapshotName" ILIKE :term ESCAPE \'\\\' OR "inquiry"."productSnapshotCode" ILIKE :term ESCAPE \'\\\' OR "product"."sku" ILIKE :term ESCAPE \'\\\' OR "product"."vietnameseName" ILIKE :term ESCAPE \'\\\' OR "product"."englishName" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('inquiry.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'INQUIRY', '/dashboard/inquiry', [
        'customer',
        'product',
        'sku',
      ]),
    );
  }

  private async searchQuotations(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoin('quotation.customer', 'customer')
      .select('quotation._id', '_id')
      .addSelect('quotation.quotationNumber', 'title')
      .addSelect(
        'COALESCE("customer"."name", \'\') || CASE WHEN "quotation"."currency" IS NULL THEN \'\' ELSE \' / \' || "quotation"."currency" END',
        'subtitle',
      )
      .addSelect('quotation.status::text', 'status')
      .addSelect('quotation.updatedAt', 'updatedAt')
      .where('"quotation"."deletedAt" IS NULL')
      .andWhere(
        '("quotation"."quotationNumber" ILIKE :term ESCAPE \'\\\' OR "customer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('quotation.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'QUOTATION', '/dashboard/quotation', [
        'quotationNumber',
        'buyer',
      ]),
    );
  }

  private async searchPricingPolicies(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.pricingPolicyRepository
      .createQueryBuilder('policy')
      .leftJoin('policy.product', 'product')
      .leftJoin('policy.buyer', 'buyer')
      .select('policy._id', '_id')
      .addSelect(
        'COALESCE("product"."sku", "policy"."_id") || CASE WHEN "policy"."incoterm" IS NULL THEN \'\' ELSE \' / \' || "policy"."incoterm"::text END',
        'title',
      )
      .addSelect(
        'COALESCE("buyer"."name", "policy"."marketRegion"::text, "policy"."country", \'\') || CASE WHEN "policy"."currency" IS NULL THEN \'\' ELSE \' / \' || "policy"."currency" END',
        'subtitle',
      )
      .addSelect(
        'CASE WHEN "policy"."isActive" THEN \'ACTIVE\' ELSE \'INACTIVE\' END',
        'status',
      )
      .addSelect('policy.updatedAt', 'updatedAt')
      .where(
        '("product"."sku" ILIKE :term ESCAPE \'\\\' OR "product"."vietnameseName" ILIKE :term ESCAPE \'\\\' OR "product"."englishName" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\' OR "policy"."country" ILIKE :term ESCAPE \'\\\' OR "policy"."incoterm"::text ILIKE :term ESCAPE \'\\\' OR "policy"."currency" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('policy.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'PRICING_POLICY', '/dashboard/pricing-policies', [
        'product',
        'buyer',
        'incoterm',
        'currency',
      ]),
    );
  }

  private async searchProformaInvoices(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.piRepository
      .createQueryBuilder('pi')
      .leftJoin('pi.customer', 'customer')
      .select('pi._id', '_id')
      .addSelect('pi.piNumber', 'title')
      .addSelect(
        'COALESCE("customer"."name", \'\') || CASE WHEN "pi"."currency" IS NULL THEN \'\' ELSE \' / \' || "pi"."currency" END',
        'subtitle',
      )
      .addSelect('pi.status::text', 'status')
      .addSelect('pi.updatedAt', 'updatedAt')
      .where('"pi"."deletedAt" IS NULL')
      .andWhere(
        '("pi"."piNumber" ILIKE :term ESCAPE \'\\\' OR "customer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('pi.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'PROFORMA_INVOICE', '/dashboard/proforma-invoice', [
        'piNumber',
        'buyer',
      ]),
    );
  }

  private async searchSalesContracts(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.salesContractRepository
      .createQueryBuilder('contract')
      .leftJoin('contract.buyer', 'buyer')
      .select('contract._id', '_id')
      .addSelect('contract.contractNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "contract"."currencyCode" IS NULL THEN \'\' ELSE \' / \' || "contract"."currencyCode" END',
        'subtitle',
      )
      .addSelect('contract.status::text', 'status')
      .addSelect('contract.updatedAt', 'updatedAt')
      .where(
        '"contract"."contractNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\'',
        { term },
      )
      .orderBy('contract.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'SALES_CONTRACT', `/dashboard/sales-contract?id=${row._id}`, [
        'contractNumber',
        'buyer',
      ]),
    );
  }

  private async searchPurchaseRequests(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.purchaseRequestRepository
      .createQueryBuilder('pr')
      .select('pr._id', '_id')
      .addSelect('pr.prNumber', 'title')
      .addSelect(
        'COALESCE("pr"."department", \'\') || CASE WHEN "pr"."purpose" IS NULL THEN \'\' ELSE \' / \' || "pr"."purpose" END',
        'subtitle',
      )
      .addSelect('pr.status::text', 'status')
      .addSelect('pr.updatedAt', 'updatedAt')
      .where('"pr"."deletedAt" IS NULL')
      .andWhere(
        '("pr"."prNumber" ILIKE :term ESCAPE \'\\\' OR "pr"."department" ILIKE :term ESCAPE \'\\\' OR "pr"."purpose" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('pr.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'PURCHASE_REQUEST', '/dashboard/purchase-request', [
        'prNumber',
        'department',
        'purpose',
      ]),
    );
  }

  private async searchPurchaseOrders(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .leftJoin('po.vendor', 'vendor')
      .select('po._id', '_id')
      .addSelect('po.poNumber', 'title')
      .addSelect(
        'COALESCE("vendor"."name", \'\') || CASE WHEN "po"."currency" IS NULL THEN \'\' ELSE \' / \' || "po"."currency" END',
        'subtitle',
      )
      .addSelect('po.status::text', 'status')
      .addSelect('po.updatedAt', 'updatedAt')
      .where('"po"."deletedAt" IS NULL')
      .andWhere(
        '("po"."poNumber" ILIKE :term ESCAPE \'\\\' OR "vendor"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('po.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(
        row,
        'PURCHASE_ORDER',
        `/dashboard/purchase-orders?poId=${row._id}&action=detail`,
        ['poNumber', 'vendor'],
      ),
    );
  }

  private async searchGoodsReceipts(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.goodsReceiptRepository
      .createQueryBuilder('gr')
      .leftJoin('gr.purchaseOrder', 'po')
      .leftJoin('po.vendor', 'vendor')
      .select('gr._id', '_id')
      .addSelect('gr.grNumber', 'title')
      .addSelect(
        'COALESCE("vendor"."name", \'\') || CASE WHEN "po"."poNumber" IS NULL THEN \'\' ELSE \' / \' || "po"."poNumber" END',
        'subtitle',
      )
      .addSelect('gr.status', 'status')
      .addSelect('gr.updatedAt', 'updatedAt')
      .where(
        '("gr"."grNumber" ILIKE :term ESCAPE \'\\\' OR "gr"."deliveryNoteNumber" ILIKE :term ESCAPE \'\\\' OR "gr"."warehouseName" ILIKE :term ESCAPE \'\\\' OR "po"."poNumber" ILIKE :term ESCAPE \'\\\' OR "vendor"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('gr.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'GOODS_RECEIPT', `/dashboard/goods-receipt?id=${row._id}`, [
        'grNumber',
        'deliveryNote',
        'poNumber',
        'vendor',
      ]),
    );
  }

  private async searchVendorInvoices(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.vendorInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.vendor', 'vendor')
      .leftJoin('invoice.purchaseOrder', 'po')
      .select('invoice._id', '_id')
      .addSelect(
        'COALESCE("invoice"."invoiceNumber", "invoice"."invoiceSeries", "invoice"."_id")',
        'title',
      )
      .addSelect(
        'COALESCE("vendor"."name", \'\') || CASE WHEN "po"."poNumber" IS NULL THEN \'\' ELSE \' / \' || "po"."poNumber" END',
        'subtitle',
      )
      .addSelect('invoice.status::text', 'status')
      .addSelect('invoice.updatedAt', 'updatedAt')
      .where(
        '("invoice"."invoiceNumber" ILIKE :term ESCAPE \'\\\' OR "invoice"."invoiceSeries" ILIKE :term ESCAPE \'\\\' OR "po"."poNumber" ILIKE :term ESCAPE \'\\\' OR "vendor"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('invoice.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'VENDOR_INVOICE', '/dashboard/vendor-invoice', [
        'invoiceNumber',
        'invoiceSeries',
        'poNumber',
        'vendor',
      ]),
    );
  }

  private async searchPurchaseReturns(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.purchaseReturnRepository
      .createQueryBuilder('return_doc')
      .leftJoin('return_doc.purchaseOrder', 'po')
      .leftJoin('po.vendor', 'vendor')
      .select('return_doc._id', '_id')
      .addSelect('return_doc.returnNumber', 'title')
      .addSelect(
        'COALESCE("vendor"."name", \'\') || CASE WHEN "return_doc"."claimNumber" IS NULL THEN \'\' ELSE \' / \' || "return_doc"."claimNumber" END',
        'subtitle',
      )
      .addSelect('return_doc.status::text', 'status')
      .addSelect('return_doc.updatedAt', 'updatedAt')
      .where(
        '("return_doc"."returnNumber" ILIKE :term ESCAPE \'\\\' OR "return_doc"."claimNumber" ILIKE :term ESCAPE \'\\\' OR "return_doc"."reason" ILIKE :term ESCAPE \'\\\' OR "po"."poNumber" ILIKE :term ESCAPE \'\\\' OR "vendor"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('return_doc.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'PURCHASE_RETURN', '/dashboard/purchase-return', [
        'returnNumber',
        'claimNumber',
        'reason',
        'vendor',
      ]),
    );
  }

  private async searchShipments(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.shipmentRepository
      .createQueryBuilder('shipment')
      .leftJoin('shipment.salesContract', 'contract')
      .leftJoin('contract.buyer', 'buyer')
      .select('shipment._id', '_id')
      .addSelect('shipment.shipmentNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "shipment"."pol" IS NULL THEN \'\' ELSE \' / \' || "shipment"."pol" END || CASE WHEN "shipment"."pod" IS NULL THEN \'\' ELSE \' -> \' || "shipment"."pod" END',
        'subtitle',
      )
      .addSelect('shipment.status::text', 'status')
      .addSelect('shipment.updatedAt', 'updatedAt')
      .where('"shipment"."deletedAt" IS NULL')
      .andWhere(
        '("shipment"."shipmentNumber" ILIKE :term ESCAPE \'\\\' OR "shipment"."blNumber" ILIKE :term ESCAPE \'\\\' OR "shipment"."bookingNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('shipment.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'SHIPMENT', '/dashboard/shipment', [
        'shipmentNumber',
        'bookingNumber',
        'buyer',
      ]),
    );
  }

  private async searchCommercialInvoices(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.commercialInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.buyer', 'buyer')
      .leftJoin('invoice.salesContract', 'contract')
      .select('invoice._id', '_id')
      .addSelect('invoice.invoiceNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "contract"."contractNumber" IS NULL THEN \'\' ELSE \' / \' || "contract"."contractNumber" END',
        'subtitle',
      )
      .addSelect('invoice.status::text', 'status')
      .addSelect('invoice.updatedAt', 'updatedAt')
      .where(
        '("invoice"."invoiceNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\' OR "contract"."contractNumber" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('invoice.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(
        row,
        'COMMERCIAL_INVOICE',
        '/dashboard/commercial-invoices',
        ['invoiceNumber', 'buyer', 'contractNumber'],
      ),
    );
  }

  private async searchExportDocuments(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.exportDocumentRepository
      .createQueryBuilder('document')
      .leftJoin('document.shipment', 'shipment')
      .select('document._id', '_id')
      .addSelect('shipment._id', 'shipmentId')
      .addSelect(
        'COALESCE("document"."documentNumber", "document"."documentType")',
        'title',
      )
      .addSelect(
        '"document"."documentType" || CASE WHEN "shipment"."shipmentNumber" IS NULL THEN \'\' ELSE \' / \' || "shipment"."shipmentNumber" END',
        'subtitle',
      )
      .addSelect('"document"."checklistStatus"::text', 'status')
      .addSelect('document.updatedAt', 'updatedAt')
      .where(
        '("document"."documentNumber" ILIKE :term ESCAPE \'\\\' OR "document"."documentType" ILIKE :term ESCAPE \'\\\' OR "document"."fileName" ILIKE :term ESCAPE \'\\\' OR "shipment"."shipmentNumber" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('document.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<ExportDocumentSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'EXPORT_DOCUMENT', `/dashboard/document?id=${row.shipmentId ?? ''}`, [
        'documentNumber',
        'documentType',
        'shipment',
      ]),
    );
  }

  private async searchInventoryCounts(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.inventoryCountRepository
      .createQueryBuilder('count')
      .select('count._id', '_id')
      .addSelect('count.countNumber', 'title')
      .addSelect(
        'COALESCE("count"."warehouseName", \'\') || CASE WHEN "count"."createdByUsername" IS NULL THEN \'\' ELSE \' / \' || "count"."createdByUsername" END',
        'subtitle',
      )
      .addSelect('count.status::text', 'status')
      .addSelect('count.updatedAt', 'updatedAt')
      .where(
        '("count"."countNumber" ILIKE :term ESCAPE \'\\\' OR "count"."warehouseName" ILIKE :term ESCAPE \'\\\' OR "count"."createdByUsername" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('count.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'INVENTORY_COUNT', '/dashboard/inventory/counts', [
        'countNumber',
        'warehouse',
        'createdBy',
      ]),
    );
  }

  private async searchExportDeliveries(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.exportDeliveryRepository
      .createQueryBuilder('delivery')
      .leftJoin('delivery.shipment', 'shipment')
      .leftJoin('delivery.salesContract', 'contract')
      .leftJoin('delivery.buyer', 'buyer')
      .select('delivery._id', '_id')
      .addSelect('delivery.deliveryNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "shipment"."shipmentNumber" IS NULL THEN \'\' ELSE \' / \' || "shipment"."shipmentNumber" END',
        'subtitle',
      )
      .addSelect('delivery.status::text', 'status')
      .addSelect('delivery.updatedAt', 'updatedAt')
      .where(
        '("delivery"."deliveryNumber" ILIKE :term ESCAPE \'\\\' OR "shipment"."shipmentNumber" ILIKE :term ESCAPE \'\\\' OR "contract"."contractNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('delivery.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(
        row,
        'EXPORT_DELIVERY',
        '/dashboard/inventory/export-deliveries',
        ['deliveryNumber', 'shipment', 'buyer'],
      ),
    );
  }

  private async searchCustomerReturns(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.customerReturnRepository
      .createQueryBuilder('return_doc')
      .leftJoin('return_doc.buyer', 'buyer')
      .leftJoin('return_doc.shipment', 'shipment')
      .leftJoin('return_doc.salesContract', 'contract')
      .select('return_doc._id', '_id')
      .addSelect('return_doc.returnNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "return_doc"."reason" IS NULL THEN \'\' ELSE \' / \' || "return_doc"."reason"::text END',
        'subtitle',
      )
      .addSelect('return_doc.status::text', 'status')
      .addSelect('return_doc.updatedAt', 'updatedAt')
      .where(
        '("return_doc"."returnNumber" ILIKE :term ESCAPE \'\\\' OR "return_doc"."reason"::text ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\' OR "shipment"."shipmentNumber" ILIKE :term ESCAPE \'\\\' OR "contract"."contractNumber" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('return_doc.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'CUSTOMER_RETURN', '/dashboard/inventory/returns', [
        'returnNumber',
        'buyer',
        'shipment',
        'reason',
      ]),
    );
  }

  private async searchLettersOfCredit(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.letterOfCreditRepository
      .createQueryBuilder('lc')
      .leftJoin('lc.salesContract', 'contract')
      .leftJoin('contract.buyer', 'buyer')
      .select('lc._id', '_id')
      .addSelect('lc.lcNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "lc"."issuingBank" IS NULL THEN \'\' ELSE \' / \' || "lc"."issuingBank" END',
        'subtitle',
      )
      .addSelect('lc.status::text', 'status')
      .addSelect('lc.updatedAt', 'updatedAt')
      .where('"lc"."deletedAt" IS NULL')
      .andWhere(
        '("lc"."lcNumber" ILIKE :term ESCAPE \'\\\' OR "lc"."issuingBank" ILIKE :term ESCAPE \'\\\' OR "lc"."advisingBank" ILIKE :term ESCAPE \'\\\' OR "contract"."contractNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('lc.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'LETTER_OF_CREDIT', '/dashboard/finance/lc', [
        'lcNumber',
        'bank',
        'contract',
        'buyer',
      ]),
    );
  }

  private async searchCollectionOrders(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.collectionOrderRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.salesContract', 'contract')
      .leftJoin('contract.buyer', 'buyer')
      .select('collection._id', '_id')
      .addSelect('collection.orderNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "collection"."type" IS NULL THEN \'\' ELSE \' / \' || "collection"."type"::text END',
        'subtitle',
      )
      .addSelect('collection.status::text', 'status')
      .addSelect('collection.updatedAt', 'updatedAt')
      .where(
        '("collection"."orderNumber" ILIKE :term ESCAPE \'\\\' OR "collection"."type"::text ILIKE :term ESCAPE \'\\\' OR "collection"."remittingBank" ILIKE :term ESCAPE \'\\\' OR "collection"."collectingBank" ILIKE :term ESCAPE \'\\\' OR "contract"."contractNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('collection.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'COLLECTION_ORDER', '/dashboard/finance/collections', [
        'orderNumber',
        'type',
        'bank',
        'contract',
        'buyer',
      ]),
    );
  }

  private async searchTradeFinanceTransactions(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.tradeFinanceTransactionRepository
      .createQueryBuilder('tf')
      .leftJoin('tf.salesContract', 'contract')
      .leftJoin('contract.buyer', 'buyer')
      .leftJoin('tf.vendorInvoice', 'vendor_invoice')
      .leftJoin('vendor_invoice.vendor', 'vendor')
      .select('tf._id', '_id')
      .addSelect('COALESCE("tf"."bankReference", "tf"."_id")', 'title')
      .addSelect(
        'COALESCE("buyer"."name", "vendor"."name", \'\') || CASE WHEN "tf"."type" IS NULL THEN \'\' ELSE \' / \' || "tf"."type"::text END',
        'subtitle',
      )
      .addSelect('tf.status::text', 'status')
      .addSelect('tf.updatedAt', 'updatedAt')
      .where('"tf"."deletedAt" IS NULL')
      .andWhere(
        '("tf"."bankReference" ILIKE :term ESCAPE \'\\\' OR "tf"."type"::text ILIKE :term ESCAPE \'\\\' OR "tf"."currency" ILIKE :term ESCAPE \'\\\' OR "contract"."contractNumber" ILIKE :term ESCAPE \'\\\' OR "vendor_invoice"."invoiceNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\' OR "vendor"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('tf.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(
        row,
        'TRADE_FINANCE_TRANSACTION',
        '/dashboard/finance/general',
        ['bankReference', 'type', 'contract', 'invoice', 'partner'],
      ),
    );
  }

  private async searchAccountReceivables(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.accountReceivableRepository
      .createQueryBuilder('ar')
      .leftJoin('ar.buyer', 'buyer')
      .select('ar._id', '_id')
      .addSelect('ar.invoiceNumber', 'title')
      .addSelect(
        'COALESCE("buyer"."name", \'\') || CASE WHEN "ar"."currency" IS NULL THEN \'\' ELSE \' / \' || "ar"."currency" END',
        'subtitle',
      )
      .addSelect('ar.status::text', 'status')
      .addSelect('ar.updatedAt', 'updatedAt')
      .where(
        '("ar"."invoiceNumber" ILIKE :term ESCAPE \'\\\' OR "buyer"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('ar.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(
        row,
        'ACCOUNT_RECEIVABLE',
        '/dashboard/account-receivables',
        ['invoiceNumber', 'buyer'],
      ),
    );
  }

  private async searchAccountPayables(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.accountPayableRepository
      .createQueryBuilder('ap')
      .leftJoin('ap.vendor', 'vendor')
      .select('ap._id', '_id')
      .addSelect(
        'COALESCE("ap"."invoiceNumber", "ap"."invoiceSeries", "ap"."_id")',
        'title',
      )
      .addSelect(
        'COALESCE("vendor"."name", \'\') || CASE WHEN "ap"."currency" IS NULL THEN \'\' ELSE \' / \' || "ap"."currency" END',
        'subtitle',
      )
      .addSelect('ap.status::text', 'status')
      .addSelect('ap.updatedAt', 'updatedAt')
      .where(
        '("ap"."invoiceNumber" ILIKE :term ESCAPE \'\\\' OR "ap"."invoiceSeries" ILIKE :term ESCAPE \'\\\' OR "vendor"."name" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('ap.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'ACCOUNT_PAYABLE', '/dashboard/account-payables', [
        'invoiceNumber',
        'vendor',
      ]),
    );
  }

  private async searchJournalEntries(
    term: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const rows = await this.journalEntryRepository
      .createQueryBuilder('journal')
      .select('journal._id', '_id')
      .addSelect('journal.entryNumber', 'title')
      .addSelect(
        'COALESCE("journal"."description", \'\') || CASE WHEN "journal"."referenceType" IS NULL THEN \'\' ELSE \' / \' || "journal"."referenceType" END',
        'subtitle',
      )
      .addSelect('journal.status::text', 'status')
      .addSelect('journal.updatedAt', 'updatedAt')
      .where('"journal"."deletedAt" IS NULL')
      .andWhere(
        '("journal"."entryNumber" ILIKE :term ESCAPE \'\\\' OR "journal"."description" ILIKE :term ESCAPE \'\\\' OR "journal"."referenceType" ILIKE :term ESCAPE \'\\\' OR "journal"."referenceId" ILIKE :term ESCAPE \'\\\' OR "journal"."createdByUsername" ILIKE :term ESCAPE \'\\\')',
        { term },
      )
      .orderBy('journal.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<BaseSearchRow>();

    return rows.map((row) =>
      this.toResult(row, 'JOURNAL_ENTRY', '/dashboard/accounting', [
        'entryNumber',
        'description',
        'reference',
      ]),
    );
  }

  private toResult(
    row: BaseSearchRow,
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
      updatedAt: this.toIsoString(row.updatedAt),
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

  private toIsoString(value: Date | string | null): string | null {
    const date = this.toDate(value);
    return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  private toTime(value: string | null): number {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }
}
