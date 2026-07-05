export interface RoleOption {
  _id?: string;
  name: string;
  description?: string | null;
}

export interface UserRow {
  _id: string;
  username: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  image?: string | null;
  roleName?: string | null;
  role?: RoleOption | string | null;
  isActive: boolean;
}

export interface UserSummary {
  total: number;
  active: number;
  admin: number;
}

export interface UserListResponse {
  results: UserRow[];
  totalPages: number;
  totalItems: number;
  summary?: UserSummary;
}

export interface UserListParams {
  current: number;
  pageSize: number;
  search?: string;
  roleName?: string;
  isActive?: boolean;
}

export interface CreateUserPayload {
  username: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  roleName?: string;
  isActive?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  roleName?: string;
  isActive?: boolean;
}
