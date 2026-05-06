import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IVendorInvoice } from '@/types/vendor-invoice';
import { IPaginationMeta } from '@/types/purchase-order';
import { notification } from '@/library/antd.static';

interface FetchParams {
  current: number;
  pageSize: number;
  invoiceNumber?: string;
  vendorName?: string;
}

export const useVendorInvoices = () => {
  const { data: session } = useSession();
  const [data, setData] = useState<IVendorInvoice[]>([]);
  const [meta, setMeta] = useState<IPaginationMeta>({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchInvoices = useCallback(async (params: FetchParams) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<IModelPaginate<IVendorInvoice>>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-invoices`,
        method: 'GET',
        queryParams: {
          current: params.current,
          pageSize: params.pageSize,
          ...(params.invoiceNumber ? { invoiceNumber: `/${params.invoiceNumber}/i` } : {}),
          populate: 'purchaseOrder,vendor',
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
      notification.error({ title: 'Lỗi tải dữ liệu Hóa đơn mua' });
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, meta, loading, fetchInvoices };
};
