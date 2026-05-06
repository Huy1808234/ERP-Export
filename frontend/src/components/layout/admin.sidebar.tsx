'use client'
import Layout from "antd/es/layout";
import Menu from "antd/es/menu";
import {
    AppstoreOutlined,
    TeamOutlined,
    BarcodeOutlined,
    ApartmentOutlined,
    FileTextOutlined,
    ShoppingCartOutlined,
    GlobalOutlined,
    FileDoneOutlined,
    DollarOutlined,
    RollbackOutlined,
    HistoryOutlined,
    TransactionOutlined,
    StockOutlined,
    SettingOutlined,
    SafetyCertificateOutlined,
    AuditOutlined,
} from '@ant-design/icons';
import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import React, { useContext, useEffect, useRef } from 'react';
import { AdminContext } from "@/library/admin.context";
import { useTheme } from '@/library/theme.context';
import { theme } from 'antd';
import type { MenuProps } from 'antd';

type MenuItem = Required<MenuProps>['items'][number];

const AdminSideBar = () => {
    const t = useTranslations('Sidebar');
    const { Sider } = Layout;
    const { collapseMenu } = useContext(AdminContext)!;
    const pathname = usePathname();

    const getSelectedKey = () => {
        if (pathname?.includes('/dashboard/product')) return 'products';
        if (pathname?.includes('/dashboard/partner')) return 'partners';
        if (pathname?.includes('/dashboard/user')) return 'users';
        if (pathname?.includes('/dashboard/quotation')) return 'quotations';
        if (pathname?.includes('/dashboard/proforma-invoice')) return 'proforma-invoices';
        if (pathname?.includes('/dashboard/sales-contract')) return 'sales-contracts';
        if (pathname?.includes('/dashboard/purchase-request')) return 'purchase-requests';
        if (pathname?.includes('/dashboard/purchase-order')) return 'purchase-orders';
        if (pathname?.includes('/dashboard/goods-receipt')) return 'goods-receipts';
        if (pathname?.includes('/dashboard/vendor-invoice')) return 'vendor-invoices';
        if (pathname?.includes('/dashboard/purchase-return')) return 'purchase-returns';
        if (pathname?.includes('/dashboard/shipment')) return 'shipments';
        if (pathname?.includes('/dashboard/finance/lc')) return 'trade-finance-lc';
        if (pathname?.includes('/dashboard/finance/general')) return 'trade-finance-general';
        if (pathname?.includes('/dashboard/accounting')) return 'accounting';
        if (pathname?.includes('/dashboard/inventory/ledger')) return 'inventory-ledger';
        if (pathname?.includes('/dashboard/inventory')) return 'inventory';
        if (pathname?.includes('/dashboard/settings/currencies')) return 'currencies';
        if (pathname?.includes('/dashboard/approvals')) return 'approvals';
        return 'dashboard';
    };

    const items: MenuItem[] = [
        // ... (existing code grp-main)
        {
            key: 'grp-main',
            label: t('groups.main'),
            type: 'group',
            children: [
                {
                    key: "dashboard",
                    label: <Link href={"/dashboard"}>{t('items.overview')}</Link>,
                    icon: <AppstoreOutlined />,
                },
                {
                    key: "approvals",
                    label: <Link href={"/dashboard/approvals"}>{t('items.approvals')}</Link>,
                    icon: <SafetyCertificateOutlined />,
                },
            ],
        },
        {
            key: 'grp-master',
            label: t('groups.masterData'),
            type: 'group',
            children: [
                {
                    key: "partners",
                    label: <Link href={"/dashboard/partner"}>{t('items.partners')}</Link>,
                    icon: <ApartmentOutlined />,
                },
                {
                    key: "products",
                    label: <Link href={"/dashboard/product"}>{t('items.products')}</Link>,
                    icon: <BarcodeOutlined />,
                },
                {
                    key: "inventory",
                    label: <Link href={"/dashboard/inventory"}>{t('items.inventory')}</Link>,
                    icon: <StockOutlined />,
                },
                {
                    key: "inventory-ledger",
                    label: <Link href={"/dashboard/inventory/ledger"}>{t('items.inventoryLedger')}</Link>,
                    icon: <HistoryOutlined />,
                },
            ],
        },
        // ... (existing code grp-sales, grp-purchase, grp-logistics)
        {
            key: 'grp-sales',
            label: t('groups.sales'),
            type: 'group',
            children: [
                {
                    key: "quotations",
                    label: <Link href={"/dashboard/quotation"}>{t('items.quotations')}</Link>,
                    icon: <FileTextOutlined />,
                },
                {
                    key: "proforma-invoices",
                    label: <Link href={"/dashboard/proforma-invoice"}>{t('items.proformaInvoices')}</Link>,
                    icon: <FileDoneOutlined />,
                },
                {
                    key: "sales-contracts",
                    label: <Link href={"/dashboard/sales-contract"}>{t('items.salesContracts')}</Link>,
                    icon: <FileDoneOutlined />,
                },
            ],
        },
        {
            key: 'grp-purchase',
            label: t('groups.purchase'),
            type: 'group',
            children: [
                {
                    key: "purchase-requests",
                    label: <Link href={"/dashboard/purchase-request"}>{t('items.purchaseRequests')}</Link>,
                    icon: <FileTextOutlined />,
                },
                {
                    key: "purchase-orders",
                    label: <Link href={"/dashboard/purchase-orders"}>{t('items.purchaseOrders')}</Link>,
                    icon: <ShoppingCartOutlined />,
                },
                {
                    key: "goods-receipts",
                    label: <Link href={"/dashboard/goods-receipt"}>{t('items.goodsReceipts')}</Link>,
                    icon: <BarcodeOutlined />,
                },
                {
                    key: "vendor-invoices",
                    label: <Link href={"/dashboard/vendor-invoice"}>{t('items.vendorInvoices')}</Link>,
                    icon: <FileDoneOutlined />,
                },
                {
                    key: "purchase-returns",
                    label: <Link href={"/dashboard/purchase-return"}>{t('items.purchaseReturns')}</Link>,
                    icon: <RollbackOutlined />,
                },
                {
                    key: "purchase-matching",
                    label: <Link href={"/dashboard/purchase/matching"}>{t('items.threeWayMatching')}</Link>,
                    icon: <AuditOutlined />,
                },
            ],
        },
        {
            key: 'grp-logistics',
            label: t('groups.logistics'),
            type: 'group',
            children: [
                {
                    key: "shipments",
                    label: <Link href={"/dashboard/shipment"}>{t('items.shipments')}</Link>,
                    icon: <GlobalOutlined />,
                },
            ],
        },
        {
            key: 'grp-finance',
            label: t('groups.finance'),
            type: 'group',
            children: [
                {
                    key: "trade-finance-lc",
                    label: <Link href={"/dashboard/finance/lc"}>{t('items.lc')}</Link>,
                    icon: <SafetyCertificateOutlined />,
                },
                {
                    key: "trade-finance-general",
                    label: <Link href={"/dashboard/finance/general"}>{t('items.paymentTT')}</Link>,
                    icon: <TransactionOutlined />,
                },
                {
                    key: "accounting",
                    label: <Link href={"/dashboard/accounting"}>{t('items.finance')}</Link>,
                    icon: <DollarOutlined />,
                },
            ],
        },
        {
            key: 'grp-admin',
            label: t('groups.admin'),
            type: 'group',
            children: [
                {
                    key: "users",
                    label: <Link href={"/dashboard/user"}>{t('items.users')}</Link>,
                    icon: <TeamOutlined />,
                },
                {
                    key: "currencies",
                    label: <Link href={"/dashboard/settings/currencies"}>{t('items.currencies')}</Link>,
                    icon: <HistoryOutlined />,
                },
            ],
        },
    ];

    const { token } = theme.useToken();
    const { isDark } = useTheme();

    return (
        <Sider
            collapsed={collapseMenu}
            width={260}
            theme={isDark ? 'dark' : 'light'}
            className="custom-sidebar-scroll"
            style={{
                height: '100vh',
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 101,
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
                backdropFilter: 'blur(20px)',
                borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
            }}
        >
            <div style={{
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapseMenu ? 'center' : 'flex-start',
                padding: collapseMenu ? 0 : '0 24px',
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'all 0.3s',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}`
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)',
                    flexShrink: 0
                }}>
                    <GlobalOutlined style={{ color: '#fff', fontSize: 22 }} />
                </div>
                {!collapseMenu && (
                    <div style={{ marginLeft: 14 }}>
                        <div style={{
                            color: isDark ? '#fff' : '#1e293b',
                            fontWeight: 800,
                            fontSize: 16,
                            whiteSpace: 'nowrap',
                            letterSpacing: -0.5
                        }}>
                            ERP EXPORT
                        </div>
                        <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                            Premium v2.0
                        </div>
                    </div>
                )}
            </div>

            <Menu
                theme={isDark ? 'dark' : 'light'}
                mode="inline"
                selectedKeys={[getSelectedKey()]}
                items={items}
                className="premium-menu"
                style={{
                    borderRight: 0,
                    background: 'transparent',
                    flex: 1,
                    padding: '16px 12px 24px',
                }}
            />

            <style jsx global>{`
                .premium-menu .ant-menu-item {
                    border-radius: 12px !important;
                    margin: 4px 0 !important;
                    height: 48px !important;
                    line-height: 48px !important;
                    color: ${isDark ? '#94a3b8' : '#1e293b'} !important;
                    opacity: 1 !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .premium-menu .ant-menu-item-selected {
                    background: ${isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)'} !important;
                    color: #3b82f6 !important;
                    font-weight: 600 !important;
                }
                .premium-menu .ant-menu-item-selected .ant-menu-item-icon {
                    color: #3b82f6 !important;
                }
                .premium-menu .ant-menu-item-group-title {
                    padding-top: 24px !important;
                    padding-bottom: 8px !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 1px !important;
                    color: ${isDark ? '#475569' : '#94a3b8'} !important;
                }
                .premium-menu .ant-menu-item:hover {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'} !important;
                    color: ${isDark ? '#fff' : '#0f172a'} !important;
                }
                /* Custom Scrollbar for Sidebar */
                .custom-sidebar-scroll::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-sidebar-scroll::-webkit-scrollbar-thumb {
                    background: ${isDark ? '#1e293b' : '#e2e8f0'};
                    border-radius: 10px;
                }
            `}</style>
        </Sider>
    )

}

export default AdminSideBar;
