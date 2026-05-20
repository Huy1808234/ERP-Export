'use client'

import { Layout } from 'antd';
import type { ReactNode } from 'react';

export const AdminLayoutShell = ({ children }: { children: ReactNode }) => {
    return (
        <Layout
            className="admin-layout-root"
            style={{
                height: '100vh',
                minHeight: '100vh',
                overflow: 'hidden',
            }}
        >
            {children}
        </Layout>
    );
};

export const AdminInnerLayout = ({ children }: { children: ReactNode }) => {
    return (
        <Layout
            style={{
                height: '100vh',
                minHeight: 0,
                minWidth: 0,
                width: 0,
                maxWidth: '100%',
                flex: '1 1 0',
                overflow: 'hidden',
            }}
        >
            {children}
        </Layout>
    );
};

export default AdminLayoutShell;
