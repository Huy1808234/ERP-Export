'use client'
import { Layout } from 'antd';

const AdminFooter = () => {
    const { Footer } = Layout;

    return (
        <>
            <Footer style={{ textAlign: 'center' }}>
                Amit Group ©{new Date().getFullYear()} Created by @Amit Group
            </Footer>
        </>
    )
}

export default AdminFooter;