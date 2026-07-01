import { useCallback, useState } from 'react';
import { notification } from '@/providers/antd-static';

import { sendRequest } from '@/lib/api-client';
import type { IShipment, IPaginationMeta, ShipmentStatus } from '@/types/o2c';

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
  delayed: number;
  statusCounts: Record<ShipmentStatus, number>;
};

const defaultStatusCounts: Record<ShipmentStatus, number> = {
  BOOKED: 0,
  LOADING: 0,
  CUSTOMS_CLEARED: 0,
  ON_BOARD: 0,
  ARRIVED: 0,
  CLOSED: 0,
};

const defaultShipmentStats: ShipmentStats = {
  total: 0,
  inTransit: 0,
  closed: 0,
  delayed: 0,
  statusCounts: defaultStatusCounts,
};

export const useShipments = () => {
  const [data, setData] = useState<IShipment[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState<ShipmentStats>(defaultShipmentStats);
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
            setStats({
              ...defaultShipmentStats,
              ...statsRes.data,
              statusCounts: {
                ...defaultStatusCounts,
                ...(statsRes.data.statusCounts ?? {}),
              },
            });
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
        const res = await sendRequest<IBackendRes<{ exportDelivery?: { deliveryNumber?: string } }>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/${id}/issue-stock`,
          method: 'PATCH',
        });

        if (res?.data) {
          notification.success({
            title: 'Xac nhan xuat kho thanh cong',
            description: res.data.exportDelivery?.deliveryNumber
              ? `Da issue phieu xuat kho ${res.data.exportDelivery.deliveryNumber}`
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
