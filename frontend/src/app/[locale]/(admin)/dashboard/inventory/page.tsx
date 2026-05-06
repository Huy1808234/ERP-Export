'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, Card, Badge, 
  Typography, Divider, Row, Col, Statistic, Drawer, 
  Timeline, theme, Tooltip, Empty, Avatar
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, 
  HistoryOutlined, InboxOutlined, 
  WarningOutlined, AppstoreOutlined,
  ArrowRightOutlined, InfoCircleOutlined,
  StockOutlined,
  ExportOutlined,
  DeploymentUnitOutlined,
  StopOutlined,
  QuestionCircleOutlined,
  BarcodeOutlined,
  UserOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';
import dayjs, { Dayjs } from 'dayjs';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';

interface IInventoryItem {
  id: string;
  sku: string;
  vietnameseName: string;
  currentStock: number;
  reservedStock: number;
  minimumStock: number;
  unitOfMeasure: string;
}

interface IInventorySummary {
  totalStock: number;
  totalItems: number;
  lowStockCount: number;
}

interface IInventoryLedger {
  id: string;
  transactionType: string;
  quantityChange: number;
  balanceAfter: number;
  referenceNumber?: string;
  referenceId?: string;
  lotNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

const { Text, Title } = Typography;

const InventoryPage = () => {
  const { data: session } = useSession();
  const accessToken = (session as any)?.user?.access_token;
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { formatNumber } = useCurrency();

  // --- States ---
  const [data, setData] = useState<IInventoryItem[]>([]);
  const [summary, setSummary] = useState<IInventorySummary>({ totalStock: 0, totalItems: 0, lowStockCount: 0 });
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState("");

  // Ledger State
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<IInventoryItem | null>(null);
  const [ledgerData, setLedgerData] = useState<IInventoryLedger[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // --- Logic Fetch ---
  const fetchInventory = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory`,
        method: 'GET',
        queryParams: {
          current: meta.current,
          pageSize: meta.pageSize,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        setData(res.data.results);
        setMeta(prev => ({ ...prev, total: res.data.meta.total }));
        setSummary(res.data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [meta.current, meta.pageSize, accessToken]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const fetchLedger = async (product: any) => {
    setSelectedProduct(product);
    setLedgerOpen(true);
    setLedgerLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inventory/ledger`,
        method: 'GET',
        queryParams: { productId: product.id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) setLedgerData(res.data.results);
    } finally {
      setLedgerLoading(false);
    }
  };

  // --- Table Columns ---
  const columns = [
    {
      title: 'SẢN PHẨM',
      dataIndex: 'vietnameseName',
      key: 'name',
      render: (text: string, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>SKU: {record.sku}</Text>
        </Space>
      ),
    },
    {
      title: 'TỔNG TỒN THỰC TẾ',
      dataIndex: 'currentStock',
      key: 'currentStock',
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ fontSize: 16 }}>{formatNumber(val)}</Text>
      ),
    },
    {
      title: 'GIỮ HÀNG (RESERVED)',
      dataIndex: 'reservedStock',
      key: 'reservedStock',
      align: 'right' as const,
      render: (val: number) => (
        <Text type="secondary">{formatNumber(val || 0)}</Text>
      ),
    },
    {
      title: 'KHẢ DỤNG (AVAILABLE)',
      key: 'available',
      align: 'right' as const,
      render: (_: any, record: any) => {
        const available = (record.currentStock || 0) - (record.reservedStock || 0);
        const isLow = available <= (record.minimumStock || 0);
        return (
          <Space>
            {isLow && available > 0 && <Badge status="warning" text="Sắp hết" style={{ fontSize: 11 }} />}
            {available <= 0 && <Badge status="error" text="Hết hàng" style={{ fontSize: 11 }} />}
            <Tag color={available > (record.minimumStock || 0) ? 'green' : 'volcano'} style={{ fontSize: 14, padding: '4px 12px', borderRadius: 6 }}>
              {formatNumber(available)}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button 
          type="link" 
          icon={<HistoryOutlined />} 
          onClick={() => fetchLedger(record)}
        >
          Xem thẻ kho
        </Button>
      ),
    },
  ];

  const getTransactionLabel = (type: string) => {
    const config: any = {
      GOODS_RECEIPT: { color: 'green', label: 'Nhập mua hàng (GRN)', icon: <InboxOutlined /> },
      SALES_DISPATCH: { color: 'blue', label: 'Xuất khẩu (Export)', icon: <ExportOutlined /> },
      ADJUSTMENT: { color: 'orange', label: 'Điều chỉnh kho', icon: <DeploymentUnitOutlined /> },
      RETURN: { color: 'purple', label: 'Hàng trả lại', icon: <ReloadOutlined /> },
      REJECTION: { color: 'red', label: 'Hàng lỗi/Trả NCC', icon: <StopOutlined /> },
    };
    return config[type] || { color: 'default', label: type, icon: <QuestionCircleOutlined /> };
  };

  return (
    <div style={{ padding: '24px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
            title="Quản Lý Tồn Kho" 
            icon={<InboxOutlined />} 
            description="Theo dõi số dư hàng hóa, hàng giữ chỗ và lịch sử biến động kho" 
          />
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchInventory} size="large">Làm mới</Button>
            <Button type="primary" icon={<ExportOutlined />} size="large">Xuất báo cáo</Button>
          </Space>
        </Col>
      </Row>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic 
                title={<Text strong type="secondary">TỔNG TỒN KHO</Text>} 
                value={summary.totalStock} 
                precision={0}
                styles={{ content: { color: token.colorPrimary, fontWeight: 900, fontSize: 32 } }}
                prefix={<StockOutlined style={{ marginRight: 8 }} />} 
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>Tổng số đơn vị hàng hóa thực tế</div>
            </Card>
          </motion.div>
        </Col>
        <Col span={8}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic 
                title={<Text strong style={{ color: token.colorError }}>CẢNH BÁO HẾT HÀNG</Text>} 
                value={summary.lowStockCount} 
                styles={{ content: { color: token.colorError, fontWeight: 900, fontSize: 32 } }}
                prefix={<WarningOutlined style={{ marginRight: 8 }} />} 
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>Số lượng SKU dưới mức an toàn</div>
            </Card>
          </motion.div>
        </Col>
        <Col span={8}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card variant="borderless" style={{ borderRadius: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <Statistic 
                title={<Text strong type="secondary">DANH MỤC SẢN PHẨM</Text>} 
                value={summary.totalItems} 
                styles={{ content: { color: '#8b5cf6', fontWeight: 900, fontSize: 32 } }}
                prefix={<AppstoreOutlined style={{ marginRight: 8 }} />} 
              />
              <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>Tổng số mã hàng đang quản lý</div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Main Table */}
      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: 16, 
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.02)' 
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <Input 
            placeholder="Tìm theo tên hoặc SKU..." 
            prefix={<SearchOutlined />} 
            style={{ width: 300, borderRadius: 8 }}
            size="large"
          />
        </div>
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey={(record: any) => record.id || record.sku || Math.random()}
          loading={loading}
          pagination={{
            current: meta.current,
            pageSize: meta.pageSize,
            total: meta.total,
            onChange: (page) => setMeta(prev => ({ ...prev, current: page })),
          }}
        />
      </Card>

      {/* Drawer Thẻ Kho (Ledger) */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar shape="square" icon={<InboxOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Thẻ Kho Chi Tiết</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: token.colorTextDescription }}>{selectedProduct?.vietnameseName}</div>
            </div>
          </div>
        }
        placement="right"
        size={600}
        onClose={() => setLedgerOpen(false)}
        open={ledgerOpen}
        styles={{ body: { padding: 24, background: isDark ? '#141414' : '#fafafa' } }}
      >
        {ledgerLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Đang tải lịch sử...</div>
        ) : ledgerData.length > 0 ? (
          <Timeline
            mode="start"
            items={ledgerData.map(item => {
              const config = getTransactionLabel(item.transactionType);
              const uom = selectedProduct?.unitOfMeasure || 'Đơn vị';
              
              return {
                key: item.id || Math.random(),
                title: (
                  <div style={{ paddingRight: 12, textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{dayjs(item.createdAt).format('HH:mm')}</div>
                    <div style={{ fontSize: 11, color: token.colorTextDescription }}>{dayjs(item.createdAt).format('DD/MM/YYYY')}</div>
                  </div>
                ),
                color: config.color,
                children: (
                  <Card 
                    size="small" 
                    hoverable
                    style={{ 
                      borderRadius: 16, 
                      marginBottom: 16, 
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)'}`,
                      background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                      backdropFilter: 'blur(10px)',
                      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: 10, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${config.color}15`, color: config.color
                          }}>
                            {config.icon}
                          </div>
                          <Text strong style={{ fontSize: 15, letterSpacing: '-0.3px' }}>{config.label}</Text>
                        </div>
                        
                        <Space wrap size={[8, 8]}>
                          <Tooltip title="Mã chứng từ đối chiếu">
                            <Tag color="processing" variant="filled" style={{ borderRadius: 6, fontWeight: 600, padding: '2px 10px' }}>
                              #{item.referenceNumber || item.referenceId?.slice(0, 8)}
                            </Tag>
                          </Tooltip>
                          
                          {item.lotNumber && (
                            <Tag icon={<BarcodeOutlined />} color="magenta" variant="filled" style={{ borderRadius: 6 }}>
                              Lô: {item.lotNumber}
                            </Tag>
                          )}
                          
                          <div style={{ 
                            display: 'flex', alignItems: 'center', gap: 6, 
                            padding: '2px 8px', background: isDark ? '#334155' : '#f8fafc', 
                            borderRadius: 6, border: `1px solid ${isDark ? '#475569' : '#f1f5f9'}`
                          }}>
                            <Avatar size={16} style={{ backgroundColor: token.colorPrimary, fontSize: 10 }}>
                              {String(item.createdBy || 'S').charAt(0).toUpperCase()}
                            </Avatar>
                            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
                              {item.createdBy || 'Hệ thống'}
                            </Text>
                          </div>
                        </Space>

                        {item.notes && (
                          <div style={{ 
                            fontSize: 12, 
                            marginTop: 10, 
                            padding: '8px 12px', 
                            background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#f9fafb', 
                            borderRadius: 8,
                            borderLeft: `3px solid ${config.color}`,
                            color: isDark ? '#94a3b8' : '#64748b'
                          }}>
                            {item.notes}
                          </div>
                        )}
                      </div>

                      <div style={{ 
                        textAlign: 'right', 
                        paddingLeft: 20, 
                        borderLeft: `1px dashed ${isDark ? '#475569' : '#e2e8f0'}`,
                        minWidth: 120
                      }}>
                        <div style={{ 
                          fontSize: 22, 
                          fontWeight: 800, 
                          fontFamily: 'Space Mono, monospace',
                          color: item.quantityChange > 0 ? '#10b981' : '#ef4444',
                          lineHeight: 1.2
                        }}>
                          {item.quantityChange > 0 ? '+' : ''}{formatNumber(item.quantityChange)}
                        </div>
                        <div style={{ fontSize: 11, color: token.colorTextDescription, marginTop: 4, fontWeight: 500 }}>
                          {uom.toUpperCase()}
                        </div>
                        <div style={{ 
                          fontSize: 12, 
                          color: isDark ? '#94a3b8' : '#64748b', 
                          marginTop: 8,
                          padding: '2px 8px',
                          background: isDark ? '#1e293b' : '#f1f5f9',
                          borderRadius: 4,
                          display: 'inline-block'
                        }}>
                          Tồn: <Text strong style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{formatNumber(item.balanceAfter)}</Text>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              };
            })}
          />
        ) : (
          <Empty description="Chưa có lịch sử giao dịch cho sản phẩm này" />
        )}
      </Drawer>
    </div>
  );
};

export default InventoryPage;
