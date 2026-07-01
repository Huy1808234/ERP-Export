import { sendRequest } from '@/lib/api-client';
import { SupportMessage, SupportTicket, TicketFormValues, TicketStatus } from '@/types/support.type';
import { API_ROUTES } from '@/constants/api-routes';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type AuthHeaders = Record<string, string>;
type AdminSupportTicketList = {
  results: SupportTicket[];
  totalItems: number;
  totalPages: number;
};

export const supportService = {
  // === GUEST (CUSTOMER) ===
  
  fetchTickets: async (headers: AuthHeaders): Promise<IBackendRes<SupportTicket[]>> => {
    return sendRequest<IBackendRes<SupportTicket[]>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKETS}`,
      method: 'GET',
      headers,
    });
  },

  fetchTicketDetail: async (id: string, headers: AuthHeaders): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKET_DETAIL(id)}`,
      method: 'GET',
      headers,
    });
  },

  createTicket: async (body: TicketFormValues, headers: AuthHeaders): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKETS}`,
      method: 'POST',
      headers,
      body,
    });
  },

  addMessage: async (ticketId: string, message: string, headers: AuthHeaders): Promise<IBackendRes<SupportMessage>> => {
    return sendRequest<IBackendRes<SupportMessage>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKET_MESSAGES(ticketId)}`,
      method: 'POST',
      headers,
      body: { message },
    });
  },

  updateTicketStatus: async (
    ticketId: string,
    status: TicketStatus,
    headers: AuthHeaders,
  ): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKET_STATUS(ticketId)}`,
      method: 'PATCH',
      headers,
      body: { status },
    });
  },

  // === ADMIN (STAFF) ===
  
  fetchAdminTickets: async (
    params: { current: number; pageSize: number; status?: string },
    headers: AuthHeaders,
  ): Promise<IBackendRes<AdminSupportTicketList>> => {
    return sendRequest<IBackendRes<AdminSupportTicketList>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets`,
      method: 'GET',
      headers,
      queryParams: params,
    });
  },

  fetchAdminTicketDetail: async (id: string, headers: AuthHeaders): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${id}`,
      method: 'GET',
      headers,
    });
  },

  addAdminMessage: async (
    ticketId: string,
    message: string,
    headers: AuthHeaders,
  ): Promise<IBackendRes<SupportMessage>> => {
    return sendRequest<IBackendRes<SupportMessage>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${ticketId}/messages`,
      method: 'POST',
      headers,
      body: { message },
    });
  },

  updateAdminTicketStatus: async (
    ticketId: string,
    status: TicketStatus,
    headers: AuthHeaders,
    note?: string,
  ): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${ticketId}/status`,
      method: 'PATCH',
      headers,
      body: {
        status,
        ...(note ? { note } : {}),
      },
    });
  },
};
