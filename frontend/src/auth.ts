import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  InactiveAccountError,
  InvalidEmailPasswordError,
} from "@/utils/errors";
import { sendRequest } from "./utils/api";

import { IUser } from "./types/next-auth";
export const { handlers, signIn, signOut, auth } = NextAuth({
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
            id: res.data?.user.id,
            email: res.data?.user.email,
            name: res.data?.user.name,
            role: res.data?.user.role,
            access_token: res.data?.access_token, 
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
    jwt({ token, user }) {
      if (user) {
        // User is available during sign-in
        token.user = user as IUser;
      }
      return token;
    },
    session({ session, token }) {
      if (token.user) {
        (session.user as IUser) = token.user;
        session.access_token = token.user.access_token;
      }
      return session;
    },
    authorized: async ({ auth }) => {
      return !!auth;
    },
  },
});
