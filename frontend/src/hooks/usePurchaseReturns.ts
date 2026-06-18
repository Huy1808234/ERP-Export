import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { IPurchaseReturn } from '@/types/purchase-return';
import { IPaginationMeta } from '@/types/purchase-order';
import { notification } from '@/providers/antd-static';
import { getAccessToken } from '@/lib/auth-token';

type FetchPurchaseReturnParams = {
  current: number;
  pageSize: number;
  status?: string;
};

type PurchaseReturnAction = 'submit' | 'send' | 'resolve' | 'cancel';

export const usePurchaseReturns = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IPurchaseReturn[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchReturns = useCallback(async (params: FetchPurchaseReturnParams) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IModelPaginate<IPurchaseReturn>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          status: params.status,
          populate: 'purchaseOrder,items.product',
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
  }, [session]);

  const runReturnAction = useCallback(async (
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
    throw new Error(Array.isArray(res?.message) ? res.message.join(', ') : res?.message || 'Action failed');
  }, [session]);

  return { data, meta, loading, fetchReturns, runReturnAction };
};
