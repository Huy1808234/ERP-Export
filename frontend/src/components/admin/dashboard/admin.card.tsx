'use client'

import {
    ApartmentOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DollarOutlined,
    DownloadOutlined,
    FileDoneOutlined,
    GlobalOutlined,
    ShoppingCartOutlined,
    TruckOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Statistic, Tag, Timeline, Typography, Avatar, Space, Button, DatePicker, Skeleton, theme } from 'antd';
import { useEffect, useState } from 'react';
import { useTheme } from '@/library/theme.context';
import Link from 'next/link';
import {
    ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardService } from '@/services/dashboard.service';
import dayjs from 'dayjs';
import { MoreOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { Dropdown, Tabs } from 'antd';

import { useTranslations } from 'next-intl';
import { useCurrency } from '@/hooks/useCurrency';
import { GLOBAL_EXCHANGE_RATE } from '@/constants/currency.config';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SHIP_STATUS_COLOR: Record<string, string> = {
    BOOKED: 'blue', LOADING: 'orange', CUSTOMS_CLEARED: 'cyan', ON_BOARD: 'geekblue', ARRIVED: 'green', CLOSED: 'default',
};
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminDashboard = () => {
    const t = useTranslations('Dashboard');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
    const [currency, setCurrency] = useState<'VND' | 'USD'>('VND');
    const [activePartnerTab, setActivePartnerTab] = useState<'1' | '2'>('1');

    const { token } = theme.useToken();
    const { isDark } = useTheme();
    const { formatVND, formatMoney, formatCompact } = useCurrency();

    const fetchDashboardData = async (start?: string, end?: string) => {
        setLoading(true);
        try {
            const res = await dashboardService.getExecutive(start, end);
            if (res?.data) {
                setData(res.data);
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu Dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData(dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
    }, [dateRange]);

    // Mapping dữ liệu từ Backend (director, sales, logistics)
    const kpis = {
        revenueVnd: data?.director?.revenueVnd || 0,
        poCount: data?.sales?.totalPIs || 0,
        activeShipments: data?.sales?.pendingShipments || 0,
        customerCount: data?.director?.totalCustomers || 0
    };
    
    const chartData = data?.director?.history?.map((item: any) => ({
        month: dayjs(item.month).format('MMM YYYY'),
        revenue: Math.round(item.revenue / 1000000), 
        orders: item.orders
    })) || [];

    const shipmentStats: { name: string, value: number }[] = data?.logistics?.statusBreakdown ? 
        Object.entries(data.logistics.statusBreakdown).map(([key, value]) => ({
            name: t(key.toLowerCase()),
            value: value as number
        })) : [];

    // Logic quy đổi USD tạm tính (Ưu tiên tỷ giá từ Backend, nếu không có dùng hằng số Global)
    const EXCHANGE_RATE = data?.director?.exchangeRate || GLOBAL_EXCHANGE_RATE;
    const displayRevenue = currency === 'VND'
        ? formatVND(kpis.revenueVnd)
        : formatMoney(kpis.revenueVnd / EXCHANGE_RATE, 'USD');

    const kpiSummary = [
        { 
            title: `${t('revenue')} (${currency})`, 
            value: displayRevenue, 
            icon: <DollarOutlined />, 
            color: '#3b82f6', 
            growth: data?.director?.revenueGrowth || 0,
            isUp: (data?.director?.revenueGrowth || 0) >= 0,
            extra: (
                <Space size={4} style={{ cursor: 'pointer', background: isDark ? '#334155' : '#e2e8f0', padding: '2px 8px', borderRadius: 8 }} onClick={() => setCurrency(currency === 'VND' ? 'USD' : 'VND')}>
                    <GlobalOutlined style={{ fontSize: 10 }} />
                    <span style={{ fontSize: 10, fontWeight: 800 }}>{currency === 'VND' ? 'VND' : 'USD'}</span>
                </Space>
            )
        },
        { title: t('orders'), value: kpis.poCount, icon: <ShoppingCartOutlined />, color: '#f59e0b', growth: data?.sales?.poGrowth || 0, isUp: true },
        { title: t('shipments'), value: kpis.activeShipments, icon: <TruckOutlined />, color: '#10b981', growth: data?.logistics?.shipmentGrowth || 0, isUp: (data?.logistics?.shipmentGrowth || 0) >= 0 },
        { title: t('customers'), value: kpis.customerCount, icon: <ApartmentOutlined />, color: '#8b5cf6', growth: 12.5, isUp: true },
    ];


    return (
        <div style={{ 
            padding: '24px', 
            backgroundColor: isDark ? '#0f172a' : token.colorBgLayout,
            minHeight: '100vh'
        }}>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isDark ? '#334155' : '#e2e8f0'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#475569' : '#cbd5e1'};
                }
            `}</style>
            {/* --- GLASSMORPHISM HEADER --- */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: 32,
                padding: '20px 24px',
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: 24,
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                border: isDark ? '1px solid #334155' : '1px solid rgba(255, 255, 255, 0.3)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: isDark ? '#f8fafc' : token.colorText, letterSpacing: -0.5 }}>{t('title')}</h1>
                    <Space size={8}>
                        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#94a3b8' : undefined }}>{t('subtitle')} • Real-time Monitoring</Text>
                        {data?.lastUpdated && (
                            <Tag color="processing" variant="filled" style={{ fontSize: 10, borderRadius: 6 }}>
                                Last Sync: {dayjs(data.lastUpdated).format('HH:mm:ss')}
                            </Tag>
                        )}
                    </Space>
                </div>
                <Space size="large">
                    <RangePicker 
                        value={dateRange}
                        onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                        }}
                        style={{ 
                            borderRadius: 14, 
                            height: 42, 
                            border: 'none', 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            background: isDark ? '#1e293b' : '#fff'
                        }} 
                    />
                    <Button icon={<DownloadOutlined />} size="large" style={{ borderRadius: 14, fontWeight: 600, height: 42 }}>{t('exportReport')}</Button>
                </Space>
            </div>

            {/* --- KPI CARDS --- */}
            <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                {kpiSummary.map((item, index) => (
                    <Col xs={24} sm={12} lg={6} key={index}>
                        <Card 
                            variant="borderless"
                            style={{ 
                                borderRadius: 24, 
                                boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                                background: isDark ? '#1e293b' : '#fff',
                                border: isDark ? '1px solid #334155' : '1px solid #f0f0f0',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s ease'
                            }}
                            className="kpi-card"
                        >
                            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <Space style={{ marginBottom: 8 }}>
                                            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: isDark ? '#94a3b8' : undefined }}>{item.title}</Text>
                                            {item.extra}
                                        </Space>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: isDark ? '#f8fafc' : token.colorText, letterSpacing: -1 }}>{item.value}</div>
                                    </div>
                                    <div style={{ 
                                        width: 52, height: 52, borderRadius: 16, 
                                        background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}dd 100%)`, 
                                        color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                                        boxShadow: `0 8px 16px -4px ${item.color}60`
                                    }}>
                                        {item.icon}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                                    <div style={{ 
                                        display: 'flex', alignItems: 'center', 
                                        padding: '2px 8px', borderRadius: 8,
                                        backgroundColor: item.isUp ? '#10b98115' : '#ef444415',
                                        color: item.isUp ? '#10b981' : '#ef4444',
                                        fontSize: 12, fontWeight: 700
                                    }}>
                                        {item.isUp ? <ArrowUpOutlined style={{ marginRight: 4 }} /> : <ArrowDownOutlined style={{ marginRight: 4 }} />}
                                        {Math.abs(item.growth)}%
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>vs last month</Text>
                                </div>
                            </Skeleton>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* --- CHARTS --- */}
            <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
                <Col xs={24} lg={16}>
                    <Card 
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>BIẾN ĐỘNG DOANH THU & SỐ LƯỢNG</Title>}
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%', 
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 10 }}>
                            <div style={{ height: 380, width: '100%', marginTop: 10 }}>
                                <ResponsiveContainer width="100%" height={380} minWidth={0}>
                                    <ComposedChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                                        <YAxis 
                                            yAxisId="left" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                                            tickFormatter={(value) => formatCompact(value)} 
                                        />
                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#f59e0b', fontSize: 11, fontWeight: 600}} />
                                        <RechartsTooltip 
                                            contentStyle={{ 
                                                borderRadius: 16, border: 'none', 
                                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                                background: isDark ? '#1e293b' : '#fff'
                                            }}
                                            itemStyle={{ fontWeight: 700 }}
                                            formatter={(value: any, name: any) => [
                                                name === 'Đơn hàng' ? value : `${formatCompact(value)} Triệu`,
                                                name
                                            ]}
                                        />
                                        <Legend verticalAlign="top" align="right" iconType="circle" height={36} />
                                        <Bar yAxisId="right" name="Đơn hàng" dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={30} opacity={0.8} />
                                        <Area yAxisId="left" type="monotone" name="Doanh thu (Triệu)" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fill="url(#colorRev)" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card 
                        title={<Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>TRẠNG THÁI VẬN ĐƠN (LIVE)</Title>}
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%', 
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 10 }}>
                            <div style={{ height: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                                    <PieChart>
                                        <Pie 
                                            data={shipmentStats} 
                                            innerRadius={70} 
                                            outerRadius={100} 
                                            paddingAngle={8} 
                                            dataKey="value"
                                            cornerRadius={12}
                                            stroke="none"
                                        >
                                            {shipmentStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', top: '35%', textAlign: 'center' }}>
                                    <div style={{ fontSize: 42, fontWeight: 900, color: isDark ? '#f8fafc' : token.colorText, lineHeight: 1 }}>{kpis.activeShipments}</div>
                                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 2, color: isDark ? '#94a3b8' : undefined }}>{t('shipments')}</Text>
                                </div>
                                <div style={{ width: '100%', marginTop: 20, padding: '0 20px' }}>
                                    <Row gutter={[8, 8]}>
                                        {shipmentStats.map((s, i) => (
                                            <Col span={12} key={i}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: isDark ? '#1e293b' : '#f8fafc' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i] }} />
                                                    <Text style={{ fontSize: 11, fontWeight: 600 }}>{s.name}: {s.value}</Text>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
            </Row>

            {/* --- ACTIONABLE INTELLIGENCE --- */}
            <Row gutter={[20, 20]}>
                {/* Low Stock Alerts */}
                <Col xs={24} lg={8}>
                    <Card
                        title={<Space><ClockCircleOutlined style={{ color: '#ef4444' }} /><Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{t('lowStock')}</Title></Space>}
                        extra={
                            <Space>
                                <Button type="link" size="small" style={{ fontSize: 12 }}>{t('viewAll')}</Button>
                                <Dropdown menu={{ items: [{ key: '1', label: t('refresh') }, { key: '2', label: t('settings') }] }} trigger={['click']}>
                                    <Button type="text" icon={<MoreOutlined />} size="small" />
                                </Dropdown>
                            </Space>
                        }
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%',
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                                {data?.lowStockProducts?.length > 0 ? (
                                    data.lowStockProducts.map((p: any, i: number) => (
                                        <motion.div 
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: i * 0.1 }}
                                            key={p.id} 
                                            style={{ 
                                                padding: '16px', 
                                                background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#fff', 
                                                borderRadius: 20,
                                                border: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <Space>
                                                    <Avatar shape="square" src={p.imageUrl} icon={<ShoppingCartOutlined />} style={{ background: '#ef444415', color: '#ef4444' }} />
                                                    <div>
                                                        <Text strong style={{ display: 'block', color: isDark ? '#f8fafc' : undefined }}>{p.name}</Text>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>SKU: {p.sku}</Text>
                                                    </div>
                                                </Space>
                                                <Button type="primary" size="small" danger ghost style={{ borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{t('reorder')}</Button>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min((p.currentStock / 100) * 100, 100)}%` }}
                                                        style={{ height: '100%', background: '#ef4444', borderRadius: 3 }} 
                                                    />
                                                </div>
                                                <Text strong style={{ fontSize: 12, color: '#ef4444' }}>{p.currentStock} {t('units')}</Text>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#10b98110', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <CheckCircleOutlined style={{ fontSize: 40, color: '#10b981' }} />
                                        </div>
                                        <Text strong style={{ display: 'block', fontSize: 16 }}>{t('stockSafe')}</Text>
                                        <Text type="secondary">{t('stockOptimized')}</Text>
                                    </div>
                                )}
                            </div>
                        </Skeleton>
                    </Card>
                </Col>

                {/* Top Strategic Partners */}
                <Col xs={24} lg={8}>
                    <Card
                        title={
                            <Tabs 
                                activeKey={activePartnerTab}
                                onChange={(key) => setActivePartnerTab(key as '1' | '2')}
                                size="small"
                                tabBarExtraContent={
                                    <Button type="link" size="small" style={{ fontSize: 12 }}>{t('analytics')}</Button>
                                }
                                items={[
                                    { key: '1', label: t('buyer'), icon: <GlobalOutlined /> },
                                    { key: '2', label: t('supplier'), icon: <TeamOutlined /> },
                                ]}
                            />
                        }
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%',
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                                {(activePartnerTab === '1' ? data?.director?.topBuyers : data?.director?.topSuppliers)?.map((p: any, i: number) => (
                                    <motion.div 
                                        whileHover={{ x: 5 }}
                                        key={p.id} 
                                        style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            padding: '16px', 
                                            background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', 
                                            borderRadius: 20,
                                            cursor: 'pointer',
                                            border: '1px solid transparent'
                                        }}
                                        onClick={() => window.location.href = activePartnerTab === '1' ? `/admin/partners/${p.id}` : `/admin/suppliers/${p.id}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Avatar size={40} style={{ background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]} 0%, ${COLORS[i % COLORS.length]}88 100%)`, fontWeight: 700 }}>
                                                {p.name.charAt(0)}
                                            </Avatar>
                                            <div>
                                                <Text strong style={{ display: 'block', color: isDark ? '#f8fafc' : undefined }}>{p.name}</Text>
                                                <Tag color={activePartnerTab === '1' ? "success" : "processing"} style={{ fontSize: 10, borderRadius: 6, border: 'none' }}>
                                                    {activePartnerTab === '1' ? t('vipBuyer') : t('keySupplier')}
                                                </Tag>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                        <Text strong style={{ display: 'block', color: '#3b82f6' }}>{formatVND(p.total)}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{activePartnerTab === '1' ? t('purchaseTotal') : t('supplyTotal')}</Text>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </Skeleton>
                    </Card>
                </Col>

                {/* Upcoming Shipments */}
                <Col xs={24} lg={8}>
                    <Card
                        title={<Space><TruckOutlined style={{ color: '#10b981' }} /><Title level={5} style={{ margin: 0, fontWeight: 800, color: isDark ? '#f8fafc' : undefined }}>{t('upcomingShipments7D')}</Title></Space>}
                        extra={<Button type="text" icon={<PlusOutlined />} size="small" />}
                        variant="borderless"
                        style={{ 
                            borderRadius: 28, height: '100%',
                            boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                            background: isDark ? '#1e293b' : '#fff',
                            border: isDark ? '1px solid #334155' : '1px solid #f0f0f0'
                        }}
                    >
                        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
                            <div className="custom-scrollbar" style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                            {data?.logistics?.upcomingShipments?.length > 0 ? (
                                <Timeline
                                    style={{ marginTop: 10 }}
                                    items={data.logistics.upcomingShipments.map((s: any) => ({
                                        key: s.id || s.number,
                                        color: '#10b981',
                                        content: (
                                            <motion.div whileHover={{ x: 5 }} style={{ marginBottom: 12, padding: '12px', background: isDark ? 'rgba(16, 185, 129, 0.05)' : '#10b98105', borderRadius: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <Text strong style={{ color: isDark ? '#f8fafc' : undefined }}>{s.number}</Text>
                                                    <Tag color={SHIP_STATUS_COLOR[s.status] || 'processing'} style={{ borderRadius: 6, fontSize: 10 }}>
                                                        {t(s.status.toLowerCase())}
                                                    </Tag>
                                                </div>
                                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                                                    <GlobalOutlined style={{ marginRight: 4 }} /> {s.customer}
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                                                    <ClockCircleOutlined style={{ marginRight: 4 }} /> ETD: {dayjs(s.etd).format('DD MMM, YYYY')}
                                                </Text>
                                            </motion.div>
                                        )
                                    }))}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: isDark ? '#334155' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <TruckOutlined style={{ fontSize: 40, color: isDark ? '#64748b' : '#cbd5e1' }} />
                                    </div>
                                    <Text type="secondary" style={{ display: 'block' }}>{t('noShipments')}</Text>
                                    <Button type="link" style={{ marginTop: 8 }}>{t('createNewShipment')}</Button>
                                </div>
                            )}
                            </div>
                        </Skeleton>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default AdminDashboard;
