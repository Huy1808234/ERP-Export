import { sendRequest } from '@/lib/api-client';

export interface Ticket {
  _id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requester_username: string;
  assignee_username?: string;
  source: 'PORTAL' | 'INTERNAL';
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketDto {
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  attachments?: string[];
}

export const getTickets = async (token: string): Promise<Ticket[]> => {
  return sendRequest<Ticket[]>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tickets`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const createTicket = async (token: string, data: CreateTicketDto): Promise<Ticket> => {
  return sendRequest<Ticket>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/tickets`,
    method: 'POST',
    body: data as any,
    headers: { Authorization: `Bearer ${token}` }
  });
};
