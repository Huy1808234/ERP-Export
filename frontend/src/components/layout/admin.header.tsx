'use client'

import { AdminContext } from '@/library/admin.context';
import {
    BellOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SettingOutlined,
    UserOutlined,
    MoonOutlined,
    SunOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Dropdown, Layout, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { useContext, useState } from 'react';
import type { MenuProps } from 'antd';
import { signOut } from 'next-auth/react';

import LocaleSwitcher from './locale.switcher';
import { useTranslations } from 'next-intl';
import type { Session } from 'next-auth';
import { useParams } from 'next/navigation';
import { useTheme } from '@/library/theme.context';
import SystemSettingsModal from '../admin/settings/SystemSettingsModal';

const { Text } = Typography;

interface IProps {
    session: Session | null;
}

const AdminHeader = (props: IProps) => {
    const { token } = theme.useToken();
    const { isDark, setThemeMode, themeMode } = useTheme();
    const params = useParams();
    const locale = params?.locale ?? 'vi';
    const t = useTranslations('Header');
    const { session } = props;
    const { Header } = Layout;
    const { collapseMenu, setCollapseMenu } = useContext(AdminContext)!;
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const userEmail: string = session?.user?.email ?? 'Admin';
    const userInitial = userEmail.charAt(0).toUpperCase();
    const userName = userEmail.split('@')[0];

    const toggleTheme = () => {
        setThemeMode(isDark ? 'light' : 'dark');
    };

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'info',
            label: (
                <div style={{ padding: '4px 0', minWidth: 180 }}>
                    <Text strong style={{ display: 'block' }}>{userName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{userEmail}</Text>
                    <Tag color="blue" style={{ marginTop: 6 }}>Admin</Tag>
                </div>
            ),
            disabled: true,
        },
        { type: 'divider' },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: t('settings'),
            onClick: () => setIsSettingsModalOpen(true),
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            danger: true,
            label: t('logout'),
            onClick: () => signOut({ callbackUrl: `/${locale}/auth/login` }),
        },
    ];

    return (
        <Header
            style={{
                padding: '0 32px 0 0',
                display: 'flex',
                background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                height: 80,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {/* Left: Toggle button */}
            <Tooltip title={collapseMenu ? t('expandMenu') : t('collapseMenu')}>
                <Button
                    type="text"
                    icon={collapseMenu ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setCollapseMenu(!collapseMenu)}
                    style={{ fontSize: 20, width: 80, height: 80, color: token.colorTextSecondary }}
                />
            </Tooltip>

            {/* Right: Theme + Notifications + Language + User */}
            <Space size={24} align="center">
                <div className="premium-glass" style={{ borderRadius: 12, padding: '2px 8px' }}>
                    <LocaleSwitcher />
                </div>
                
                {/* Theme Switcher */}
                <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
                    <Button
                        type="text"
                        shape="circle"
                        icon={isDark ? <SunOutlined style={{ fontSize: 20, color: '#fbbf24' }} /> : <MoonOutlined style={{ fontSize: 20, color: '#6366f1' }} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTheme();
                        }}
                        style={{ 
                            width: 44, 
                            height: 44, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                        }}
                    />
                </Tooltip>
                
                {/* Bell icon */}
                <Tooltip title={t('notifications')}>
                    <Badge count={0} showZero={false}>
                        <Button
                            type="text"
                            shape="circle"
                            icon={<BellOutlined style={{ fontSize: 20, color: token.colorTextSecondary }} />}
                            style={{ 
                                width: 44, 
                                height: 44, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                            }}
                        />
                    </Badge>
                </Tooltip>

                {/* User dropdown */}
                <Dropdown
                    menu={{ items: userMenuItems }}
                    placement="bottomRight"
                    arrow={{ pointAtCenter: true }}
                    trigger={['click']}
                    styles={{ root: { paddingTop: 12 } }}
                >
                    <div
                        style={{
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: 16,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            border: '1px solid transparent'
                        }}
                        className="header-user-trigger"
                    >
                        <Avatar
                            size={36}
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                fontWeight: 700,
                                fontSize: 16,
                                boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                            }}
                        >
                            {userInitial}
                        </Avatar>
                        <div style={{ lineHeight: 1.2 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: token.colorText }}>{userName}</div>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('role')}</div>
                        </div>
                    </div>
                </Dropdown>
            </Space>

            <SystemSettingsModal 
                open={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
            />

            <style jsx>{`
                .header-user-trigger:hover {
                    background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'} !important;
                    transform: translateY(-1px);
                    border-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
                }
            `}</style>
        </Header>
    );
};

export default AdminHeader;
