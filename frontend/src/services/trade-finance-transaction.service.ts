import { BaseApiService } from "./base.service";

class TradeFinanceTransactionService extends BaseApiService {
    constructor() {
        super("trade-finance/transactions");
    }

    async updateStatus(id: string, status: string) {
        return this.update(`${id}/status`, { status });
    }
}

export const tradeFinanceTransactionService = new TradeFinanceTransactionService();
