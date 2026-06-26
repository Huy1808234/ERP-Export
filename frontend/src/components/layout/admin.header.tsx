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
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    buildSearchableModuleResults,
    type SearchableModuleResult,
} from '@/config/searchable-modules';
import { useTheme } from '@/context/theme.context';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { searchService, type GlobalSearchResult } from '@/services/search.service';
import type { IAuthSessionUser } from '@/types/next-auth';
import LocaleSwitcher from './locale.switcher';
import AdminNotificationPanel from './admin.notification';

const { Text } = Typography;

type HeaderSearchResult = GlobalSearchResult | SearchableModuleResult;

const SEARCH_RESULT_LIMIT = 20;

function getSearchRoleName(user?: IAuthSessionUser | null): string | null {
    return user?.role?.name || user?.roleName || null;
}

function parseInternalHref(targetHref: string): any {
    // Next.js App Router (and next-intl wrapper) router.push() accepts a full string with query params.
    // Returning an object { pathname, query } will crash or fail silently.
    return targetHref;
}

const AdminHeader = () => {
    const { token } = theme.useToken();
    const { isDark, setThemeMode } = useTheme();
    const t = useTranslations('Header');
    const tSidebar = useTranslations('Sidebar');
    const { Header } = Layout;
    const { collapseMenu, setCollapseMenu } = useContext(AdminContext)!;
    const router = useRouter();
    const { data: session } = useSession();
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
        refreshNotifications,
    } = useNotifications();

    const toggleTheme = () => {
        setThemeMode(isDark ? 'light' : 'dark');
    };

    const safeHeaderText = useCallback((key: string, fallback: string) => {
        return t.has(key) ? t(key) : fallback;
    }, [t]);

    const safeSidebarText = useCallback((key: string, fallback: string) => {
        return tSidebar.has(key) ? tSidebar(key) : fallback;
    }, [tSidebar]);

    const roleName = useMemo(() => getSearchRoleName(session?.user), [session?.user]);

    const getMenuResults = useCallback((keyword: string) => (
        buildSearchableModuleResults({
            keyword,
            roleName,
            translateTitle: safeSidebarText,
        })
    ), [roleName, safeSidebarText]);

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
                const menuResults = getMenuResults(keyword);
                const response = await searchService.globalSearch(keyword, SEARCH_RESULT_LIMIT);
                if (!isActive) return;
                setSearchResults([...menuResults, ...(response.data?.results || [])].slice(0, SEARCH_RESULT_LIMIT));
            } catch {
                if (!isActive) return;
                setSearchResults(getMenuResults(keyword));
            } finally {
                if (isActive) setSearchLoading(false);
            }
        }, 300);

        return () => {
            isActive = false;
            window.clearTimeout(timeoutId);
        };
    }, [getMenuResults, searchText]);

    const openNotification = (notification: AppNotification) => {
        markAsRead(notification.id);
        if (!notification.targetHref) return;

        router.push(parseInternalHref(notification.targetHref));
    };

    const openSearchResult = useCallback((result: HeaderSearchResult) => {
        setSearchOpen(false);
        setSearchText('');
        setSearchResults([]);
        router.push(parseInternalHref(result.targetHref));
    }, [router]);

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
            INQUIRY: safeHeaderText('searchTypeInquiry', 'Inquiry'),
            PRICING_POLICY: safeHeaderText('searchTypePricingPolicy', 'Pricing policy'),
            GOODS_RECEIPT: safeHeaderText('searchTypeGoodsReceipt', 'GRN'),
            VENDOR_INVOICE: safeHeaderText('searchTypeVendorInvoice', 'Vendor invoice'),
            PURCHASE_RETURN: safeHeaderText('searchTypePurchaseReturn', 'Purchase return'),
            INVENTORY_COUNT: safeHeaderText('searchTypeInventoryCount', 'Inventory count'),
            EXPORT_DELIVERY: safeHeaderText('searchTypeExportDelivery', 'Export delivery'),
            CUSTOMER_RETURN: safeHeaderText('searchTypeCustomerReturn', 'Customer return'),
            LETTER_OF_CREDIT: safeHeaderText('searchTypeLc', 'L/C'),
            COLLECTION_ORDER: safeHeaderText('searchTypeCollection', 'Collection'),
            TRADE_FINANCE_TRANSACTION: safeHeaderText('searchTypePayment', 'Payment'),
            JOURNAL_ENTRY: safeHeaderText('searchTypeJournal', 'Journal'),
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
        <AdminNotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onOpenNotification={openNotification}
            onMarkAllAsRead={markAllAsRead}
            onRefresh={refreshNotifications}
            locale="vi"
        />
    );

    const searchPanel = (
        <div style={{ width: 460, maxWidth: 'calc(100vw - 48px)', maxHeight: '70vh', overflowY: 'auto' }}>
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
