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
    MailOutlined,
    LogoutOutlined,
    UserOutlined,
    WalletOutlined,
    ExportOutlined,
} from '@ant-design/icons';
import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import React, { useContext, useMemo, useState } from 'react';
import { AdminContext } from "@/context/admin.context";
import { useTheme } from '@/context/theme.context';
import { Avatar, Dropdown, Tag, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useParams } from 'next/navigation';
import AdminScrollArea from './admin.scroll-area';

const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

interface IProps {
    session: Session | null;
}

const groupKeys = [
    'grp-main',
    'grp-master',
    'grp-sales',
    'grp-purchase',
    'grp-logistics',
    'grp-finance',
    'grp-admin',
];

const AdminSideBar = ({ session }: IProps) => {
    const t = useTranslations('Sidebar');
    const tHeader = useTranslations('Header');
    const { Sider } = Layout;
    const { collapseMenu } = useContext(AdminContext)!;
    const pathname = usePathname();
    const params = useParams();
    const locale = params?.locale ?? 'vi';
    const { token } = theme.useToken();
    const { isDark } = useTheme();
    const [openKeys, setOpenKeys] = useState<string[]>(groupKeys);

    const userEmail = session?.user?.email ?? 'admin';
    const userName = session?.user?.name || userEmail.split('@')[0] || 'admin';
    const userInitial = (userName || userEmail || 'A').charAt(0).toUpperCase();
    const purchaseExceptionsLabel = (() => {
        try {
            return t('items.purchaseExceptions');
        } catch {
            return 'Ngoại lệ P2P/QC';
        }
    })();

    const exportDeliveriesLabel = (() => {
        try {
            return t('items.exportDeliveries');
        } catch {
            return 'Export Delivery';
        }
    })();

    const commercialInvoicesLabel = (() => {
        try {
            return t('items.commercialInvoices');
        } catch {
            return 'Commercial Invoices';
        }
    })();

    const getSelectedKey = () => {
        if (pathname?.includes('/dashboard/product')) return 'products';
        if (pathname?.includes('/dashboard/partners')) return 'partners';
        if (pathname?.includes('/dashboard/user')) return 'users';
        if (pathname?.includes('/dashboard/quotation')) return 'quotations';
        if (pathname?.includes('/dashboard/pricing-policies')) return 'pricing-policies';
        if (pathname?.includes('/dashboard/inquiry')) return 'inquiries';
        if (pathname?.includes('/dashboard/proforma-invoice')) return 'proforma-invoices';
        if (pathname?.includes('/dashboard/sales-contract')) return 'sales-contracts';
        if (pathname?.includes('/dashboard/commercial-invoices')) return 'commercial-invoices';
        if (pathname?.includes('/dashboard/purchase-request')) return 'purchase-requests';
        if (pathname?.includes('/dashboard/purchase-orders')) return 'purchase-orders';
        if (pathname?.includes('/dashboard/goods-receipt')) return 'goods-receipts';
        if (pathname?.includes('/dashboard/vendor-invoice')) return 'vendor-invoices';
        if (pathname?.includes('/dashboard/vendor-evaluations')) return 'vendor-evaluations';
        if (pathname?.includes('/dashboard/purchase/exceptions')) return 'purchase-exceptions';
        if (pathname?.includes('/dashboard/purchase-return')) return 'purchase-returns';
        if (pathname?.includes('/dashboard/shipment')) return 'shipments';
        if (pathname?.includes('/dashboard/document')) return 'export-documents';
        if (pathname?.includes('/dashboard/finance/lc')) return 'trade-finance-lc';
        if (pathname?.includes('/dashboard/finance/collections')) return 'trade-finance-collections';
        if (pathname?.includes('/dashboard/finance/general')) return 'trade-finance-general';
        if (pathname?.includes('/dashboard/account-receivables')) return 'account-receivables';
        if (pathname?.includes('/dashboard/account-payables')) return 'account-payables';
        if (pathname?.includes('/dashboard/accounting')) return 'accounting';
        if (pathname?.includes('/dashboard/inventory/counts')) return 'inventory-counts';
        if (pathname?.includes('/dashboard/inventory/returns')) return 'inventory-returns';
        if (pathname?.includes('/dashboard/inventory/export-deliveries')) return 'inventory-export-deliveries';
        if (pathname?.includes('/dashboard/inventory/ledger')) return 'inventory-ledger';
        if (pathname?.includes('/dashboard/inventory')) return 'inventory';
        if (pathname?.includes('/dashboard/settings')) return 'settings';
        if (pathname?.includes('/dashboard/approval-matrix')) return 'approval-matrix';
        if (pathname?.includes('/dashboard/approvals')) return 'approvals';
        return 'dashboard';
    };

    const items: MenuItem[] = useMemo(() => [
        {
            key: 'grp-main',
            label: t('groups.main'),
            icon: <AppstoreOutlined />,
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
                {
                    key: "approval-matrix",
                    label: <Link href={"/dashboard/approval-matrix"}>{t('items.approvalMatrix')}</Link>,
                    icon: <SafetyCertificateOutlined />,
                },
            ],
        },
        {
            key: 'grp-master',
            label: t('groups.masterData'),
            icon: <ApartmentOutlined />,
            children: [
                {
                    key: "partners",
                    label: <Link href={"/dashboard/partners"}>{t('items.partners')}</Link>,
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
                {
                    key: "inventory-counts",
                    label: <Link href={"/dashboard/inventory/counts"}>{t('items.inventoryCounts')}</Link>,
                    icon: <AuditOutlined />,
                },
                {
                    key: "inventory-export-deliveries",
                    label: <Link href={"/dashboard/inventory/export-deliveries"}>{exportDeliveriesLabel}</Link>,
                    icon: <ExportOutlined />,
                },
                {
                    key: "inventory-returns",
                    label: <Link href={"/dashboard/inventory/returns"}>{t('items.inventoryReturns')}</Link>,
                    icon: <RollbackOutlined />,
                },
            ],
        },
        {
            key: 'grp-sales',
            label: t('groups.sales'),
            icon: <FileTextOutlined />,
            children: [
                {
                    key: "inquiries",
                    label: <Link href={"/dashboard/inquiry"}>{t('items.inquiries')}</Link>,
                    icon: <MailOutlined />,
                },
                {
                    key: "quotations",
                    label: <Link href={"/dashboard/quotation"}>{t('items.quotations')}</Link>,
                    icon: <FileTextOutlined />,
                },
                {
                    key: "pricing-policies",
                    label: <Link href={"/dashboard/pricing-policies"}>{t('items.pricingPolicies')}</Link>,
                    icon: <DollarOutlined />,
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
                {
                    key: "commercial-invoices",
                    label: <Link href={"/dashboard/commercial-invoices"}>{commercialInvoicesLabel}</Link>,
                    icon: <FileTextOutlined />,
                },
            ],
        },
        {
            key: 'grp-purchase',
            label: t('groups.purchase'),
            icon: <ShoppingCartOutlined />,
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
                    key: "vendor-evaluations",
                    label: <Link href={"/dashboard/vendor-evaluations"}>{t('items.vendorEvaluations')}</Link>,
                    icon: <AuditOutlined />,
                },
                {
                    key: "purchase-returns",
                    label: <Link href={"/dashboard/purchase-return"}>{t('items.purchaseReturns')}</Link>,
                    icon: <RollbackOutlined />,
                },
                {
                    key: "purchase-exceptions",
                    label: <Link href={"/dashboard/purchase/exceptions"}>{purchaseExceptionsLabel}</Link>,
                    icon: <AuditOutlined />,
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
            icon: <GlobalOutlined />,
            children: [
                {
                    key: "shipments",
                    label: <Link href={"/dashboard/shipment"}>{t('items.shipments')}</Link>,
                    icon: <GlobalOutlined />,
                },
                {
                    key: "export-documents",
                    label: <Link href={"/dashboard/document"}>{t('items.exportDocuments')}</Link>,
                    icon: <FileTextOutlined />,
                },
            ],
        },
        {
            key: 'grp-finance',
            label: t('groups.finance'),
            icon: <DollarOutlined />,
            children: [
                {
                    key: "trade-finance-lc",
                    label: <Link href={"/dashboard/finance/lc"}>{t('items.lc')}</Link>,
                    icon: <SafetyCertificateOutlined />,
                },
                {
                    key: "trade-finance-collections",
                    label: <Link href={"/dashboard/finance/collections"}>{t('items.collections')}</Link>,
                    icon: <AuditOutlined />,
                },
                {
                    key: "trade-finance-general",
                    label: <Link href={"/dashboard/finance/general"}>{t('items.paymentTT')}</Link>,
                    icon: <TransactionOutlined />,
                },
                {
                    key: "account-receivables",
                    label: <Link href={"/dashboard/account-receivables"}>{t('items.accountReceivables')}</Link>,
                    icon: <WalletOutlined />,
                },
                {
                    key: "account-payables",
                    label: <Link href={"/dashboard/account-payables"}>Công nợ NCC</Link>,
                    icon: <WalletOutlined />,
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
            icon: <TeamOutlined />,
            children: [
                {
                    key: "users",
                    label: <Link href={"/dashboard/user"}>{t('items.users')}</Link>,
                    icon: <TeamOutlined />,
                },
            ],
        },
    ], [t, purchaseExceptionsLabel, exportDeliveriesLabel, commercialInvoicesLabel]);

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'info',
            label: (
                <div style={{ padding: '4px 0', minWidth: 180 }}>
                    <Text strong style={{ display: 'block' }}>{userName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{userEmail}</Text>
                    <Tag color="blue" style={{ marginTop: 6 }}>{tHeader('role')}</Tag>
                </div>
            ),
            disabled: true,
        },
        { type: 'divider' },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: <Link href="/dashboard/settings/system">{tHeader('settings')}</Link>,
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            danger: true,
            label: tHeader('logout'),
            onClick: () => signOut({ callbackUrl: `/${locale}/auth/login` }),
        },
    ];

    return (
        <Sider
            collapsed={collapseMenu}
            width={260}
            theme={isDark ? 'dark' : 'light'}
            className="admin-sidebar-shell"
            style={{
                height: '100vh',
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 101,
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
                backdropFilter: 'blur(20px)',
                borderRight: isDark ? 'none' : '1px solid #e2e8f0',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
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
                        }}>
                            ERP EXPORT
                        </div>
                    </div>
                )}
            </div>

            <AdminScrollArea
                className="sidebar-menu-scroll"
                overflowY="auto"
                padding="16px 12px 12px"
                style={{
                    flex: 1,
                    minHeight: 0,
                }}
            >
                <Menu
                    theme={isDark ? 'dark' : 'light'}
                    mode="inline"
                    selectedKeys={[getSelectedKey()]}
                    openKeys={collapseMenu ? undefined : openKeys}
                    onOpenChange={(keys) => setOpenKeys(keys as string[])}
                    items={items}
                    className="premium-menu"
                    style={{
                        borderRight: 0,
                        background: 'transparent',
                    }}
                />
            </AdminScrollArea>

            <Dropdown
                menu={{ items: userMenuItems }}
                placement="topRight"
                trigger={['click']}
            >
                <div
                    className="sidebar-user-trigger"
                    style={{
                        margin: collapseMenu ? '12px 8px 16px' : '12px 14px 16px',
                        padding: collapseMenu ? '10px 0' : '10px 12px',
                        borderRadius: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapseMenu ? 'center' : 'flex-start',
                        gap: 12,
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.04)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.06)'}`,
                        flexShrink: 0,
                    }}
                >
                    <Avatar
                        size={36}
                        icon={<UserOutlined />}
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                            fontWeight: 700,
                            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
                            flexShrink: 0,
                        }}
                    >
                        {userInitial}
                    </Avatar>
                    {!collapseMenu && (
                        <div style={{ minWidth: 0, lineHeight: 1.2 }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: token.colorText,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {userName}
                            </div>
                            <div style={{
                                fontSize: 10,
                                color: token.colorTextDescription,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                whiteSpace: 'nowrap',
                            }}>
                                {tHeader('role')}
                            </div>
                        </div>
                    )}
                </div>
            </Dropdown>

            <style jsx global>{`
                .admin-sidebar-shell .ant-layout-sider-children {
                    height: 100%;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .sidebar-menu-scroll {
                    overscroll-behavior: contain;
                }
                .premium-menu {
                    min-height: 0;
                }
                .premium-menu .ant-menu-submenu-title,
                .premium-menu .ant-menu-item {
                    border-radius: 12px !important;
                    margin: 4px 0 !important;
                    height: 46px !important;
                    line-height: 46px !important;
                    color: ${isDark ? '#94a3b8' : '#1e293b'} !important;
                    opacity: 1 !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .premium-menu .ant-menu,
                .premium-menu .ant-menu-sub,
                .premium-menu .ant-menu-sub.ant-menu-inline,
                .premium-menu .ant-menu-submenu .ant-menu {
                    background: transparent !important;
                }
                .premium-menu .ant-menu-submenu-title {
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.8px !important;
                    color: ${isDark ? '#64748b' : '#94a3b8'} !important;
                }
                .premium-menu .ant-menu-item-selected {
                    background: ${isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)'} !important;
                    color: #3b82f6 !important;
                    font-weight: 600 !important;
                }
                .premium-menu .ant-menu-item-selected .ant-menu-item-icon {
                    color: #3b82f6 !important;
                }
                .premium-menu .ant-menu-submenu-title:hover,
                .premium-menu .ant-menu-item:hover,
                .sidebar-user-trigger:hover {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'} !important;
                    color: ${isDark ? '#fff' : '#0f172a'} !important;
                }
            `}</style>
        </Sider>
    )
}

export default AdminSideBar;
