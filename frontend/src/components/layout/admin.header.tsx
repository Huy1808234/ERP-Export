'use client'

import { AdminContext } from '@/context/admin.context';
import {
    BellOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    MoonOutlined,
    SearchOutlined,
    SunOutlined,
} from '@ant-design/icons';
import { Badge, Button, Empty, Input, Layout, Popover, Space, Spin, Tag, Tooltip, Typography, theme } from 'antd';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import LocaleSwitcher from './locale.switcher';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/context/theme.context';
import { usePathname, useRouter } from 'next/navigation';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { searchService, type GlobalSearchResult } from '@/services/search.service';

const { Text } = Typography;

type HeaderSearchResult = GlobalSearchResult | {
    _id: string;
    type: 'MENU';
    title: string;
    subtitle: string | null;
    status: string | null;
    targetHref: string;
    updatedAt: null;
    matchedFields: string[];
};

const SEARCHABLE_MENUS: HeaderSearchResult[] = [
    {
        _id: 'menu-product',
        type: 'MENU',
        title: 'Danh mục sản phẩm',
        subtitle: 'Product Catalog / SKU / HS code',
        status: null,
        targetHref: '/dashboard/product',
        updatedAt: null,
        matchedFields: ['sản phẩm', 'san pham', 'product', 'sku', 'hs code'],
    },
    {
        _id: 'menu-partners',
        type: 'MENU',
        title: 'Đối tác toàn cầu',
        subtitle: 'Customers, vendors, buyers',
        status: null,
        targetHref: '/dashboard/partners',
        updatedAt: null,
        matchedFields: ['đối tác', 'doi tac', 'partner', 'buyer', 'vendor', 'khách hàng'],
    },
    {
        _id: 'menu-quotation',
        type: 'MENU',
        title: 'Báo giá bán hàng',
        subtitle: 'Quotation',
        status: null,
        targetHref: '/dashboard/quotation',
        updatedAt: null,
        matchedFields: ['báo giá', 'bao gia', 'quotation', 'quote'],
    },
    {
        _id: 'menu-pi',
        type: 'MENU',
        title: 'Hóa đơn chiếu lệ',
        subtitle: 'Proforma Invoice',
        status: null,
        targetHref: '/dashboard/proforma-invoice',
        updatedAt: null,
        matchedFields: ['pi', 'proforma', 'hóa đơn chiếu lệ', 'hoa don chieu le'],
    },
    {
        _id: 'menu-shipment',
        type: 'MENU',
        title: 'Logistics toàn cầu',
        subtitle: 'Shipment',
        status: null,
        targetHref: '/dashboard/shipment',
        updatedAt: null,
        matchedFields: ['shipment', 'logistics', 'lô hàng', 'lo hang'],
    },
    {
        _id: 'menu-inventory',
        type: 'MENU',
        title: 'Tồn kho Real-time',
        subtitle: 'Inventory',
        status: null,
        targetHref: '/dashboard/inventory',
        updatedAt: null,
        matchedFields: ['inventory', 'kho', 'tồn kho', 'ton kho'],
    },
];

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

const AdminHeader = () => {
    const { token } = theme.useToken();
    const { isDark, setThemeMode } = useTheme();
    const t = useTranslations('Header');
    const { Header } = Layout;
    const { collapseMenu, setCollapseMenu } = useContext(AdminContext)!;
    const router = useRouter();
    const pathname = usePathname();
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<HeaderSearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const {
        notifications,
        unreadCount,
        hasNewNotification,
        markAsRead,
        markAllAsRead,
        clearNewFlag,
    } = useNotifications();

    const toggleTheme = () => {
        setThemeMode(isDark ? 'light' : 'dark');
    };

    const safeHeaderText = useCallback((key: string, fallback: string) => {
        try {
            return t(key);
        } catch {
            return fallback;
        }
    }, [t]);

    const locale = useMemo(() => pathname.split('/').filter(Boolean)[0] || 'vi', [pathname]);

    useEffect(() => {
        const keyword = searchText.trim();
        if (keyword.length < 2) {
            setSearchResults([]);
            setSearchLoading(false);
            return;
        }

        let isActive = true;
        setSearchLoading(true);
        const timeoutId = window.setTimeout(async () => {
            try {
                const normalizedKeyword = normalizeSearchText(keyword);
                const menuResults = SEARCHABLE_MENUS.filter((item) =>
                    [item.title, item.subtitle || '', ...item.matchedFields]
                        .map(normalizeSearchText)
                        .some((value) => value.includes(normalizedKeyword)),
                );
                const response = await searchService.globalSearch(keyword, 12);
                if (!isActive) return;
                setSearchResults([...menuResults, ...(response.data?.results || [])].slice(0, 12));
            } catch {
                if (!isActive) return;
                const normalizedKeyword = normalizeSearchText(keyword);
                setSearchResults(
                    SEARCHABLE_MENUS.filter((item) =>
                        [item.title, item.subtitle || '', ...item.matchedFields]
                            .map(normalizeSearchText)
                            .some((value) => value.includes(normalizedKeyword)),
                    ),
                );
            } finally {
                if (isActive) setSearchLoading(false);
            }
        }, 300);

        return () => {
            isActive = false;
            window.clearTimeout(timeoutId);
        };
    }, [searchText]);

    const openNotification = (notification: AppNotification) => {
        markAsRead(notification.id);
        if (!notification.targetHref) return;

        router.push(`/${locale}${notification.targetHref}`);
    };

    const openSearchResult = useCallback((result: HeaderSearchResult) => {
        setSearchOpen(false);
        setSearchText('');
        setSearchResults([]);
        router.push(`/${locale}${result.targetHref}`);
    }, [locale, router]);

    const menuSearchResults = searchResults.filter((result) => result.type === 'MENU');
    const recordSearchResults = searchResults.filter((result) => result.type !== 'MENU');

    const searchTypeLabel = (type: HeaderSearchResult['type']) => {
        const labels: Record<string, string> = {
            MENU: safeHeaderText('searchTypeMenu', 'Navigation'),
            PRODUCT: safeHeaderText('searchTypeProduct', 'Product'),
            PARTNER: safeHeaderText('searchTypePartner', 'Partner'),
            QUOTATION: safeHeaderText('searchTypeQuotation', 'Quotation'),
            PROFORMA_INVOICE: safeHeaderText('searchTypePi', 'PI'),
            SALES_CONTRACT: safeHeaderText('searchTypeContract', 'Contract'),
            PURCHASE_REQUEST: safeHeaderText('searchTypePr', 'PR'),
            PURCHASE_ORDER: safeHeaderText('searchTypePo', 'PO'),
            SHIPMENT: safeHeaderText('searchTypeShipment', 'Shipment'),
            COMMERCIAL_INVOICE: safeHeaderText('searchTypeCi', 'CI'),
            EXPORT_DOCUMENT: safeHeaderText('searchTypeExportDocument', 'Export document'),
            ACCOUNT_RECEIVABLE: safeHeaderText('searchTypeAr', 'AR'),
            ACCOUNT_PAYABLE: safeHeaderText('searchTypeAp', 'AP'),
        };

        return labels[type] || String(type).replace(/_/g, ' ');
    };

    const renderSearchResult = (result: HeaderSearchResult) => (
        <div
            key={result._id}
            onClick={() => openSearchResult(result)}
            style={{
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#fff',
            }}
        >
            <Space size={8} wrap>
                <Text strong>{result.title}</Text>
                <Tag color={result.type === 'MENU' ? 'geekblue' : 'blue'} style={{ marginInlineEnd: 0 }}>
                    {searchTypeLabel(result.type)}
                </Tag>
                {result.status ? <Tag style={{ marginInlineEnd: 0 }}>{result.status}</Tag> : null}
            </Space>
            <div style={{ marginTop: 4 }}>
                <Text style={{ color: token.colorTextSecondary }}>{result.subtitle || result._id}</Text>
            </div>
        </div>
    );

    const renderSearchSection = (title: string, results: HeaderSearchResult[]) => {
        if (results.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                    {title}
                </Text>
                {results.map(renderSearchResult)}
            </div>
        );
    };

    const notificationPanel = (
        <div style={{ width: 340, maxWidth: 'calc(100vw - 48px)' }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>{t('notifications')}</Text>
                <Button type="link" size="small" onClick={markAllAsRead} disabled={!notifications.length}>
                    {t('markAllRead')}
                </Button>
            </Space>
            {notifications.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noNotifications')} />
            ) : (
                <div>
                    {notifications.slice(0, 8).map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => openNotification(notification)}
                            style={{
                                cursor: notification.targetHref ? 'pointer' : 'default',
                                padding: '10px 4px',
                                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            }}
                        >
                            <Space size={6} wrap>
                                <Text strong>{notification.title}</Text>
                                <Badge color={notification.kind === 'APPROVAL' ? 'blue' : 'green'} />
                            </Space>
                            <Space orientation="vertical" size={0} style={{ display: 'flex', marginTop: 4 }}>
                                <Text type="secondary">{notification.body}</Text>
                                {notification.documentNumber ? <Text code>{notification.documentNumber}</Text> : null}
                            </Space>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const searchPanel = (
        <div style={{ width: 420, maxWidth: 'calc(100vw - 48px)' }}>
            {searchLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <Spin size="small" />
                </div>
            ) : (
                searchResults.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            searchText.trim().length < 2
                                ? safeHeaderText('searchHint', 'Type at least 2 characters')
                                : safeHeaderText('searchNoResults', 'No matching records')
                        }
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {renderSearchSection(safeHeaderText('searchNavigationGroup', 'Navigation'), menuSearchResults)}
                        {renderSearchSection(safeHeaderText('searchDataGroup', 'Business data'), recordSearchResults)}
                    </div>
                )
            )}
        </div>
    );

    return (
        <Header
            style={{
                padding: '0 32px 0 0',
                display: 'flex',
                background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: isDark ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                height: 80,
                flexShrink: 0,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <Tooltip title={collapseMenu ? t('expandMenu') : t('collapseMenu')}>
                <Button
                    type="text"
                    icon={collapseMenu ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setCollapseMenu(!collapseMenu)}
                    style={{ fontSize: 20, width: 80, height: 80, color: token.colorTextSecondary }}
                />
            </Tooltip>

            <Space size={24} align="center">
                <Popover
                    trigger="click"
                    placement="bottomRight"
                    content={searchPanel}
                    open={searchOpen}
                    onOpenChange={setSearchOpen}
                >
                    <Input
                        allowClear
                        prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                        placeholder={safeHeaderText('searchPlaceholder', 'Search documents, products...')}
                        value={searchText}
                        onFocus={() => setSearchOpen(true)}
                        onChange={(event) => {
                            setSearchText(event.target.value);
                            setSearchOpen(true);
                        }}
                        onPressEnter={() => {
                            const firstResult = searchResults[0];
                            if (firstResult) openSearchResult(firstResult);
                        }}
                        style={{ width: 320, borderRadius: 12 }}
                    />
                </Popover>

                <div className="premium-glass" style={{ borderRadius: 12, padding: '2px 8px' }}>
                    <LocaleSwitcher />
                </div>

                <Tooltip title={isDark ? t('lightMode') : t('darkMode')}>
                    <Button
                        type="text"
                        shape="circle"
                        icon={isDark ? <SunOutlined style={{ fontSize: 20, color: '#fbbf24' }} /> : <MoonOutlined style={{ fontSize: 20, color: '#6366f1' }} />}
                        onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
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

                <Popover
                    trigger="click"
                    placement="bottomRight"
                    content={notificationPanel}
                    onOpenChange={(open) => { if (open) clearNewFlag(); }}
                >
                    <Tooltip title={t('notifications')}>
                        <Badge count={unreadCount} dot={hasNewNotification && unreadCount === 0} size="small">
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
                </Popover>
            </Space>
        </Header>
    );
};

export default AdminHeader;
