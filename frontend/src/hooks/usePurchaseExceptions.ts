import { useCallback, useMemo, useState } from 'react';
import type { Session } from 'next-auth';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';
import type { IGoodsReceipt } from '@/types/goods-receipt';
import type {
  CreateQualityCheckPayload,
  IExceptionBoardData,
  IExceptionDashboard,
  IP2PExceptionCandidate,
  IQualityCheck,
  ResolveQualityExceptionPayload,
} from '@/types/purchase-exception';

type AuthHeaders = {
  Authorization: string;
};

type PaginatedResponse<T> = {
  results: T[];
};

type MutationResult<T> = {
  data: T | null;
  error: string | null;
};

const emptyBoardData: IExceptionBoardData = {
  rows: [],
  candidates: [],
  grns: [],
  dashboard: null,
};

const getErrorMessage = (res?: IBackendRes<unknown>): string | null => {
  const statusCode = Number(res?.statusCode ?? 200);
  return statusCode >= 400 ? res?.message ?? 'Unable to load purchase exceptions' : null;
};

const toMutationResult = <T>(
  res: IBackendRes<T> | undefined,
  fallback: string,
): MutationResult<T> => {
  const errorMessage = getErrorMessage(res);
  if (errorMessage) return { data: null, error: errorMessage };
  return {
    data: res?.data ?? null,
    error: res?.data ? null : fallback,
  };
};

export const usePurchaseExceptions = (session: Session | null) => {
  const accessToken = getAccessToken(session);
  const authHeaders = useMemo<AuthHeaders | undefined>(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  const [boardData, setBoardData] = useState<IExceptionBoardData>(emptyBoardData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async (): Promise<void> => {
    if (!authHeaders) return;
    setLoading(true);
    setError(null);

    try {
      const [exceptionsRes, candidatesRes, grnRes, dashboardRes] = await Promise.all([
        sendRequest<IBackendRes<IQualityCheck[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/exceptions`,
          method: 'GET',
          headers: authHeaders,
        }),
        sendRequest<IBackendRes<IP2PExceptionCandidate[]>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/exceptions/candidates`,
          method: 'GET',
          headers: authHeaders,
        }),
        sendRequest<IBackendRes<PaginatedResponse<IGoodsReceipt>>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/goods-receipts`,
          method: 'GET',
          queryParams: { current: 1, pageSize: 200 },
          headers: authHeaders,
        }),
        sendRequest<IBackendRes<IExceptionDashboard>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/exceptions/dashboard`,
          method: 'GET',
          headers: authHeaders,
        }),
      ]);

      const failedMessage =
        getErrorMessage(exceptionsRes) ??
        getErrorMessage(candidatesRes) ??
        getErrorMessage(dashboardRes);

      if (failedMessage) {
        setError(failedMessage);
      }

      setBoardData({
        rows: exceptionsRes?.data ?? [],
        candidates: candidatesRes?.data ?? dashboardRes?.data?.pendingSources ?? [],
        grns: grnRes?.data?.results ?? [],
        dashboard: dashboardRes?.data ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load purchase exceptions');
      setBoardData(emptyBoardData);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const createException = useCallback(async (payload: CreateQualityCheckPayload): Promise<MutationResult<IQualityCheck>> => {
    if (!authHeaders) return { data: null, error: 'Missing access token' };

    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control`,
      method: 'POST',
      headers: authHeaders,
      body: payload,
    });

    return toMutationResult(res, 'Could not create QC exception');
  }, [authHeaders]);

  const sendClaim = useCallback(async (qualityCheck_id: string, note: string): Promise<MutationResult<IQualityCheck>> => {
    if (!authHeaders) return { data: null, error: 'Missing access token' };

    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/${qualityCheck_id}/send-claim`,
      method: 'PATCH',
      headers: authHeaders,
      body: { note },
    });

    return toMutationResult(res, 'Could not send quality claim');
  }, [authHeaders]);

  const resolveException = useCallback(async (
    qualityCheck_id: string,
    payload: ResolveQualityExceptionPayload,
  ): Promise<MutationResult<IQualityCheck>> => {
    if (!authHeaders) return { data: null, error: 'Missing access token' };

    const res = await sendRequest<IBackendRes<IQualityCheck>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/quality-control/${qualityCheck_id}/resolve-exception`,
      method: 'PATCH',
      headers: authHeaders,
      body: payload,
    });

    return toMutationResult(res, 'Could not resolve quality exception');
  }, [authHeaders]);

  return {
    ...boardData,
    loading,
    error,
    fetchBoard,
    createException,
    sendClaim,
    resolveException,
  };
};
