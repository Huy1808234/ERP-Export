import { BaseApiService } from "./base.service";

class LCService extends BaseApiService {
    constructor() {
        super("trade-finance/lc");
    }

    async updateStatus(id: string, status: string) {
        return this.update(id, { status });
    }

    // Bạn có thể thêm các method đặc thù cho L/C ở đây
    async presentDocuments(id: string, data: any) {
        return this.update(`${id}/present-documents`, data);
    }
}

export const lcService = new LCService();
