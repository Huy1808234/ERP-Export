import { sendRequest } from '@/lib/api-client';
import { PortalShipment } from '@/types/shipment.type';
import { API_ROUTES } from '@/constants/api-routes';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const shipmentService = {
  fetchGuestShipments: async (headers: any) => {
    return sendRequest<IBackendRes<PortalShipment[]>>({
      // We will fallback to raw URL if API_ROUTES doesn't have it defined yet to avoid errors
      url: `${BACKEND_URL}/api/v1/portal/shipments`,
      method: 'GET',
      headers,
    });
  },
};
