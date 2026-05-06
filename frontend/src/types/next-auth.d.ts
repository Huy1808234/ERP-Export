import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

export interface IPermission {
  _id: string;
  name: string;
  apiPath: string;
  method: string;
  module: string;
}

export interface IRole {
  _id: string;
  name: string;
  permissions?: IPermission[];
}

declare module "next-auth" {
  interface Session {
    user: {
      access_token?: string;
      _id?: string;
      email?: string;
      name?: string;
      role?: IRole;
    } & DefaultSession["user"];
    access_token?: string;
  }

  interface User {
    access_token?: string;
    _id?: string;
    role?: IRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    _id?: string;
    role?: IRole;
  }
}