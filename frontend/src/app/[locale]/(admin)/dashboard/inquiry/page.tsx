'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Table, 
    Tag, 
    Typography, 
    Card, 
    Space, 
    Button, 
    Drawer, 
    Descriptions, 
    Badge, 
    App,
    Avatar,
    Input,
    Select,
    Row,
    Col,
    Popconfirm
} from 'antd';
import { 
    MailOutlined, 
    UserOutlined, 
    ClockCircleOutlined, 
    CheckCircleOutlined, 
    CloseCircleOutlined,
    ArrowRightOutlined,
    ShoppingOutlined,
    DownloadOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const csvEscape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
};

const InquiryPage = () => {
    const { data: session } = useSession();
    const accessToken = getAccessToken(session);
    const router = useRouter();
    const { message, notification } = App.useApp();
    const t = useTranslations('Inquiry');

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [current, setCurrent] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState('');
    
    const [pendingCount, setPendingCount] = useState(0);

    const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const fetchData = useCallback(async (page = current, size = pageSize, status = filterStatus, q = search) => {
        if (!accessToken) return;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                current: page.toString(),
                pageSize: size.toString(),
            });
            if (status) queryParams.append('status', status);
            if (q) queryParams.append('search', q);

            const res = await sendRequest<IBackendRes<any>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries?${queryParams.toString()}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            // Handle double-wrapped response: { data: { data: { items, total } } }
            const result = res?.data?.data ?? res?.data;
            if (result) {
                if (result.items) {
                    setData(result.items);
                    setTotal(result.total || 0);
                } else if (Array.isArray(result)) {
                    setData(result);
                    setTotal(result.length);
                } else {
                    setData([]);
                    setTotal(0);
                }
            }
        } catch {
            message.error(t('table.fetchError'));
        } finally {
            setLoading(false);
        }
    }, [accessToken, current, filterStatus, message, pageSize, search, t]);

    const fetchPendingCount = useCallback(async () => {
        if (!accessToken) return;
        try {
            const res = await sendRequest<IBackendRes<any>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries?status=PENDING&pageSize=1`,
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const result = res?.data?.data ?? res?.data;
            if (result?.total !== undefined) {
                setPendingCount(result.total);
            }
        } catch {}
    }, [accessToken]);

    useEffect(() => {
        fetchData(current, pageSize, filterStatus, search);
        fetchPendingCount();
    }, [current, fetchData, fetchPendingCount, filterStatus, pageSize, search]);

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await sendRequest({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries/${id}/status`,
                method: 'PATCH',
                body: { status },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            message.success(t('drawer.updateSuccess'));
            fetchData();
            fetchPendingCount();
            setDrawerOpen(false);
        } catch {
            message.error(t('drawer.updateError'));
        }
    };

    const handleBulkDelete = async () => {
        if (!accessToken || selectedRowKeys.length === 0) return;

        setLoading(true);
        try {
            const ids = selectedRowKeys.map(String);
            const res = await sendRequest<IBackendRes<any>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries/bulk-delete`,
                method: 'POST',
                body: { ids },
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if ((res as any)?.statusCode && (res as any).statusCode >= 400) {
                throw new Error((res as any).message);
            }

            const nextPage = data.length === ids.length && current > 1 ? current - 1 : current;
            message.success(t('table.deleteSuccess'));
            setSelectedRowKeys([]);
            setCurrent(nextPage);
            await fetchData(nextPage, pageSize, filterStatus, search);
            await fetchPendingCount();
        } catch {
            message.error(t('table.deleteError'));
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!accessToken) return;

        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                current: '1',
                pageSize: '10000',
            });
            if (filterStatus) queryParams.append('status', filterStatus);
            if (search) queryParams.append('search', search);

            const res = await sendRequest<IBackendRes<any>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries?${queryParams.toString()}`,
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if ((res as any)?.statusCode && (res as any).statusCode >= 400) {
                throw new Error((res as any).message);
            }

            const result = res?.data?.data ?? res?.data;
            const exportRows = result?.items ?? (Array.isArray(result) ? result : []);
            if (!exportRows.length) {
                message.warning(t('table.exportNoData'));
                return;
            }

            const headers = [
                t('table.customer'),
                'Email',
                t('drawer.phone'),
                t('table.product'),
                t('table.quantity'),
                t('table.status'),
                t('drawer.note'),
                t('table.date'),
            ];
            const rows = exportRows.map((item: any) => [
                item.customerName,
                item.customerEmail,
                item.customerPhone,
                item.productSnapshotName || item.product?.name || item.product?.vietnameseName || item.product?.englishName || '',
                item.quantity,
                item.status === 'PROCESSED' ? t('table.processed') : item.status === 'REJECTED' ? t('table.rejected') : t('table.pending'),
                item.note,
                item.createdAt ? dayjs.utc(item.createdAt).local().format('DD/MM/YYYY HH:mm:ss') : '',
            ]);

            const csv = [headers, ...rows]
                .map((row) => row.map(csvEscape).join(','))
                .join('\r\n');
            const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `customer_inquiries_${dayjs().format('YYYYMMDD_HHmm')}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            message.success(t('table.exportSuccess'));
        } catch {
            message.error(t('table.exportError'));
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: t('table.customer'),
            key: 'customer',
            render: (r: any) => (
                <Space>
                    <Avatar icon={<UserOutlined />} style={{ background: '#3b82f6' }} />
                    <div>
                        <Text strong style={{ display: 'block' }}>{r.customerName}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.customerEmail}</Text>
                    </div>
                </Space>
            )
        },
        {
            title: t('table.product'),
            key: 'product',
            render: (r: any) => (
                <Space size="small">
                    <ShoppingOutlined style={{ color: '#8b5cf6' }} />
                    <Text strong>{r.productSnapshotName || r.product?.name || t('table.deletedProduct')}</Text>
                </Space>
            )
        },
        {
            title: t('table.quantity'),
            dataIndex: 'quantity',
            key: 'quantity',
            sorter: (a: any, b: any) => Number(a.quantity) - Number(b.quantity),
            render: (v: number) => <Text strong>{Number(v).toLocaleString()}</Text>
        },
        {
            title: t('table.date'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            render: (v: string) => (
                <Space orientation="vertical" size={0}>
                    <Text style={{ fontSize: 13 }}>{dayjs.utc(v).local().format('DD/MM/YYYY')}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{dayjs.utc(v).local().format('HH:mm')}</Text>
                </Space>
            )
        },
        {
            title: t('table.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = 'gold';
                let icon = <ClockCircleOutlined />;
                let text = t('table.pending');

                if (status === 'PROCESSED') {
                    color = 'green';
                    icon = <CheckCircleOutlined />;
                    text = t('table.processed');
                } else if (status === 'REJECTED') {
                    color = 'red';
                    icon = <CloseCircleOutlined />;
                    text = t('table.rejected');
                }

                return <Tag icon={icon} color={color} style={{ borderRadius: 6, padding: '2px 8px' }}>{text}</Tag>;
            }
        },
        {
            title: t('table.actions'),
            key: 'actions',
            render: (r: any) => (
                <Button 
                    type="primary" 
                    ghost 
                    size="small"
                    onClick={() => {
                        setSelectedInquiry(r);
                        setDrawerOpen(true);
                    }}
                >
                    {t('table.detail')}
                </Button>
            )
        }
    ];

    return (
        <AdminPageScroll>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <PageHeader 
                    title={t('title')} 
                    icon={<MailOutlined style={{ color: '#3b82f6' }} />} 
                    description={t('description')} 
                />
                <Badge count={pendingCount} offset={[10, 0]}>
                    <Card 
                        size="small" 
                        style={{ 
                            borderRadius: 8, 
                            background: filterStatus === 'PENDING' ? '#bfdbfe' : '#eff6ff', 
                            borderColor: '#bfdbfe',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                        onClick={() => {
                            setFilterStatus(filterStatus === 'PENDING' ? null : 'PENDING');
                            setCurrent(1);
                        }}
                    >
                        <Text strong style={{ color: '#1e40af' }}>{t('newRequests', { count: pendingCount })}</Text>
                    </Card>
                </Badge>
            </div>

            <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between" style={{ marginBottom: 16 }}>
                    <Col xs={24} md={12}>
                        <Space wrap>
                            <Input.Search 
                                placeholder={t('table.searchPlaceholder')} 
                                allowClear 
                                onSearch={(value) => { setSearch(value); setCurrent(1); }}
                                style={{ width: 250 }}
                            />
                            <Select
                                placeholder={t('table.statusPlaceholder')}
                                allowClear
                                style={{ width: 150 }}
                                value={filterStatus}
                                onChange={(val) => { setFilterStatus(val); setCurrent(1); }}
                                options={[
                                    { label: t('table.pending'), value: 'PENDING' },
                                    { label: t('table.processed'), value: 'PROCESSED' },
                                    { label: t('table.rejected'), value: 'REJECTED' },
                                ]}
                            />
                        </Space>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                        <Space wrap>
                            {selectedRowKeys.length > 0 && (
                                <Popconfirm title={t('table.deleteConfirm')} onConfirm={handleBulkDelete}>
                                    <Button danger icon={<DeleteOutlined />}>{t('table.bulkDelete', { count: selectedRowKeys.length })}</Button>
                                </Popconfirm>
                            )}
                            <Button icon={<DownloadOutlined />} onClick={handleExport}>{t('table.exportExcel')}</Button>
                        </Space>
                    </Col>
                </Row>

                <Table 
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    columns={columns} 
                    dataSource={data} 
                    loading={loading}
                    rowKey={(record: any) => record._id || record.inquiryNumber}
                    pagination={{ 
                        current, 
                        pageSize, 
                        total, 
                        showSizeChanger: true,
                        onChange: (page, size) => { setCurrent(page); setPageSize(size); }
                    }}
                />
            </Card>

            <Drawer
                title={
                    <Space>
                        <MailOutlined style={{ color: '#3b82f6' }} />
                        <Text strong>{t('drawer.title')}</Text>
                    </Space>
                }
                placement="right"
                size="large"
                onClose={() => setDrawerOpen(false)}
                open={drawerOpen}
                extra={
                    <Space>
                        {selectedInquiry?.status === 'PENDING' && (
                            <Button danger onClick={() => handleUpdateStatus(selectedInquiry._id, 'REJECTED')}>
                                {t('drawer.reject')}
                            </Button>
                        )}
                    </Space>
                }
            >
                {selectedInquiry && (
                    <Space orientation="vertical" size={24} style={{ width: '100%' }}>
                        <Card size="small" title={t('drawer.customerInfo')} variant="borderless" style={{ background: '#f8fafc' }}>
                            <Descriptions column={1}>
                                <Descriptions.Item label={t('drawer.name')}>{selectedInquiry.customerName}</Descriptions.Item>
                                <Descriptions.Item label={t('drawer.email')}>{selectedInquiry.customerEmail}</Descriptions.Item>
                                <Descriptions.Item label={t('drawer.phone')}>{selectedInquiry.customerPhone || 'N/A'}</Descriptions.Item>
                                <Descriptions.Item label={t('drawer.submitDate')}>{dayjs.utc(selectedInquiry.createdAt).local().format('DD/MM/YYYY HH:mm:ss')}</Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card size="small" title={t('drawer.requestedProduct')} variant="borderless" style={{ background: '#f8fafc' }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ width: 60, height: 60, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                                    <ShoppingOutlined style={{ fontSize: 24, color: '#8b5cf6' }} />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: 16, display: 'block' }}>{selectedInquiry.productSnapshotName || selectedInquiry.product?.name || t('table.deletedProduct')}</Text>
                                    <Text type="secondary">{t('drawer.quantity')}: <Text strong>{Number(selectedInquiry.quantity).toLocaleString()}</Text></Text>
                                </div>
                            </div>
                            <div style={{ marginTop: 16, padding: '12px', background: '#fff', borderRadius: 8, borderLeft: '4px solid #3b82f6' }}>
                                <Text italic>{selectedInquiry.note || t('drawer.noNote')}</Text>
                            </div>
                        </Card>

                        {selectedInquiry.status === 'PENDING' ? (
                            <div style={{ marginTop: 24 }}>
                                <Button 
                                    type="primary" 
                                    block 
                                    size="large" 
                                    icon={<ArrowRightOutlined />}
                                    style={{ 
                                        height: 50, 
                                        borderRadius: 12, 
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                        border: 'none',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                    }}
                                    loading={loading}
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            // 1. Check if partner exists (Strict Check)
                                            let partnerId = null;
                                            const normalizedEmail = selectedInquiry.customerEmail?.trim();
                                            const normalizedPhone = selectedInquiry.customerPhone?.trim();
                                            const normalizedName = selectedInquiry.customerName?.trim() || selectedInquiry.customerName;
                                            
                                            // Check by Email
                                            if (normalizedEmail) {
                                                const emailRes = await sendRequest<IBackendRes<any>>({
                                                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
                                                    method: 'GET',
                                                    queryParams: { 
                                                        email: normalizedEmail, 
                                                        partnerType: 'CUSTOMER', // Chỉ tìm khách hàng
                                                        pageSize: 1 
                                                    },
                                                    headers: { Authorization: `Bearer ${accessToken}` },
                                                });
                                                
                                                const found = emailRes?.data?.results?.[0];
                                                // Verify exact match to be safe
                                                if (found && found.email?.trim() === normalizedEmail) {
                                                    partnerId = found._id;
                                                }
                                            }

                                            // Check by Phone if Email not found or matched
                                            if (!partnerId && normalizedPhone) {
                                                const phoneRes = await sendRequest<IBackendRes<any>>({
                                                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
                                                    method: 'GET',
                                                    queryParams: { 
                                                        phone: normalizedPhone, 
                                                        partnerType: 'CUSTOMER',
                                                        pageSize: 1 
                                                    },
                                                    headers: { Authorization: `Bearer ${accessToken}` },
                                                });
                                                
                                                const found = phoneRes?.data?.results?.[0];
                                                if (found && found.phone?.trim() === normalizedPhone) {
                                                    partnerId = found._id;
                                                }
                                            }

                                            // 2. If STILL not found, Auto-create Temporary Partner
                                            if (!partnerId) {
                                                notification.info({
                                                    title: t('drawer.autoSystem'),
                                                    description: t('drawer.autoCreating', { name: normalizedName }),
                                                    icon: <UserOutlined style={{ color: '#3b82f6' }} />
                                                });

                                                const newPartner = await sendRequest<IBackendRes<any>>({
                                                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
                                                    method: 'POST',
                                                    body: {
                                                        name: normalizedName,
                                                        email: normalizedEmail,
                                                        phone: normalizedPhone,
                                                        partnerType: 'CUSTOMER',
                                                        note: `KHÁCH VÃNG LAI: Tự động tạo từ Inquiry #${selectedInquiry._id.substring(0,8)}`,
                                                        riskLevel: 'LOW',
                                                        country: 'Vietnam',
                                                        region: 'OTHER',
                                                        isActive: true // Đảm bảo đối tác luôn ở trạng thái hoạt động để hiện trong list
                                                    },
                                                    headers: { Authorization: `Bearer ${accessToken}` },
                                                });

                                                if (newPartner?.data?._id) {
                                                    partnerId = newPartner.data._id;
                                                    notification.success({
                                                        title: t('drawer.success'),
                                                        description: t('drawer.autoCreated', { name: normalizedName })
                                                    });
                                                } else {
                                                    throw new Error('Failed to create partner');
                                                }
                                            }

                                            // 3. Prepare data and redirect to Quotation
                                            const convertData = {
                                                ...selectedInquiry,
                                                customerId: partnerId,
                                                // Đảm bảo tên được truyền đi chính xác để Modal Báo giá hiển thị thay vì hiện UUID
                                                customerName: normalizedName,
                                                customerEmail: normalizedEmail,
                                                customerPhone: normalizedPhone,
                                            };
                                            
                                            sessionStorage.setItem('convert_inquiry', JSON.stringify(convertData));
                                            router.push('/dashboard/quotation');
                                            
                                        } catch (error) {
                                            console.error("I2Q Error:", error);
                                            message.error(t('drawer.processError'));
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    {t('drawer.convertToQuotation')}
                                </Button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <Tag color={selectedInquiry.status === 'PROCESSED' ? 'green' : 'red'} style={{ fontSize: 14, padding: '8px 16px', borderRadius: 8 }}>
                                    {selectedInquiry.status === 'PROCESSED' ? t('drawer.statusProcessed') : t('drawer.statusRejected')}
                                </Tag>
                            </div>
                        )}
                    </Space>
                )}
            </Drawer>
        </AdminPageScroll>
    );
};

export default InquiryPage;
