'use client'
import { SessionProvider } from "next-auth/react"
import { App } from 'antd';

export default function NextAuthWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <App>
                {children}
            </App>
        </SessionProvider>
    );
}
