import { useState, useCallback } from 'react';
import type { CreateTicketDto, Ticket } from '../services/ticket.service';
import { getTickets, createTicket } from '../services/ticket.service';
import { getAccessToken } from '@/lib/auth-token';
import { useSession } from 'next-auth/react';

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback;
};

export const useCustomerPortalTickets = () => {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken(session);
      if (!token) throw new Error('No auth token');
      const data = await getTickets(token);
      setTickets(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch tickets'));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const submitTicket = useCallback(async (data: CreateTicketDto): Promise<Ticket> => {
    const token = getAccessToken(session);
    if (!token) throw new Error('No auth token');
    const newTicket = await createTicket(token, data);
    setTickets((prev) => [newTicket, ...prev]);
    return newTicket;
  }, [session]);

  return { tickets, loading, error, fetchTickets, submitTicket };
};
