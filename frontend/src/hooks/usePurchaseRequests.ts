import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { IPurchaseRequest } from '@/types/purchase-request';
import { notification } from '@/providers/antd-static';
import { getAccessToken } from '@/lib/auth-token';

interface FetchParams {
  current: number;
  pageSize: number;
  prNumber?: string;
  status?: string;
}

interface IPaginationMeta {
  current: number;
  pageSize: number;
  total: number;
  pages: number;
}

export const usePurchaseRequests = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IPurchaseRequest[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchPRs = useCallback(async (params: FetchParams) => {
    setLoading(true);
    const accessToken = getAccessToken(session);

    try {
      const res = await sendRequest<IBackendRes<IModelPaginate<IPurchaseRequest>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-requests`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          ...(params.prNumber ? { prNumber: `/${params.prNumber}/i` } : {}),
          ...(params.status ? { status: params.status } : {}),
          populate: 'createdBy',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        const results = res.data.results || [];
        setData(results);
        
        if (res.data.meta) {
          setMeta({
            current: res.data.meta.current,
            pageSize: res.data.meta.pageSize,
            total: res.data.meta.total,
            pages: res.data.meta.pages,
          });
        } else if (res.data.totalItems !== undefined) {
          setMeta({
            current: params.current,
            pageSize: params.pageSize,
            total: res.data.totalItems,
            pages: res.data.totalPages || 1,
          });
        }
      }
    } catch (error) {
      notification.error({ title: 'Lỗi tải dữ liệu Purchase Requests' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, meta, loading, fetchPRs };
};
