'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Input, Card, Badge, 
  Typography, Divider, Tooltip, Row, Col, Statistic,
  Dropdown, Drawer, Avatar, notification, Popconfirm, theme, Select, Form, Slider, InputNumber
} from 'antd';
import {PlusOutlined, SearchOutlined, FilterOutlined, 
  ExportOutlined, EditOutlined, 
  DeleteOutlined, MoreOutlined, 
  ReloadOutlined, ShoppingOutlined,
  DollarCircleOutlined, InfoCircleOutlined,
  CodeOutlined, AppstoreOutlined, InboxOutlined,
  HistoryOutlined, ReconciliationOutlined} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/library/theme.context';
import { sendRequest } from '@/utils/api';
import ProductModal from './ProductModal';
import AdjustmentModal from './AdjustmentModal';
import { IProduct } from "@/types/product";
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface IMeta {
  current: number;
  pageSize: number;
  total: number;
}

const ProductTable = () => {
  const { data: session } = useSession();
  const tUom = useTranslations('UOM');
  const tProduct = useTranslations('ProductTable');
  const [api, contextHolder] = notification.useNotification();
  const accessToken = session?.user?.access_token;

  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});

  // --- States ---
  const [products, setProducts] = useState<IProduct[]>([]);
  const [meta, setMeta] = useState<IMeta>({ current: 1, pageSize: 10, total: 0 });
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [summary, setSummary] = useState({ 
    total: 0, 
    activeCount: 0, 
    avgPrice: 0, 
    unitCounts: [] as { unit: string, count: number }[] 
  });

  // Tự động chọn đơn vị đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedUnit && summary.unitCounts && summary.unitCounts.length > 0) {
      setSelectedUnit(summary.unitCounts[0].unit);
    }
  }, [summary.unitCounts, selectedUnit]);

  const currentUnitCount = summary.unitCounts?.find(u => u.unit === selectedUnit)?.count || 0;
  const [isFetching, setIsFetching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
      setMeta(prev => ({ ...prev, current: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<IProduct | null>(null);

  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [productForAdj, setProductForAdj] = useState<IProduct | null>(null);

  // --- Advanced Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterForm] = Form.useForm();
  const [filters, setFilters] = useState<any>({});
  const [sortConfig, setSortConfig] = useState<any>({ field: 'updatedAt', order: 'descend' });

  // --- 2. Logic Fetch Dữ liệu ---
  const fetchCurrencyRates = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/currencies`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const next: Record<string, number> = {};
      for (const c of res?.data ?? []) {
        const code = c?.code;
        if (!code) continue;

        const list = Array.isArray(c.exchangeRates) ? c.exchangeRates : [];
        const normalized = (r: any) => (r?.rateType || 'TRANSFER') as string;
        const latest =
          list.find((r: any) => r?.isActive && normalized(r) === 'TRANSFER')?.rate ??
          list.find((r: any) => normalized(r) === 'TRANSFER')?.rate;

        if (latest) next[code] = Number(latest);
      }

      setCurrencyRates(next);
    } catch {
      // silent
    }
  }, [accessToken]);

  const fetchProducts = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    try {
      let sortStr = sortConfig.field;
      if (sortConfig.order === 'descend') sortStr = `-${sortStr}`;

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
        method: 'GET',
        queryParams: {
          current: meta.current,
          pageSize: meta.pageSize,
          sort: sortStr,
          ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
          ...filters
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        setProducts(res.data.results);
        setMeta(prev => ({ 
          ...prev, 
          total: res.data.totalItems || 0 
        }));
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } finally {
      setIsFetching(false);
    }
  }, [meta.current, meta.pageSize, debouncedSearchText, filters, sortConfig, accessToken]);

  useEffect(() => {
    fetchCurrencyRates();
    fetchProducts();
  }, [fetchProducts, fetchCurrencyRates]);

  // --- 3. Hành động (Actions) ---
  const handleDelete = async (id: string) => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      api.success({ title: 'Xóa sản phẩm thành công' });
      fetchProducts();
    }
  };

  const handleResetFilters = () => {
    filterForm.resetFields();
    setFilters({});
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const onFilterFinish = (values: any) => {
    const formattedFilters: any = {};
    
    // Exact matches
    if (values.unitOfMeasure) formattedFilters.unitOfMeasure = values.unitOfMeasure;
    if (values.isActive !== undefined) formattedFilters.isActive = values.isActive;
    if (values.exportCurrency) formattedFilters.exportCurrency = values.exportCurrency;
    if (values.hsCode) formattedFilters.hsCode = values.hsCode;
    if (values.category) formattedFilters.category = values.category;
    if (values.brand) formattedFilters.brand = values.brand;

    // Range: Price
    if (values.priceRange && (values.priceRange[0] > 0 || values.priceRange[1] < 10000000)) {
      formattedFilters.defaultExportPrice = { 
        $gte: values.priceRange[0], 
        $lte: values.priceRange[1] 
      };
    }

    // Range: CBM
    if (values.cbmRange && (values.cbmRange[0] > 0 || values.cbmRange[1] < 1)) {
      formattedFilters.cbmPerCarton = {
        $gte: values.cbmRange[0],
        $lte: values.cbmRange[1]
      };
    }

    // Stock min
    if (values.minStock) {
        formattedFilters.currentStock = { $gte: values.minStock };
    }

    setFilters(formattedFilters);
    setMeta(prev => ({ ...prev, current: 1 }));
    setIsFilterOpen(false);
  };

  const handleExport = async () => {
    if (!accessToken) return;
    try {
      api.info({ title: 'Đang chuẩn bị file Excel...', placement: 'topRight' });
      const queryParams = new URLSearchParams({
        ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
        ...filters
      });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/export?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `DS_San_Pham_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        api.success({ title: 'Xuất Excel thành công' });
      }
    } catch (error) {
      api.error({ title: 'Lỗi khi xuất Excel' });
    }
  };

  // --- 4. Cấu hình Columns ---
  const columns: ColumnsType<IProduct> = useMemo(() => [
    {
      title: 'MÃ SKU',
      dataIndex: 'sku',
      fixed: 'left',
      width: 150,
      sorter: true,
      render: (text: string) => (
        <Space>
          <CodeOutlined style={{ color: '#1890ff' }} />
          <Text strong style={{ color: '#1890ff' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'TÊN SẢN PHẨM',
      dataIndex: 'vietnameseName',
      width: 250,
      ellipsis: true,
      render: (text: string, record: IProduct) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.englishName}</Text>
        </div>
      ),
    },
    {
      title: 'LOGISTICS',
      width: 180,
      render: (_: any, record: IProduct) => (
        <Space orientation="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: '11px' }}>HS: {record.hsCode || '---'}</Text>
          <Space>
            <Tag color="blue">{record.unitOfMeasure ? tUom(record.unitOfMeasure) : '-'}</Tag>
            {record.cbmPerCarton && (
              <Tooltip title="Thể tích (CBM/Carton)">
                <Tag color="orange">{record.cbmPerCarton} m³</Tag>
              </Tooltip>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'GIÁ BÁN NIÊM YẾT',
      dataIndex: 'defaultExportPrice',
      width: 160,
      sorter: true,
      render: (price: number, record: IProduct) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Text strong style={{ color: token.colorError }}>
            {price?.toLocaleString()} {record.exportCurrency}
          </Text>
          {record.exportCurrency && record.exportCurrency !== 'VND' && currencyRates[record.exportCurrency] && price ? (
            <Text type="secondary" style={{ fontSize: '10px' }}>
              ≈ {(price * currencyRates[record.exportCurrency]).toLocaleString()} VND
            </Text>
          ) : null}
          {record.preferredSupplier && (
            <Text type="secondary" style={{ fontSize: '10px' }}>
              NCC: {record.preferredSupplier.name}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'TRẠNG THÁI',
      dataIndex: 'isActive',
      width: 150,
      render: (active: boolean) => (
        <Badge 
          status={active ? 'success' : 'default'} 
          text={
            <Tag color={active ? 'cyan' : 'default'} style={{ borderRadius: '12px' }}>
              {active ? tProduct('status.ACTIVE') : tProduct('status.INACTIVE')}
            </Tag>
          } 
        />
      )
    },
    {
      title: 'THAO TÁC',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_: any, record: IProduct) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1890ff' }} />} 
              onClick={() => { setDataUpdate(record); setIsModalOpen(true); }}
            />
          </Tooltip>
          <Dropdown
            menu={{ 
              items: [
                {
                  key: 'adjust',
                  icon: <ReconciliationOutlined />,
                  label: tProduct('actions.adjust'),
                  onClick: () => { setProductForAdj(record); setIsAdjOpen(true); }
                },
                {
                  key: 'ledger',
                  icon: <HistoryOutlined />,
                  label: tProduct('actions.ledger'),
                },
                { type: 'divider' },
                { 
                  key: 'delete', 
                  icon: <DeleteOutlined />, 
                  label: (
                    <Popconfirm
                      title="Xóa sản phẩm này?"
                      onConfirm={() => handleDelete(record.id!)}
                      okText="Xóa" cancelText="Hủy"
                    >
                      <span>{tProduct('actions.delete')}</span>
                    </Popconfirm>
                  ), 
                  danger: true 
                },
              ] 
            }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ], [accessToken, currencyRates]);

  const { token } = theme.useToken();
  const { isDark } = useTheme();

  return (
    <div style={{ padding: '24px', backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      {contextHolder}
      
      {/* Header */}
      <Row justify="space-between" align="bottom" style={{ marginBottom: '24px' }}>
        <Col>
          <PageHeader 
        title="Danh Mục Sản Phẩm" 
        icon={<InboxOutlined />} 
        description="Quản lý danh sách hàng hóa, giá vốn và tồn kho" 
      />
          <Text type="secondary">Quản lý SKU, thông số Logistics và bảng giá mặc định</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ExportOutlined />} size="large" onClick={handleExport}>Xuất Excel</Button>
            <Button 
              type="primary" icon={<PlusOutlined />} size="large" 
              onClick={() => { setDataUpdate(null); setIsModalOpen(true); }}
              style={{ borderRadius: '8px' }}
            >
              Thêm sản phẩm
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={<Text type="secondary">Tổng SKU</Text>} 
              value={summary.total} 
              prefix={<AppstoreOutlined style={{ color: token.colorPrimary }} />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={<Text type="secondary">Đang kinh doanh</Text>} 
              value={summary.activeCount} 
              styles={{ content: { color: token.colorSuccess } }}
              prefix={<ShoppingOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={
                <Dropdown
                  menu={{
                    items: (summary.unitCounts || []).map(u => ({
                      key: u.unit,
                      label: tUom(u.unit),
                      onClick: () => setSelectedUnit(u.unit)
                    }))
                  }}
                  trigger={['click']}
                >
                  <Space style={{ cursor: 'pointer' }}>
                    <Text type="secondary">Đơn vị: {selectedUnit ? tUom(selectedUnit) : '---'}</Text>
                    <EditOutlined style={{ fontSize: '10px', color: token.colorPrimary }} />
                  </Space>
                </Dropdown>
              } 
              value={currentUnitCount} 
              prefix={<InfoCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" hoverable style={{ borderRadius: '12px' }}>
            <Statistic 
              title={<Text type="secondary">Giá trị trung bình</Text>} 
              value={summary.avgPrice} 
              precision={1}
              prefix={<DollarCircleOutlined style={{ color: '#faad14' }} />} 
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Container */}
      <Card 
        variant="borderless" 
        style={{ 
          borderRadius: '12px', 
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)' 
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between' }}>
          <Space size="large">
            <Input
              placeholder="Tìm theo SKU, tên VN/EN..." 
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 400 }}
              size="large"
              allowClear
            />
            <Button 
              icon={<FilterOutlined />} 
              size="large"
              onClick={() => setIsFilterOpen(true)}
              type={Object.keys(filters).length > 0 ? "primary" : "default"}
            >
              Bộ lọc nâng cao {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
            </Button>
            <Button icon={<ReloadOutlined />} size="large" onClick={fetchProducts} />
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <span style={{ color: token.colorTextSecondary }}>Đã chọn <b>{selectedRowKeys.length}</b> mục</span>
              <Popconfirm
                title={`Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} sản phẩm đã chọn?`}
                onConfirm={async () => {
                  const res = await sendRequest<IBackendRes<any>>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/bulk-delete`,
                    method: 'POST',
                    body: { ids: selectedRowKeys },
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (res?.data) {
                    api.success({ title: 'Thao tác thành công', description: res.message });
                    setSelectedRowKeys([]);
                    fetchProducts();
                  }
                }}
                okText="Xóa tất cả"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button danger type="primary" icon={<DeleteOutlined />}>Xóa hàng loạt</Button>
              </Popconfirm>
            </Space>
          )}
        </div>

        <Table 
          columns={columns} 
          dataSource={products}
          rowKey={(record) => record.id || record.sku || Math.random()}
          loading={isFetching}
          scroll={{ x: 1200 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onChange={(pagination, filters, sorter: any) => {
            if (sorter.field) {
              setSortConfig({ field: sorter.field, order: sorter.order });
            }
          }}
          pagination={{
            current: meta.current,
            pageSize: meta.pageSize,
            total: meta.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng cộng ${total} sản phẩm`,
            onChange: (page, size) => setMeta({ ...meta, current: page, pageSize: size }),
          }}
        />
      </Card>

      {/* Advanced Filter Drawer */}
      <Drawer
        title={<Space><FilterOutlined /> BỘ LỌC SẢN PHẨM</Space>}
        placement="right"
        onClose={() => setIsFilterOpen(false)}
        open={isFilterOpen}
        size="default"
        extra={
          <Space>
            <Button onClick={handleResetFilters}>Đặt lại</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>Áp dụng</Button>
          </Space>
        }
      >
        <Form
          form={filterForm}
          layout="vertical"
          onFinish={onFilterFinish}
          initialValues={{
            isActive: undefined,
            priceRange: [0, 10000000],
            cbmRange: [0, 1]
          }}
        >
          <Divider titlePlacement="left" style={{ marginTop: 0 }}>Thông tin chung</Divider>
          
          <Form.Item label="Trạng thái kinh doanh" name="isActive">
            <Select allowClear placeholder="Chọn trạng thái">
              <Select.Option value={true}>Đang kinh doanh</Select.Option>
              <Select.Option value={false}>Ngừng kinh doanh</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Đơn vị tính" name="unitOfMeasure">
                <Select allowClear placeholder="UoM">
                  <Select.Option value="SETS">SETS</Select.Option>
                  <Select.Option value="PCS">PCS</Select.Option>
                  <Select.Option value="TONS">TONS</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tiền tệ" name="exportCurrency">
                <Select allowClear placeholder="Currency">
                  <Select.Option value="USD">USD</Select.Option>
                  <Select.Option value="VND">VND</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Mã HS Code" name="hsCode">
            <Input placeholder="Nhập chính xác HS Code" allowClear />
          </Form.Item>

          <Divider titlePlacement="left">Logistics & Kho</Divider>
          
          <Form.Item label="Phân loại / Ngành hàng" name="category">
            <Input placeholder="Ví dụ: Nội thất, Điện tử..." allowClear />
          </Form.Item>

          <Form.Item label="Thương hiệu" name="brand">
            <Input placeholder="Nhập tên Brand" allowClear />
          </Form.Item>

          <Form.Item label="CBM mỗi thùng (Range)" name="cbmRange">
            <Slider range min={0} max={1} step={0.01} 
              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
            />
          </Form.Item>

          <Form.Item label="Tồn kho tối thiểu" name="minStock">
            <InputNumber style={{ width: '100%' }} placeholder="Ví dụ: 100" />
          </Form.Item>

          <Divider titlePlacement="left">Tài chính</Divider>

          <Form.Item label="Khoảng giá xuất khẩu" name="priceRange">
            <Slider 
              range 
              min={0} 
              max={10000000} 
              step={100000}
              tooltip={{ formatter: (val) => `${val?.toLocaleString()} USD` }}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <ProductModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        fetchData={fetchProducts}
        dataUpdate={dataUpdate}
      />

      <AdjustmentModal
        isOpen={isAdjOpen}
        setIsOpen={setIsAdjOpen}
        product={productForAdj}
        fetchData={fetchProducts}
      />
    </div>
  );
};

export default ProductTable;
