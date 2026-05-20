import { sendRequest } from "@/lib/api-client";

export interface PublicProduct {
    _id: string;
    sku: string;
    vietnameseName: string;
    englishName?: string;
    category?: string | null;
    defaultExportPrice?: number | null;
    exportCurrency?: string | null;
    imageUrl?: string | null;
    isBestseller?: boolean | null;
    isNew?: boolean | null;
    description?: string | null;
    unitOfMeasure?: string | null;
}

export interface PublicCategory {
    _id: string;
    name: string;
}

export interface PublicProductQuery extends Record<string, string | number | boolean | undefined> {
    category?: string;
    search?: string;
    q?: string;
    current?: number;
    pageSize?: number;
}

export interface PublicProductsPayload {
    results: PublicProduct[];
    totalPages: number;
    totalItems: number;
}

export interface PublicSummaryPayload {
    shipments: {
        total: number;
        inProgress: number;
        completed: number;
        completionRate: number;
    };
    partners: {
        total: number;
        active: number;
    };
    quotations: {
        total: number;
    };
    purchaseOrders: {
        total: number;
        draft: number;
    };
    proformaInvoices: {
        total: number;
        confirmed: number;
        completionRate: number;
    };
}

export interface PublicShipmentContainer {
    containerNumber: string;
    sealNumber?: string | null;
    type?: string | null;
}

export interface PublicShipmentTrackingPayload {
    shipmentNumber: string;
    status: string;
    pol?: string | null;
    pod?: string | null;
    etd?: string | null;
    eta?: string | null;
    vesselName?: string | null;
    voyageNumber?: string | null;
    bookingNumber?: string | null;
    logisticsPartner?: string | null;
    containers?: PublicShipmentContainer[];
    updatedAt: string;
}

export const guestService = {
    getSummary: () => {
        return sendRequest<IBackendRes<PublicSummaryPayload>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/guest/summary`,
            method: "GET",
        });
    },
    trackShipment: (number: string) => {
        return sendRequest<IBackendRes<PublicShipmentTrackingPayload | null>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/shipments/tracking/${number}`,
            method: "GET",
        });
    },
    getProducts: (params: PublicProductQuery = {}) => {
        return sendRequest<IBackendRes<PublicProductsPayload>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/public`,
            method: "GET",
            queryParams: params
        });
    },
    getCategories: () => {
        return sendRequest<IBackendRes<PublicCategory[]>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/categories`,
            method: "GET",
        });
    }
};
