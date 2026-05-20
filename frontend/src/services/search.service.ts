import { getSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import type { IBackendRes } from './base.service';

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
  updatedAt: string | Date | null;
  matchedFields: string[];
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  results: GlobalSearchResult[];
}

interface ProductSearchFallbackItem {
  _id: string;
  sku?: string | null;
  vietnameseName?: string | null;
  englishName?: string | null;
  category?: string | null;
  unitOfMeasure?: string | null;
}

interface ProductSearchFallbackResponse {
  results?: ProductSearchFallbackItem[];
}

class SearchService {
  private readonly baseUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/search`;
  private readonly productBaseUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`;

  async globalSearch(query: string, limit = 12): Promise<IBackendRes<GlobalSearchResponse>> {
    const currentSession = await getSession();
    let response: IBackendRes<GlobalSearchResponse>;

    try {
      response = await sendRequest<IBackendRes<GlobalSearchResponse>>({
        url: `${this.baseUrl}/global`,
        method: 'GET',
        queryParams: { q: query, limit },
        headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
      });
    } catch (error) {
      const productFallback = await this.searchProductsFallback(query, Math.min(limit, 6)).catch(() => []);

      return {
        statusCode: productFallback.length > 0 ? 200 : 503,
        message: productFallback.length > 0 ? 'Global search fallback' : error instanceof Error ? error.message : 'Global search unavailable',
        data: {
          query,
          total: productFallback.length,
          results: productFallback,
        },
      };
    }

    if ((response.data?.results || []).length > 0) {
      return response;
    }

    const productFallback = await this.searchProductsFallback(query, Math.min(limit, 6)).catch(() => []);
    if (productFallback.length === 0) {
      return response;
    }

    return {
      statusCode: 200,
      message: response.message,
      data: {
        query,
        total: productFallback.length,
        results: productFallback,
      },
    };
  }

  private async searchProductsFallback(
    query: string,
    limit: number,
  ): Promise<GlobalSearchResult[]> {
    const response = await sendRequest<IBackendRes<ProductSearchFallbackResponse>>({
      url: `${this.productBaseUrl}/public`,
      method: 'GET',
      queryParams: { search: query, current: 1, pageSize: limit },
    });

    return (response.data?.results || []).map((product) => {
      const displayName = product.vietnameseName || product.englishName;
      const targetSearch = encodeURIComponent(product.sku || displayName || query);

      return {
        _id: product._id,
        type: 'PRODUCT',
        title: displayName ? `${product.sku || product._id} - ${displayName}` : product.sku || product._id,
        subtitle: [product.category, product.unitOfMeasure].filter(Boolean).join(' / ') || null,
        status: null,
        targetHref: `/dashboard/product?search=${targetSearch}`,
        updatedAt: null,
        matchedFields: ['sku', 'name'],
      };
    });
  }
}

export const searchService = new SearchService();
