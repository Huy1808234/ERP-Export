import { useCallback, useState } from 'react';
import { getSession } from 'next-auth/react';
import { notification } from '@/library/antd.static';

import { sendRequest } from '@/utils/api';
import type { IShipment, IPaginationMeta } from '@/types/o2c';

interface FetchShipmentsParams {
  current: number;
  pageSize: number;
  search?: string;
  sort?: string;
}

interface SessionTokenShape {
  access_token?: string;
  user?: {
    access_token?: string;
  };
}

const getAccessToken = (session?: any): string | undefined => {
  return session?.access_token ?? session?.user?.access_token;
};

export const useShipments = (session?: any) => {
  const [data, setData] = useState<IShipment[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState({ total: 0, inTransit: 0, closed: 0 });
  const [loading, setLoading] = useState(false);

  const resolveAccessToken = useCallback(async () => {
    const directToken = getAccessToken(session);
    if (directToken) return directToken;

    const currentSession = await getSession();
    return getAccessToken(currentSession as SessionTokenShape | null);
  }, [session]);

  const fetchShipments = useCallback(
    async (params: any) => {
      setLoading(true);
      try {
        const accessToken = await resolveAccessToken();

        if (!accessToken) {
          notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
          return;
        }

        const res = await sendRequest<IBackendRes<IModelPaginate<IShipment>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
          method: 'GET',
          queryParams: {
            current: params.current,
            pageSize: params.pageSize,
            ...(params.sort ? { sort: params.sort } : {}),
            ...(params.search ? { search: params.search } : {}),
            ...params, // Pass other filters like status, pol, pod
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

          if (res?.data) {
            setData(res.data.results ?? []);
            setMeta({
              current: res.data.meta?.current ?? params.current,
              pageSize: res.data.meta?.pageSize ?? params.pageSize,
              total: res.data.meta?.total ?? 0,
            });
          }

          // Fetch Stats
          const statsRes = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/stats`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (statsRes?.data) {
            setStats(statsRes.data);
          }
      } catch (error) {
        notification.error({ title: 'Lỗi tải danh sách lô hàng' });
      } finally {
        setLoading(false);
      }
    },
    [resolveAccessToken]
  );

  const deleteShipment = useCallback(
    async (id: string, onSuccess?: () => void) => {
      try {
        const accessToken = await resolveAccessToken();

        if (!accessToken) {
          notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
          return;
        }

        const res = await sendRequest<IBackendRes<unknown>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${id}`,
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res?.data) {
          notification.success({ title: 'Xóa lô hàng thành công' });
          onSuccess?.();
        } else {
          notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
        }
      } catch (error) {
        notification.error({ title: 'Lỗi hệ thống khi xóa lô hàng' });
      }
    },
    [resolveAccessToken]
  );

  const issueStock = useCallback(
    async (id: string, onSuccess?: () => void) => {
      try {
        const accessToken = await resolveAccessToken();
        if (!accessToken) {
          notification.error({ title: 'Phiên đăng nhập đã hết hạn' });
          return;
        }

        const res = await sendRequest<IBackendRes<unknown>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${id}/issue-stock`,
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res?.data) {
          notification.success({ title: 'Xác nhận xuất kho thành công' });
          onSuccess?.();
        } else {
          notification.error({ title: 'Lỗi xuất kho', description: res?.message });
        }
      } catch (error) {
        notification.error({ title: 'Lỗi hệ thống khi xác nhận xuất kho' });
      }
    },
    [resolveAccessToken]
  );

  return { data, meta, stats, loading, fetchShipments, deleteShipment, issueStock };
};
