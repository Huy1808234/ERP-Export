import { sendRequest } from '@/lib/api-client';
import type { SigningModalSession } from './signing.types';

export const getApiErrorMessage = (error: any, fallbackMessage: string): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallbackMessage;
};

export const fetchSigningSessionData = async (
  token: string,
): Promise<{ success: boolean; data?: SigningModalSession; message?: string }> => {
  try {
    const res = await sendRequest<IBackendRes<SigningModalSession>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}`,
      method: 'GET',
    });

    if (!res?.data) {
      return { success: false, message: typeof res?.message === 'string' ? res.message : undefined };
    }

    return { success: true, data: res.data };
  } catch (error: any) {
    return { success: false, message: getApiErrorMessage(error, 'Unable to load signing session.') };
  }
};

export const requestSigningOtp = async (
  token: string,
): Promise<{ success: boolean; data?: { message: string; expiresAt: string }; message?: string }> => {
  try {
    const res = await sendRequest<IBackendRes<{ message: string; expiresAt: string }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/request-otp`,
      method: 'POST',
    });

    if (!res?.data) {
      return { success: false, message: typeof res?.message === 'string' ? res.message : undefined };
    }

    return { success: true, data: res.data };
  } catch (error: any) {
    return { success: false, message: getApiErrorMessage(error, 'OTP send failed.') };
  }
};

export const verifySigningOtp = async (
  token: string,
  otp: string,
): Promise<{ success: boolean; data?: SigningModalSession; message?: string }> => {
  try {
    const res = await sendRequest<IBackendRes<SigningModalSession>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/otp`,
      method: 'POST',
      body: { otp },
    });

    if (!res?.data) {
      return { success: false, message: typeof res?.message === 'string' ? res.message : undefined };
    }

    return { success: true, data: res.data };
  } catch (error: any) {
    return { success: false, message: getApiErrorMessage(error, 'OTP verification failed.') };
  }
};

export const submitContractSignature = async (
  token: string,
  payload: { signerName: string; signerTitle: string | null; signerEmail: string | null },
): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await sendRequest<IBackendRes<unknown>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts/signing/${token}/sign`,
      method: 'POST',
      body: payload,
    });

    if (!res?.data) {
      return { success: false, message: typeof res?.message === 'string' ? res.message : undefined };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, message: getApiErrorMessage(error, 'Signing failed.') };
  }
};
