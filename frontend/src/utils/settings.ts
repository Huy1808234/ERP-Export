import { sendRequest } from '@/utils/api';

export const getSetting = async (key: string, accessToken: string) => {
  const res = await sendRequest<IBackendRes<any>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings/${key}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res?.data;
};

export const updateSetting = async (key: string, value: string, accessToken: string) => {
  return sendRequest<IBackendRes<any>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings`,
    method: 'POST',
    body: { key, value },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};

export const getAllSettings = async (accessToken: string) => {
  const res = await sendRequest<IBackendRes<any>>({
    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res?.data || [];
};
