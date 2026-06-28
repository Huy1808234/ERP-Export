import { useCallback, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getAccessToken } from '@/lib/auth-token';
import { supportService } from '@/services/support.service';
import type { SupportTicket } from '@/types/support.type';
import { App } from 'antd';

type AuthHeaders = Record<string, string>;
type TicketPagination = {
  current: number;
  pageSize: number;
  total: number;
};

export function useGuestSupportTickets() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo<AuthHeaders | undefined>(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async (): Promise<void> => {
    if (!headers) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await supportService.fetchTickets(headers);
      const ticketList = res.data;
      if (ticketList) {
        setTickets(ticketList);
      } else {
        setError(res?.message ? String(res.message) : 'Failed to fetch tickets');
      }
    } catch {
      setError('An error occurred while fetching tickets.');
    } finally {
      setIsLoading(false);
    }
  }, [headers]);

  const fetchTicketDetail = useCallback(async (id: string): Promise<void> => {
    if (!headers) return;
    setIsDetailLoading(true);
    try {
      const res = await supportService.fetchTicketDetail(id, headers);
      const ticketDetail = res.data;
      if (ticketDetail) {
        setActiveTicket(ticketDetail);
      }
    } catch {
      message.error('Failed to load ticket detail');
    } finally {
      setIsDetailLoading(false);
    }
  }, [headers, message]);

  return {
    tickets,
    activeTicket,
    setActiveTicket,
    isLoading,
    isDetailLoading,
    error,
    fetchTickets,
    fetchTicketDetail,
    headers,
  };
}

export function useAdminSupportTickets() {
  const { message } = App.useApp();
  const { data: session } = useSession();
  const accessToken = getAccessToken(session);
  const headers = useMemo<AuthHeaders | undefined>(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pagination, setPagination] = useState<TicketPagination>({ current: 1, pageSize: 10, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { current, pageSize } = pagination;

  const fetchTickets = useCallback(async (): Promise<void> => {
    if (!headers) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await supportService.fetchAdminTickets({
        current,
        pageSize,
        ...(statusFilter ? { status: statusFilter } : {})
      }, headers);

      const ticketList = res.data;
      if (ticketList) {
        setTickets(ticketList.results);
        setPagination((prev) => ({ ...prev, total: ticketList.totalItems }));
      } else {
        setError(res?.message ? String(res.message) : 'Failed to fetch tickets');
      }
    } catch {
      setError('An error occurred while fetching tickets.');
    } finally {
      setIsLoading(false);
    }
  }, [current, headers, pageSize, statusFilter]);

  const fetchTicketDetail = useCallback(async (id: string): Promise<void> => {
    if (!headers) return;
    setIsDetailLoading(true);
    try {
      const res = await supportService.fetchAdminTicketDetail(id, headers);
      const ticketDetail = res.data;
      if (ticketDetail) {
        setActiveTicket(ticketDetail);
      }
    } catch {
      message.error('Failed to load ticket detail');
    } finally {
      setIsDetailLoading(false);
    }
  }, [headers, message]);

  return {
    tickets,
    activeTicket,
    setActiveTicket,
    isLoading,
    isDetailLoading,
    error,
    fetchTickets,
    fetchTicketDetail,
    headers,
    pagination,
    setPagination,
    statusFilter,
    setStatusFilter,
  };
}
