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
        summary?: any;
    }

    interface IPartner {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        partnerType?: string;
        defaultCurrency?: string;
        defaultPaymentTerm?: string;
    }

    interface IShipment {
        id: string;
        shipmentNumber: string;
        status: 'BOOKED' | 'LOADING' | 'CUSTOMS_CLEARED' | 'ON_BOARD' | 'ARRIVED' | 'CLOSED';
        proformaInvoice?: {
            id: string;
            piNumber: string;
        };
        forwarder?: IPartner;
        bookingNumber?: string;
        vesselFlight?: string;
        pol?: string;
        pod?: string;
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
        id: string;
        email: string;
        name: string;
        role?: {
            id: string;
            name: string;
            permissions?: Array<{ id: string; name: string }>;
        };
        access_token: string;
    }

    interface IPurchaseRequest {
        id: string;
        prNumber: string;
        purpose?: string;
        department?: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        project?: string;
        status: string;
        requiredDate?: string;
        items: any[];
    }

    interface ILogin {
        access_token: string;
        user: ISessionUser;
    }
}
