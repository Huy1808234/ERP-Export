'use client'
import { GlobalOutlined } from '@ant-design/icons';
import { Layout, Space, Typography, theme } from 'antd';
import { useTheme } from '@/library/theme.context';

const { Text } = Typography;

const AdminFooter = () => {
    const { Footer } = Layout;
    const { token } = theme.useToken();
    const { isDark } = useTheme();

    return (
        <Footer
            style={{
                textAlign: 'center',
                background: isDark ? token.colorBgLayout : '#fafafa',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                padding: '12px 24px',
                transition: 'all 0.3s ease',
            }}
        >
            <Space separator={<span style={{ color: token.colorBorderSecondary }}>|</span>}>
                <Space size={4}>
                    <GlobalOutlined style={{ color: token.colorPrimary }} />
                    <Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
                        Mini ERP XNK ©{new Date().getFullYear()}
                    </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, color: token.colorTextSecondary }}>
                    Hệ thống quản lý Xuất Nhập Khẩu
                </Text>
            </Space>
        </Footer>
    );
};

export default AdminFooter;
