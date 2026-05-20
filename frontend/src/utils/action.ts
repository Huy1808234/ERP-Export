"use server";
import { auth, signIn } from "@/auth";
import type { IAuthSessionUser } from "@/types/next-auth";
import { InactiveAccountError, InvalidEmailPasswordError } from "./errors";

export type AuthenticateResult =
  | {
      ok: true;
      user?: IAuthSessionUser;
    }
  | {
      ok: false;
      error: string;
      code: 0 | 1 | 2;
    };

const getAuthErrorName = (error: unknown): string | undefined => {
  return error instanceof Error ? error.name : undefined;
};

const getAuthErrorType = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;

  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
};

export async function authenticate(username: string, password: string): Promise<AuthenticateResult> {
  try {
    await signIn("credentials", {
      username: username,
      password: password,
      redirect: false,
    });

    const session = await auth();
    return {
      ok: true,
      user: session?.user,
    };
  } catch (error) {
    const errorName = getAuthErrorName(error);
    const errorType = getAuthErrorType(error);

    if (errorName === InvalidEmailPasswordError.name) {
      return {
        ok: false,
        error: errorType || "Username or password is incorrect",
        code: 1,
      };
    } else if (errorName === InactiveAccountError.name) {
      return {
        ok: false,
        error: errorType || "Account is inactive",
        code: 2,
      };
    } else {
      return {
        ok: false,
        error: "Internal Server Error",
        code: 0,
      };
    }
  }
}
