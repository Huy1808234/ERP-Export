'use client'

import { Layout } from 'antd';

export const AdminLayoutShell = ({ children }: { children: React.ReactNode }) => {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            {children}
        </Layout>
    );
};

export const AdminInnerLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <Layout>
            {children}
        </Layout>
    );
};

export default AdminLayoutShell;
