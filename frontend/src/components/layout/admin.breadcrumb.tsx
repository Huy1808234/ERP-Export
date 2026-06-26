'use client'

import React from 'react';
import { Breadcrumb, theme } from 'antd';
import { HomeOutlined, RightOutlined } from '@ant-design/icons';
import { usePathname, Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme.context';

const AdminBreadcrumb = () => {
    const pathname = usePathname();
    const { token } = theme.useToken();
    const { isDark } = useTheme();
    const t = useTranslations('Breadcrumb');

    // Convert pathname to breadcrumb items
    // Example: /dashboard/inquiry -> Home / Dashboard / Inquiry
    const pathSnippets = pathname.split('/').filter((i) => i);

    const breadcrumbItems = [
        {
            title: (
                <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HomeOutlined style={{ fontSize: 14 }} />
                    <span style={{ fontWeight: 500 }}>{t('home')}</span>
                </Link>
            ),
            key: 'home',
        },
        ...pathSnippets.map((snippet, index) => {
            const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
            const isLast = index === pathSnippets.length - 1;

            // Skip 'dashboard' if it's not the last item (avoid Home > Dashboard > Approvals, prefer Home > Approvals)
            if (snippet === 'dashboard' && !isLast) return null;
            
            // TECH LEAD: Handle UUIDs or long IDs - show "Detail" instead of raw ID
            const isId = snippet.length > 20 || (!isNaN(Number(snippet[0])) && snippet.length > 8);
            
            // Safe translation helper
            const getLabel = (key: string) => {
                return t.has(key)
                    ? t(key)
                    : key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' ');
            };

            const label = isId ? getLabel('detail') : getLabel(snippet);

            return {
                title: isLast ? (
                    <span style={{ color: token.colorText, fontWeight: 600 }}>{label}</span>
                ) : (
                    <Link href={url as any}>{label}</Link>
                ),
                key: url,
            };
        }).filter(item => item !== null),
    ];

    return (
        <div style={{
            padding: '12px 32px',
            background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc',
            borderBottom: isDark ? 'none' : `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'all 0.3s ease'
        }}>
            <Breadcrumb
                separator={<RightOutlined style={{ fontSize: 10, color: '#94a3b8' }} />}
                items={breadcrumbItems as any}
                style={{ fontSize: '13px' }}
            />
            
            <style jsx global>{`
                .ant-breadcrumb a {
                    color: #64748b !important;
                    transition: color 0.2s ease;
                    font-weight: 500;
                }
                .ant-breadcrumb a:hover {
                    color: ${token.colorPrimary} !important;
                }
                .ant-breadcrumb-link {
                    display: flex;
                    alignItems: center;
                }
            `}</style>
        </div>
    );
};

export default AdminBreadcrumb;
