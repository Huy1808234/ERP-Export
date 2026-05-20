import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import {
  InactiveAccountError,
  InvalidEmailPasswordError,
} from "@/utils/errors";
import { sendRequest } from "./lib/api-client";

import { IAuthSessionUser, IUser } from "./types/next-auth";

type AuthUser = IUser & {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
};

const toSessionUser = (user: IAuthSessionUser): IAuthSessionUser => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  name: user.name,
  roleName: user.roleName,
  role: user.role,
  partnerId: user.partnerId,
});

const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  try {
    const res = await sendRequest<IBackendRes<ILogin>>({
      method: "POST",
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/refresh`,
      body: {
        refreshToken: token.refreshToken,
      },
    });

    if (!res.data?.access_token) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    return {
      ...token,
      user: toSessionUser(res.data.user),
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      accessTokenExpiresAt: res.data.access_token_expires_at,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    maxAge: 8 * 60 * 60,
    updateAge: 5 * 60,
  },
  jwt: {
    maxAge: 8 * 60 * 60,
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        const res = await sendRequest<IBackendRes<ILogin>>({
          method: "POST",
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/login`,
          body: {
            username: credentials.username,
            password: credentials.password,
          },
        });

        if (res.statusCode === 201) {
          return {
            _id: res.data?.user._id,
            username: res.data?.user.username,
            email: res.data?.user.email,
            name: res.data?.user.name,
            roleName: res.data?.user.roleName,
            role: res.data?.user.role,
            partnerId: res.data?.user.partnerId || undefined,
            accessToken: res.data?.access_token,
            refreshToken: res.data?.refresh_token,
            accessTokenExpiresAt: res.data?.access_token_expires_at,
          };
        } else if (+res.statusCode === 401) {
          throw new InvalidEmailPasswordError();
        } else if (res.statusCode === 400) {
          throw new InactiveAccountError();
        } else {
          throw new Error("Internal Server Error");
        }
      },
    }),
  ],
  // Pages config removed to allow middleware handling
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUser;
        token.user = toSessionUser(authUser);
        token.accessToken = authUser.accessToken;
        token.refreshToken = authUser.refreshToken;
        token.accessTokenExpiresAt = authUser.accessTokenExpiresAt;
        token.error = undefined;
      }

      if (
        token.accessTokenExpiresAt &&
        Date.now() < token.accessTokenExpiresAt - 60_000
      ) {
        return token;
      }

      if (!token.refreshToken) {
        return token.accessToken
          ? { ...token, error: "RefreshAccessTokenError" }
          : token;
      }

      return refreshAccessToken(token);
    },
    session({ session, token }) {
      if (token.user) {
        session.user = {
          ...session.user,
          ...toSessionUser(token.user),
        };
        session.accessToken = token.accessToken;
        session.accessTokenExpiresAt = token.accessTokenExpiresAt;
        session.error = token.error;
      }
      return session;
    },
    authorized: async ({ auth }) => {
      return !!auth;
    },
  },
});
