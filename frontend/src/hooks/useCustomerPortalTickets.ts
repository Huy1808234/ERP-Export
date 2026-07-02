import { useState, useCallback } from 'react';
import type { CreateTicketDto, Ticket } from '../services/ticket.service';
import { getTickets, createTicket } from '../services/ticket.service';
import { getAccessToken } from '@/lib/auth-token';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export const useCustomerPortalTickets = () => {
  const t = useTranslations('PortalSupport');
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken(session);
      if (!token) throw new Error(t('feedback.authError'));
      const data = await getTickets(token);
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('feedback.loadError'));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  const submitTicket = useCallback(async (data: CreateTicketDto): Promise<Ticket> => {
    const token = getAccessToken(session);
    if (!token) throw new Error(t('feedback.authError'));
    const newTicket = await createTicket(token, data);
    setTickets((prev) => [newTicket, ...prev]);
    return newTicket;
  }, [session, t]);

  return { tickets, loading, error, fetchTickets, submitTicket };
};
