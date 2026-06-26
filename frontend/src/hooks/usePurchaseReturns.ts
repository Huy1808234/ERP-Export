import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import {
  IPurchaseReturn,
  IPurchaseReturnStats,
  PurchaseReturnStatus,
} from '@/types/purchase-return';
import { IPaginationMeta } from '@/types/purchase-order';
import { notification } from '@/providers/antd-static';
import { getAccessToken } from '@/lib/auth-token';

type FetchPurchaseReturnParams = {
  current: number;
  pageSize: number;
  status?: PurchaseReturnStatus | '';
  search?: string;
  reasonCode?: string;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'createdAt' | 'returnDate' | 'amount';
};

type PurchaseReturnAction = 'submit' | 'send' | 'resolve' | 'cancel';

export const usePurchaseReturns = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IPurchaseReturn[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<IPurchaseReturnStats | null>(null);

  const fetchReturns = useCallback(
    async (params: FetchPurchaseReturnParams) => {
      setLoading(true);
      try {
        const res = await sendRequest<
          IBackendRes<IModelPaginate<IPurchaseReturn>>
        >({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns`,
          method: 'GET',
          queryParams: {
            current: params.current,
            pageSize: params.pageSize,
            status: params.status || undefined,
            search: params.search || undefined,
            reasonCode: params.reasonCode || undefined,
            vendorId: params.vendorId || undefined,
            dateFrom: params.dateFrom || undefined,
            dateTo: params.dateTo || undefined,
            sort: params.sort || 'createdAt',
          },
          headers: { Authorization: `Bearer ${getAccessToken(session)}` },
        });
        if (res?.data) {
          setData(res.data.results || []);
          setMeta({
            current: res.data.meta?.current ?? params.current,
            pageSize: res.data.meta?.pageSize ?? params.pageSize,
            pages: res.data.meta?.pages ?? 0,
            total: res.data.meta?.total ?? 0,
          });
        }
      } catch (error) {
        console.error(error);
        notification.error({ title: 'Lỗi tải danh sách trả hàng' });
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await sendRequest<IBackendRes<IPurchaseReturnStats>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns/stats`,
        method: 'GET',
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });
      if (res?.data) setStats(res.data);
    } catch (error) {
      console.error(error);
    }
  }, [session]);

  const runReturnAction = useCallback(
    async (
      recordId: string,
      action: PurchaseReturnAction,
      body: Record<string, unknown> = {},
    ) => {
      const res = await sendRequest<IBackendRes<IPurchaseReturn>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns/${recordId}/${action}`,
        method: 'PATCH',
        body,
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });

      if (res?.data) {
        return res.data;
      }
      throw new Error(
        Array.isArray(res?.message)
          ? res.message.join(', ')
          : res?.message || 'Action failed',
      );
    },
    [session],
  );

  const fetchOne = useCallback(
    async (recordId: string): Promise<IPurchaseReturn | null> => {
      try {
        const res = await sendRequest<IBackendRes<IPurchaseReturn>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns/${recordId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${getAccessToken(session)}` },
        });
        return res?.data ?? null;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [session],
  );

  const createReturn = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await sendRequest<IBackendRes<IPurchaseReturn>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns`,
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });
      if (res?.data) return res.data;
      throw new Error(
        Array.isArray(res?.message)
          ? res.message.join(', ')
          : res?.message || 'Create failed',
      );
    },
    [session],
  );

  return {
    data,
    meta,
    loading,
    stats,
    fetchReturns,
    fetchStats,
    runReturnAction,
    fetchOne,
    createReturn,
  };
};
