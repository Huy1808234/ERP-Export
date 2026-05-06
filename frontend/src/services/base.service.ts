import { sendRequest } from "@/utils/api";

export interface IBackendRes<T> {
    data?: T;
    message?: string;
    statusCode?: number | string;
    error?: string;
}

export abstract class BaseApiService {
    protected baseUrl: string;

    constructor(endpoint: string) {
        this.baseUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/${endpoint}`;
    }

    async findAll<T>(query: any): Promise<IBackendRes<T>> {
        return sendRequest<T>({
            url: this.baseUrl,
            method: "GET",
            queryParams: query,
        });
    }

    async findOne<T>(id: string): Promise<IBackendRes<T>> {
        return sendRequest<T>({
            url: `${this.baseUrl}/${id}`,
            method: "GET",
        });
    }

    async create<T>(data: any): Promise<IBackendRes<T>> {
        return sendRequest<T>({
            url: this.baseUrl,
            method: "POST",
            body: data,
        });
    }

    async update<T>(id: string, data: any): Promise<IBackendRes<T>> {
        return sendRequest<T>({
            url: `${this.baseUrl}/${id}`,
            method: "PATCH",
            body: data,
        });
    }

    async delete<T>(id: string): Promise<IBackendRes<T>> {
        return sendRequest<T>({
            url: `${this.baseUrl}/${id}`,
            method: "DELETE",
        });
    }
}
