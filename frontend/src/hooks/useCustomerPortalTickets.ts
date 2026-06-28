import { useState, useCallback } from 'react';
import { Ticket, CreateTicketDto, getTickets, createTicket } from '../services/ticket.service';
import { getAccessToken } from '@/lib/auth-token';
import { useSession } from 'next-auth/react';

export const useCustomerPortalTickets = () => {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken(session as any);
      if (!token) throw new Error('No auth token');
      const data = await getTickets(token);
      setTickets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  }, [session]);

  const submitTicket = async (data: CreateTicketDto) => {
    const token = getAccessToken(session as any);
    if (!token) throw new Error('No auth token');
    const newTicket = await createTicket(token, data);
    setTickets((prev) => [newTicket, ...prev]);
    return newTicket;
  };

  return { tickets, loading, error, fetchTickets, submitTicket };
};
