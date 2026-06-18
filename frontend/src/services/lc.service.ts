import { sendRequest } from "@/lib/api-client";
import type { IBackendRes } from "./base.service";

type LCQueryParams = Record<string, string | number | boolean | undefined>;
type LCRequestBody = Record<string, unknown>;

const authHeaders = (accessToken: string): { Authorization: string } => ({
    Authorization: `Bearer ${accessToken}`,
});

class LCService {
    private readonly baseUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc`;

    async findAll<T>(query: LCQueryParams, accessToken: string): Promise<IBackendRes<T>> {
        return sendRequest<IBackendRes<T>>({
            url: this.baseUrl,
            method: "GET",
            queryParams: query,
            headers: authHeaders(accessToken),
        });
    }

    async findOne<T>(recordId: string, accessToken: string): Promise<IBackendRes<T>> {
        return sendRequest<IBackendRes<T>>({
            url: `${this.baseUrl}/${recordId}`,
            method: "GET",
            headers: authHeaders(accessToken),
        });
    }

    async create<T>(data: LCRequestBody, accessToken: string): Promise<IBackendRes<T>> {
        return sendRequest<IBackendRes<T>>({
            url: this.baseUrl,
            method: "POST",
            body: data,
            headers: authHeaders(accessToken),
        });
    }

    async update<T>(recordId: string, data: LCRequestBody, accessToken: string): Promise<IBackendRes<T>> {
        return sendRequest<IBackendRes<T>>({
            url: `${this.baseUrl}/${recordId}`,
            method: "PATCH",
            body: data,
            headers: authHeaders(accessToken),
        });
    }

    async updateStatus<T>(recordId: string, status: string, accessToken: string): Promise<IBackendRes<T>> {
        return sendRequest<IBackendRes<T>>({
            url: `${this.baseUrl}/${recordId}/status`,
            method: "PATCH",
            body: { status },
            headers: authHeaders(accessToken),
        });
    }

    async presentDocuments<T>(recordId: string, accessToken: string): Promise<IBackendRes<T>> {
        return this.updateStatus<T>(recordId, "DOCUMENTS_PRESENTED", accessToken);
    }
}

export const lcService = new LCService();
