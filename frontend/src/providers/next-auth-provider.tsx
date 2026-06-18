'use client'
import { SessionProvider, signOut, useSession } from "next-auth/react"
import { useEffect } from "react";

function AuthSessionGuard({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();

    useEffect(() => {
        if (session?.error === "RefreshAccessTokenError") {
            const pathname = window.location.pathname || "/vi";
            const locale = pathname.split("/").filter(Boolean)[0] || "vi";
            const returnTo = `${pathname}${window.location.search}`;
            const isLoginPage = pathname === `/${locale}/auth/login`;

            signOut({
                callbackUrl: isLoginPage
                    ? `/${locale}/auth/login`
                    : `/${locale}/auth/login?callbackUrl=${encodeURIComponent(returnTo)}`,
            });
        }
    }, [session?.error]);

    return children;
}

export default function NextAuthWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchInterval={4 * 60} refetchOnWindowFocus>
            <AuthSessionGuard>
                {children}
            </AuthSessionGuard>
        </SessionProvider>
    );
}
