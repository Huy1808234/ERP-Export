'use client'

import { Layout } from "antd";

const AdminContent = ({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) => {
    const { Content } = Layout;

    return (
        <Content
            style={{
                flex: '1 1 auto',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    height: '100%',
                    minHeight: 0,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    // background: "#ccc",
                    // borderRadius: "#ccc",
                }}
            >
                {children}
            </div>
        </Content>
    )
}

export default AdminContent;
