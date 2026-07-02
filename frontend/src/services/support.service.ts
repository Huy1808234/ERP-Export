import { sendRequest } from '@/lib/api-client';
import {
  SupportMessage,
  SupportTicket,
  TicketCategory,
  TicketFormValues,
  TicketPriority,
  TicketStatus,
} from '@/types/support.type';
import { API_ROUTES } from '@/constants/api-routes';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type AuthHeaders = Record<string, string>;
type AdminSupportTicketList = {
  results: SupportTicket[];
  totalItems: number;
  totalPages: number;
};
export type AdminSupportTicketQuery = {
  current: number;
  pageSize: number;
  search?: string;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedToUsername?: string;
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

  fetchTicketDetail: async (_id: string, headers: AuthHeaders): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKET_DETAIL(_id)}`,
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

  addMessage: async (_id: string, message: string, headers: AuthHeaders): Promise<IBackendRes<SupportMessage>> => {
    return sendRequest<IBackendRes<SupportMessage>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKET_MESSAGES(_id)}`,
      method: 'POST',
      headers,
      body: { message },
    });
  },

  updateTicketStatus: async (
    _id: string,
    status: TicketStatus,
    headers: AuthHeaders,
  ): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}${API_ROUTES.PORTAL.SUPPORT_TICKET_STATUS(_id)}`,
      method: 'PATCH',
      headers,
      body: { status },
    });
  },

  // === ADMIN (STAFF) ===
  
  fetchAdminTickets: async (
    params: AdminSupportTicketQuery,
    headers: AuthHeaders,
  ): Promise<IBackendRes<AdminSupportTicketList>> => {
    return sendRequest<IBackendRes<AdminSupportTicketList>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets`,
      method: 'GET',
      headers,
      queryParams: params,
    });
  },

  fetchAdminTicketDetail: async (_id: string, headers: AuthHeaders): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${_id}`,
      method: 'GET',
      headers,
    });
  },

  addAdminMessage: async (
    _id: string,
    message: string,
    headers: AuthHeaders,
    visibility: 'PUBLIC' | 'INTERNAL' = 'PUBLIC',
  ): Promise<IBackendRes<SupportMessage>> => {
    return sendRequest<IBackendRes<SupportMessage>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${_id}/messages`,
      method: 'POST',
      headers,
      body: { message, visibility },
    });
  },

  assignAdminTicket: async (
    _id: string,
    assignedToUsername: string | null,
    headers: AuthHeaders,
    note?: string,
  ): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${_id}/assignee`,
      method: 'PATCH',
      headers,
      body: {
        ...(assignedToUsername ? { assignedToUsername } : {}),
        ...(note ? { note } : {}),
      },
    });
  },

  updateAdminTicketStatus: async (
    _id: string,
    status: TicketStatus,
    headers: AuthHeaders,
    note?: string,
  ): Promise<IBackendRes<SupportTicket>> => {
    return sendRequest<IBackendRes<SupportTicket>>({
      url: `${BACKEND_URL}/api/v1/portal/admin/support/tickets/${_id}/status`,
      method: 'PATCH',
      headers,
      body: {
        status,
        ...(note ? { note } : {}),
      },
    });
  },
};
