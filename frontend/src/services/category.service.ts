import { BaseApiService, IBackendRes } from "./base.service";
import { sendRequest } from "@/lib/api-client";

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

class CategoryService extends BaseApiService {
  constructor() {
    super("categories");
  }

  async getAllPublic(): Promise<IBackendRes<ICategory[]>> {
    return sendRequest<IBackendRes<ICategory[]>>({
      url: this.baseUrl,
      method: "GET",
    });
  }

  async createCategory(name: string, token?: string): Promise<IBackendRes<ICategory>> {
    return sendRequest<IBackendRes<ICategory>>({
      url: this.baseUrl,
      method: "POST",
      body: { name },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}

export const categoryService = new CategoryService();
