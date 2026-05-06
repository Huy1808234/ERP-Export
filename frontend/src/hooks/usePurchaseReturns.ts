import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IPurchaseReturn } from '@/types/purchase-return';
import { IPaginationMeta } from '@/types/purchase-order';
import { notification } from '@/library/antd.static';

export const usePurchaseReturns = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IPurchaseReturn[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchReturns = useCallback(async (params: any) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-returns`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          populate: 'purchaseOrder,items.product',
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res?.data) {
        setData(res.data.results || []);
        setMeta(res.data.meta);
      }
    } catch (error) {
      notification.error({ title: 'Lỗi tải danh sách trả hàng' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, meta, loading, fetchReturns };
};
