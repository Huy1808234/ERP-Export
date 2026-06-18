import { sendRequest } from '@/lib/api-client';

export interface ICountry {
  _id: string;
  code: string;
  name: string;
  nameVi: string;
  region: string;
  aliases?: string[] | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CountryQuery {
  search?: string;
  region?: string;
  isActive?: boolean;
  current?: number;
  pageSize?: number;
}

export type CountryPayload = {
  code: string;
  name: string;
  nameVi: string;
  region: string;
  aliases?: string[];
  isActive?: boolean;
};

const endpoint = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/countries`;

const authHeaders = (accessToken?: string): Record<string, string> =>
  accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

const toQueryParams = (query: CountryQuery): Record<string, string | number | boolean | undefined> => ({
  search: query.search,
  region: query.region,
  isActive: query.isActive,
  current: query.current,
  pageSize: query.pageSize,
});

export const countryService = {
  findAll(query: CountryQuery, accessToken?: string): Promise<IBackendRes<IModelPaginate<ICountry>>> {
    return sendRequest<IBackendRes<IModelPaginate<ICountry>>>({
      url: endpoint,
      method: 'GET',
      queryParams: toQueryParams(query),
      headers: authHeaders(accessToken),
    });
  },

  create(payload: CountryPayload, accessToken?: string): Promise<IBackendRes<ICountry>> {
    return sendRequest<IBackendRes<ICountry>>({
      url: endpoint,
      method: 'POST',
      body: payload,
      headers: authHeaders(accessToken),
    });
  },

  update(recordId: string, payload: Partial<CountryPayload>, accessToken?: string): Promise<IBackendRes<ICountry>> {
    return sendRequest<IBackendRes<ICountry>>({
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
