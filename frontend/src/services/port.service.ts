import { sendRequest } from '@/lib/api-client';

export type PortType = 'SEA' | 'INLAND' | 'AIR';

export interface IPort {
  _id: string;
  code: string;
  name: string;
  localName?: string | null;
  city?: string | null;
  country: string;
  countryCode: string;
  type: PortType;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  aliases?: string[] | null;
  notes?: string | null;
  isActive: boolean;
  createdByUsername?: string | null;
  updatedByUsername?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortQuery {
  search?: string;
  countryCode?: string;
  type?: PortType;
  isActive?: boolean;
  current?: number;
  pageSize?: number;
}

export type PortPayload = {
  code: string;
  name: string;
  localName?: string;
  city?: string;
  country: string;
  countryCode: string;
  type?: PortType;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  aliases?: string[];
  notes?: string;
  isActive?: boolean;
};

const endpoint = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/ports`;

const authHeaders = (accessToken?: string): Record<string, string> =>
  accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

export const formatPortLabel = (port: IPort): string =>
  `${port.code} - ${port.localName || port.name}`;

const toQueryParams = (query: PortQuery): Record<string, string | number | boolean | undefined> => ({
  search: query.search,
  countryCode: query.countryCode,
  type: query.type,
  isActive: query.isActive,
  current: query.current,
  pageSize: query.pageSize,
});

export const portService = {
  findAll(query: PortQuery, accessToken?: string): Promise<IBackendRes<IModelPaginate<IPort>>> {
    return sendRequest<IBackendRes<IModelPaginate<IPort>>>({
      url: endpoint,
      method: 'GET',
      queryParams: toQueryParams(query),
      headers: authHeaders(accessToken),
    });
  },

  create(payload: PortPayload, accessToken?: string): Promise<IBackendRes<IPort>> {
    return sendRequest<IBackendRes<IPort>>({
      url: endpoint,
      method: 'POST',
      body: payload,
      headers: authHeaders(accessToken),
    });
  },

  update(recordId: string, payload: Partial<PortPayload>, accessToken?: string): Promise<IBackendRes<IPort>> {
    return sendRequest<IBackendRes<IPort>>({
      url: `${endpoint}/${recordId}`,
      method: 'PATCH',
      body: payload,
      headers: authHeaders(accessToken),
    });
  },

  remove(recordId: string, accessToken?: string): Promise<IBackendRes<void>> {
    return sendRequest<IBackendRes<void>>({
      url: `${endpoint}/${recordId}`,
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
  },
};
