import { useCallback, useState } from 'react';
import { getSession } from 'next-auth/react';
import { notification } from '@/providers/antd-static';

import { sendRequest } from '@/lib/api-client';
import type { IQuotation, IPaginationMeta } from '@/types/o2c';
import { getAccessToken } from '@/lib/auth-token';

interface FetchQuotationsParams {
  current: number;
  pageSize: number;
  search?: string;
}

interface QuotationListResponse {
  results?: IQuotation[];
  result?: IQuotation[];
  total?: number;
  totalPages?: number;
  meta?: {
    total?: number;
    pages?: number;
    current?: number;
    pageSize?: number;
  };
}

export const useQuotations = () => {
  const [data, setData] = useState<IQuotation[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(false);

  const fetchQuotations = useCallback(async (params: FetchQuotationsParams) => {
    setLoading(true);
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<QuotationListResponse>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          populate: 'customer,createdBy',
          ...(params.search ? { quotationNumber: `/${params.search}/i` } : {}),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        const results = res.data.results ?? [];
        const total =
          res.data.total ??
          res.data.meta?.total ??
          (res.data.totalPages ? res.data.totalPages * params.pageSize : results.length);

        setData(results);
        setMeta({
          current: params.current,
          pageSize: params.pageSize,
          total,
        });
      } else {
        notification.error({ 
          title: 'Lỗi tải danh sách báo giá', 
          description: res?.message || 'Không thể kết nối với máy chủ' 
        });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống khi tải báo giá' });
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteQuotation = useCallback(async (id: string, onSuccess?: () => void) => {
    try {
      const session = await getSession();
      const accessToken = getAccessToken(session);

      if (!accessToken) {
        notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
        return;
      }

      const res = await sendRequest<IBackendRes<unknown>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quotations/${id}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ title: 'Xóa báo giá thành công' });
        onSuccess?.();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống khi xóa báo giá' });
    }
  }, []);

  return { data, meta, loading, fetchQuotations, deleteQuotation };
};
