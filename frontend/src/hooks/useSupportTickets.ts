import { useCallback, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';
import { supportService } from '@/services/support.service';
import type { AdminSupportTicketQuery } from '@/services/support.service';
import type {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/types/support.type';
import { App } from 'antd';

type AuthHeaders = Record<string, string>;
type TicketPagination = {
  current: number;
  pageSize: number;
  total: number;
};

export function useGuestSupportTickets() {
  const { message } = App.useApp();
  const t = useTranslations('PortalSupport');
  const { data: session, status: sessionStatus } = useSession();
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
    if (sessionStatus === 'loading') return;
    if (!headers) {
      setTickets([]);
      setIsLoading(false);
      setError(t('feedback.authError'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await supportService.fetchTickets(headers);
      const ticketList = res.data;
      if (ticketList) {
        setTickets(ticketList);
      } else {
        setError(res?.message ? String(res.message) : t('feedback.loadError'));
      }
    } catch {
      setError(t('feedback.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [headers, sessionStatus, t]);

  const fetchTicketDetail = useCallback(async (_id: string): Promise<void> => {
    if (!headers) {
      if (sessionStatus !== 'loading') {
        message.error(t('feedback.authError'));
      }
      return;
    }

    setIsDetailLoading(true);
    try {
      const res = await supportService.fetchTicketDetail(_id, headers);
      const ticketDetail = res.data;
      if (ticketDetail) {
        setActiveTicket(ticketDetail);
      }
    } catch {
      message.error(t('feedback.detailError'));
    } finally {
      setIsDetailLoading(false);
    }
  }, [headers, message, sessionStatus, t]);

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
  const t = useTranslations('AdminSupport');
  const { data: session, status: sessionStatus } = useSession();
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
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [assignedToUsernameFilter, setAssignedToUsernameFilter] = useState<string>('');
  const { current, pageSize } = pagination;

  const fetchTickets = useCallback(async (): Promise<void> => {
    if (sessionStatus === 'loading') return;
    if (!headers) {
      setTickets([]);
      setIsLoading(false);
      setError(t('feedback.authError'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params: AdminSupportTicketQuery = {
        current,
        pageSize,
        ...(searchFilter ? { search: searchFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(priorityFilter ? { priority: priorityFilter } : {}),
        ...(assignedToUsernameFilter ? { assignedToUsername: assignedToUsernameFilter } : {}),
      };
      const res = await supportService.fetchAdminTickets(params, headers);

      const ticketList = res.data;
      if (ticketList) {
        setTickets(ticketList.results);
        setPagination((prev) => ({ ...prev, total: ticketList.totalItems }));
      } else {
        setError(res?.message ? String(res.message) : t('feedback.loadError'));
      }
    } catch {
      setError(t('feedback.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [
    assignedToUsernameFilter,
    categoryFilter,
    current,
    headers,
    pageSize,
    priorityFilter,
    searchFilter,
    sessionStatus,
    statusFilter,
    t,
  ]);

  const fetchTicketDetail = useCallback(async (_id: string): Promise<void> => {
    if (!headers) {
      if (sessionStatus !== 'loading') {
        message.error(t('feedback.authError'));
      }
      return;
    }

    setIsDetailLoading(true);
    try {
      const res = await supportService.fetchAdminTicketDetail(_id, headers);
      const ticketDetail = res.data;
      if (ticketDetail) {
        setActiveTicket(ticketDetail);
      }
    } catch {
      message.error(t('feedback.detailError'));
    } finally {
      setIsDetailLoading(false);
    }
  }, [headers, message, sessionStatus, t]);

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
    searchFilter,
    setSearchFilter,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    assignedToUsernameFilter,
    setAssignedToUsernameFilter,
  };
}
