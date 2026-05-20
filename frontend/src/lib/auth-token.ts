type SessionTokenShape = {
  accessToken?: string | null;
  error?: string | null;
} | null | undefined;

export const getAccessToken = (session: SessionTokenShape): string | undefined => {
  if (session?.error) return undefined;

  return session?.accessToken || undefined;
};

export const authHeaders = (session: SessionTokenShape): { Authorization: string } | undefined => {
  const accessToken = getAccessToken(session);
  if (!accessToken) return undefined;

  return { Authorization: `Bearer ${accessToken}` };
};
