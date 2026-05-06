'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Tag, 
  Typography, 
  Card, 
  Space, 
  Button, 
  Modal, 
  Form, 
  Select, 
  Input, 
  InputNumber, 
  DatePicker,
  notification, 
  Badge, 
  Row, 
  Col,
  App
} from 'antd';
import { TransactionOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import dayjs from 'dayjs';

const { Text } = Typography;

const GeneralPaymentTable = () => {
  const { data: session } = useSession();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 15, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [form] = Form.useForm();

  const accessToken = session?.access_token;

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/transactions`,
      method: 'GET',
      queryParams: {
        current: meta.current,
        pageSize: meta.pageSize,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setData(res.data);
      // setMeta(res.data.meta); // Backend might return raw array for now
    }
    setLoading(false);
  }, [accessToken, meta.current, meta.pageSize]);

  const fetchContracts = async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setContracts(res.data.results);
    }
  };

  useEffect(() => {
    fetchData();
    if (isModalOpen) fetchContracts();
  }, [fetchData, accessToken]);

  const handleSubmit = async (values: any) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/transactions`,
        method: 'POST',
        body: {
          ...values,
          transactionDate: values.transactionDate?.toISOString(),
          dueDate: values.dueDate?.toISOString(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        notification.success({ title: 'Ghi nhận thanh toán thành công' });
        setIsModalOpen(false);
        form.resetFields();
        fetchData();
      }
    } catch (error: any) {
      message.error(error.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'transactionDate',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Hợp đồng / Đối tác',
      render: (_: any, r: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{r.salesContract?.contractNumber}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.salesContract?.buyer?.name}</Text>
        </Space>
      ),
    },
    {
      title: 'Phương thức',
      dataIndex: 'type',
      render: (v: string) => {
        const config: any = {
          'TT_ADVANCE': { color: 'blue', label: 'T/T Advance' },
          'TT_BALANCE': { color: 'cyan', label: 'T/T Balance' },
          'DP': { color: 'orange', label: 'D/P' },
          'DA': { color: 'purple', label: 'D/A' },
        };
        const item = config[v] || { color: 'default', label: v };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      align: 'right' as const,
      render: (v: number, r: any) => (
        <Space orientation="vertical" align="end" size={0}>
          <Text strong>{v?.toLocaleString()} {r.currency}</Text>
          {r.exchangeRate > 1 && <Text type="secondary" style={{ fontSize: 11 }}>Tỷ giá: {r.exchangeRate?.toLocaleString()}</Text>}
        </Space>
      ),
    },
    {
      title: 'Tham chiếu Ngân hàng',
      dataIndex: 'bankReference',
      render: (v: string) => <Text code>{v || '-'}</Text>,
    },
    {
        title: 'Trạng thái',
        dataIndex: 'status',
        render: (v: string) => {
          const statusMap: any = {
            'PENDING': { color: 'processing', text: 'Chờ xử lý' },
            'RECEIVED': { color: 'success', text: 'Đã nhận tiền' },
            'PAID': { color: 'success', text: 'Đã trả tiền' },
            'REJECTED': { color: 'error', text: 'Từ chối' },
            'CANCELLED': { color: 'default', text: 'Đã hủy' },
          };
          const item = statusMap[v] || { color: 'default', text: v };
          return <Badge color={item.color} text={item.text} />;
        }
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <PageHeader 
          title="Thanh Toán Quốc Tế (T/T, D/P, D/A)" 
          icon={<TransactionOutlined className="text-blue-500" />} 
          description="Quản lý các giao dịch thanh toán trực tiếp, nhờ thu và chấp nhận chứng từ" 
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => {
            fetchContracts();
            setIsModalOpen(true);
          }}
          size="large"
          className="rounded-lg"
        >
          Ghi nhận thanh toán
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200/60 rounded-2xl overflow-hidden">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...meta,
            showSizeChanger: true,
            onChange: (page, size) => setMeta({ ...meta, current: page, pageSize: size }),
          }}
          className="premium-table"
        />
      </Card>

      <Modal
        title="Ghi nhận giao dịch thanh toán quốc tế"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
        confirmLoading={loading}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ currency: 'USD', exchangeRate: 25450 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Hợp đồng liên quan" name="salesContractId" rules={[{ required: true }]}>
                <Select placeholder="Chọn hợp đồng xuất khẩu" showSearch optionFilterProp="children">
                  {contracts.map(c => (
                    <Select.Option key={c.id} value={c.id}>{c.contractNumber} - {c.buyer?.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phương thức thanh toán" name="type" rules={[{ required: true }]}>
                <Select placeholder="Chọn phương thức">
                  <Select.Option value="TT_ADVANCE">T/T Advance (Trả trước)</Select.Option>
                  <Select.Option value="TT_BALANCE">T/T Balance (Thanh toán nốt)</Select.Option>
                  <Select.Option value="DP">Nhờ thu trả ngay (D/P)</Select.Option>
                  <Select.Option value="DA">Nhờ thu trả chậm (D/A)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Số tiền" name="amount" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Tiền tệ" name="currency" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="USD">USD</Select.Option>
                  <Select.Option value="VND">VND</Select.Option>
                  <Select.Option value="EUR">EUR</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Tỷ giá hạch toán" name="exchangeRate" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ngày thanh toán / Ngày điện" name="transactionDate" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số tham chiếu Ngân hàng (Bank Ref/Swift)" name="bankReference">
                <Input placeholder="Nhập số Swift hoặc số bút toán..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ngân hàng chuyển (Remitting Bank)" name="remittingBank">
                <Input placeholder="Tên ngân hàng phía đối tác" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngân hàng thụ hưởng (Receiving Bank)" name="receivingBank">
                <Input placeholder="Tên ngân hàng của công ty" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea placeholder="Thông tin bổ sung..." />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx global>{`
        .premium-table .ant-table-thead > tr > th {
          background: #f8fafc;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
};

export default GeneralPaymentTable;
