import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IPurchaseOrder, IPaginationMeta } from '@/types/purchase-order';
import { notification } from '@/library/antd.static';

interface FetchParams {
  current: number;
  pageSize: number;
  poNumber?: string;
  status?: string;
}

export const usePurchaseOrders = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IPurchaseOrder[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  const [stats, setStats] = useState({ total: 0, pending: 0, value: 0 });

  const fetchPOs = useCallback(async (params: FetchParams) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          ...(params.poNumber ? { poNumber: `/${params.poNumber}/i` } : {}),
          ...(params.status ? { status: params.status } : {}),
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
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
      notification.error({ title: 'Lỗi tải dữ liệu Purchase Orders' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/stats`,
        method: 'GET',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res?.data) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch PO stats');
    }
  }, [session]);

  const deletePO = useCallback(async (id: string, onSuccess: () => void) => {
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${id}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res?.data) {
        notification.success({ title: 'Xóa đơn mua hàng thành công' });
        onSuccess();
      } else {
        notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống khi xóa PO' });
    }
  }, [session]);

  const sendPO = useCallback(async (id: string, onSuccess: () => void) => {
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/purchase-orders/${id}/send`,
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res?.data) {
        notification.success({ title: 'Đã gửi đơn hàng cho nhà cung cấp' });
        onSuccess();
      } else {
        notification.error({ title: 'Gửi PO thất bại', description: res?.message });
      }
    } catch (error) {
      notification.error({ title: 'Lỗi hệ thống khi gửi PO' });
    }
  }, [session]);

  return { data, meta, loading, fetchPOs, deletePO, stats, fetchStats, sendPO };
};
