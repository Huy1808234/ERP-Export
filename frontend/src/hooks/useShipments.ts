import { useCallback, useState } from 'react';
import { notification } from '@/providers/antd-static';

import { sendRequest } from '@/lib/api-client';
import type { IShipment, IPaginationMeta } from '@/types/o2c';

interface FetchShipmentsParams {
  current: number;
  pageSize: number;
  search?: string;
  sort?: string;
}

type ShipmentStats = {
  total: number;
  inTransit: number;
  closed: number;
};

export const useShipments = () => {
  const [data, setData] = useState<IShipment[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState({ total: 0, inTransit: 0, closed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShipments = useCallback(
    async (params: FetchShipmentsParams & Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const { current, pageSize, sort, search, ...filters } = params;

        const res = await sendRequest<IBackendRes<IModelPaginate<IShipment>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments`,
          method: 'GET',
          queryParams: {
            current,
            pageSize,
            ...(sort ? { sort } : {}),
            ...(search ? { search } : {}),
            ...filters,
          },
        });

          if (res?.data) {
            setData(res.data.results ?? []);
            setMeta({
              current: res.data.meta?.current ?? current,
              pageSize: res.data.meta?.pageSize ?? pageSize,
              total: res.data.meta?.total ?? 0,
            });
          }

          // Fetch Stats
          const statsRes = await sendRequest<IBackendRes<ShipmentStats>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/stats`,
            method: 'GET',
          });
          if (statsRes?.data) {
            setStats(statsRes.data);
          }
      } catch {
        setError('Khong the tai danh sach lo hang');
        notification.error({ title: 'Lỗi tải danh sách lô hàng' });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteShipment = useCallback(
    async (id: string, onSuccess?: () => void) => {
      try {
        const res = await sendRequest<IBackendRes<unknown>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${id}`,
          method: 'DELETE',
        });


        if (res?.data) {
          notification.success({ title: 'Xóa lô hàng thành công' });
          onSuccess?.();
        } else {
          notification.error({ title: 'Có lỗi xảy ra', description: res?.message });
        }
      } catch {
        notification.error({ title: 'Lỗi hệ thống khi xóa lô hàng' });
      }
    },
    []
  );

  const issueStock = useCallback(
    async (id: string, onSuccess?: () => void) => {
      try {
        const draftRes = await sendRequest<IBackendRes<{ _id: string; deliveryNumber?: string }>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/export-deliveries/from-shipment/${id}`,
          method: 'POST',
        });

        if (!draftRes?.data?._id) {
          notification.error({ title: 'Loi xuat kho', description: draftRes?.message });
          return;
        }

        const res = await sendRequest<IBackendRes<{ deliveryNumber?: string }>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/export-deliveries/${draftRes.data._id}/issue`,
          method: 'PATCH',
        });

        if (res?.data) {
          notification.success({
            title: 'Xac nhan xuat kho thanh cong',
            description: res.data.deliveryNumber
              ? `Da issue phieu xuat kho ${res.data.deliveryNumber}`
              : undefined,
          });
          onSuccess?.();
        } else {
          notification.error({ title: 'Loi xuat kho', description: res?.message });
        }
      } catch {
        notification.error({ title: 'Lỗi hệ thống khi xác nhận xuất kho' });
      }
    },
    []
  );

  return { data, meta, stats, loading, error, fetchShipments, deleteShipment, issueStock };
};
