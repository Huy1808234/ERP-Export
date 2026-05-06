import { BaseApiService, IBackendRes } from "./base.service";

class DashboardService extends BaseApiService {
    constructor() {
        super("dashboards");
    }

    async getExecutiveData(startDate?: string, endDate?: string): Promise<IBackendRes<any>> {
        const query: any = {};
        if (startDate) query.startDate = startDate;
        if (endDate) query.endDate = endDate;
        
        return this.findAll<any>({
            ...query,
            __path: "executive" // Helper để gọi sub-path nếu BaseApiService hỗ trợ hoặc dùng URL tùy biến
        });
    }

    // Ghi đè method findAll để gọi đúng endpoint /executive
    async getExecutive(startDate?: string, endDate?: string): Promise<IBackendRes<any>> {
        const url = `${this.baseUrl}/executive`;
        const queryParams: any = {};
        if (startDate) queryParams.startDate = startDate;
        if (endDate) queryParams.endDate = endDate;

        const { sendRequest } = await import("@/utils/api");
        const { getSession } = await import("next-auth/react");
        const currentSession = await getSession();

        return sendRequest<any>({
            url,
            method: "GET",
            queryParams,
            headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
        });
    }
}

export const dashboardService = new DashboardService();
