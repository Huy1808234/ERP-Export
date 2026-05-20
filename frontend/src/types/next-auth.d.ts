import type { DefaultSession } from "next-auth";

export interface IPermission {
  _id?: string;
  name: string;
  apiPath?: string;
  method?: string;
  module?: string;
}

export interface IRole {
  _id?: string;
  name: string;
  permissions?: IPermission[];
}

export interface IAuthSessionUser {
  _id?: string;
  username?: string;
  email?: string;
  name?: string;
  roleName?: string | null;
  role?: IRole;
  partnerId?: string | null;
}

export interface IUser extends IAuthSessionUser {
  email: string;
  name: string;
  role: IRole;
}

declare module "next-auth" {
  interface Session {
    user: IAuthSessionUser & DefaultSession["user"];
    accessToken?: string;
    accessTokenExpiresAt?: number;
    error?: "RefreshAccessTokenError";
  }

  interface User {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    _id?: string;
    username?: string;
    roleName?: string | null;
    role?: IRole;
    partnerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: IAuthSessionUser;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: "RefreshAccessTokenError";
    _id?: string;
    roleName?: string | null;
    role?: IRole;
  }
}
