export { };
// https://bobbyhadz.com/blog/typescript-make-types-global#declare-global-types-in-typescript

declare global {
    interface IRequest {
        url: string;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: Record<string, unknown> | FormData | string | null;
        queryParams?: Record<string, string | number | boolean | undefined>;
        useCredentials?: boolean;
        headers?: Record<string, string>;
        nextOption?: RequestInit;
    }

    interface IBackendRes<T> {
        error?: string | string[];
        message: string;
        statusCode: number | string;
        data?: T;
    }

    interface IModelPaginate<T> {
        meta?: {
            current: number;
            pageSize: number;
            pages: number;
            total: number;
        },
        results: T[];
        totalItems?: number;
        totalPages?: number;
        summary?: Record<string, unknown>;
    }

    interface IPartner {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        partnerType?: string;
        country?: string;
        region?: string;
        defaultCurrency?: string;
        defaultPaymentTerm?: string;
    }

    interface IShipment {
        _id: string;
        shipmentNumber: string;
        status: 'BOOKED' | 'LOADING' | 'CUSTOMS_CLEARED' | 'ON_BOARD' | 'ARRIVED' | 'CLOSED';
        proformaInvoice?: {
            _id: string;
            piNumber: string;
        };
        forwarder?: IPartner;
        bookingNumber?: string;
        vesselFlight?: string;
        pol?: string;
        pol_port_id?: string | null;
        pod?: string;
        pod_port_id?: string | null;
        etd?: string;
        eta?: string;
        containers?: Array<{
            containerNumber: string;
            sealNumber?: string;
            containerType: string;
            notes?: string;
        }>;
    }

    interface ISessionUser {
        _id: string;
        username: string;
        name: string;
        email?: string;
        roleName?: string | null;
        role?: {
            _id: string;
            name: string;
        } | null;
        partnerId?: string | null;
    }

    interface IPurchaseRequest {
        _id: string;
        prNumber: string;
        purpose?: string;
        department?: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        project?: string;
        status: string;
        requiredDate?: string;
        items: Array<Record<string, unknown>>;
    }

    interface ILogin {
        access_token: string;
        access_token_expires_at: number;
        refresh_token: string;
        user: ISessionUser;
    }
}
