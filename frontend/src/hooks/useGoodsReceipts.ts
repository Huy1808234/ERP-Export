import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from "@/lib/api-client";
import { IGoodsReceipt } from "@/types/goods-receipt";
import { IPaginationMeta } from "@/types/purchase-order";
import { notification } from '@/providers/antd-static';
import { getAccessToken } from '@/lib/auth-token';

interface FetchParams {
  current: number;
  pageSize: number;
  grnNumber?: string;
  poNumber?: string;
}

export const useGoodsReceipts = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IGoodsReceipt[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchGRNs = useCallback(async (params: FetchParams) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          ...(params.grnNumber ? { grnNumber: `/${params.grnNumber}/i` } : {}),
          populate: 'purchaseOrder,receivedBy',
        },
        headers: { Authorization: `Bearer ${getAccessToken(session)}` },
      });

      if (res?.data) {
        setData(res.data.results ?? []);
        setMeta({
          current: params.current,
          pageSize: params.pageSize,
          total: res.data.meta?.total ?? 0,
          pages: res.data.meta?.pages ?? 0,
        });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi tải dữ liệu Phiếu nhập kho' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, meta, loading, fetchGRNs };
};
