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
            signOut({
                callbackUrl: `/${locale}/auth/login?callbackUrl=${encodeURIComponent(returnTo)}`,
            });
        }
    }, [session?.error]);

    return children;
}

export default function NextAuthWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthSessionGuard>
                {children}
            </AuthSessionGuard>
        </SessionProvider>
    );
}
