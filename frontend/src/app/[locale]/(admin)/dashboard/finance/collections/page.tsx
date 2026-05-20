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
  App,
} from 'antd';
import { 
    AuditOutlined, 
    PlusOutlined, 
    BankOutlined, 
    CalendarOutlined,
    GlobalOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import { useTheme } from '@/context/theme.context';
import { useTranslations } from 'next-intl';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const CollectionOrdersPage = () => {
  const { data: session } = useSession();
  const { message } = App.useApp();
  const { isDark } = useTheme();
  const t = useTranslations('Collections');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [orderType, setOrderType] = useState<'DP' | 'DA'>('DP');
  const { current, pageSize } = meta;

  const accessToken = getAccessToken(session);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/collections`,
      method: 'GET',
        queryParams: {
        current,
        pageSize,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setData(res.data.results || res.data);
      setMeta({
        current: res.data.current || 1,
        pageSize: res.data.pageSize || 10,
        total: res.data.totalItems || 0
      });
    }
    setLoading(false);
  }, [accessToken, current, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchContracts = useCallback(async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/sales-contracts`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setContracts(res.data.results || []);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isModalOpen) fetchContracts();
  }, [isModalOpen, fetchContracts]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/collections`,
        method: 'POST',
        body: {
          ...values,
          presentationDate: values.presentationDate?.toISOString(),
          maturityDate: values.maturityDate?.toISOString(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
        notification.success({ title: t('notifications.createSuccess') });
        setIsModalOpen(false);
        form.resetFields();
        fetchData();
      }
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
      const res = await sendRequest<IBackendRes<any>>({
          url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/collections/${id}/status`,
          method: 'PATCH',
          body: { status },
          headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res?.data) {
          message.success(t('notifications.statusUpdateSuccess'));
          fetchData();
      }
  };

  const columns = [
    {
      title: t('table.orderContract'),
      key: 'info',
      render: (r: any) => (
          <Space orientation="vertical" size={0}>
              <Text strong>{r.orderNumber}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('table.contractPrefix')}: {r.salesContract?.contractNumber}</Text>
          </Space>
      )
    },
    {
      title: t('table.customer'),
      dataIndex: ['salesContract', 'buyer', 'name'],
    },
    {
      title: t('table.type'),
      dataIndex: 'type',
      render: (v: string) => (
          <Tag color={v === 'DP' ? 'cyan' : 'purple'} style={{ fontWeight: 600 }}>
              {v === 'DP' ? t('types.DP') : t('types.DA')}
          </Tag>
      )
    },
    {
      title: t('table.amount'),
      key: 'amount',
      align: 'right' as const,
      render: (r: any) => (
          <Text strong style={{ color: '#0958d9' }}>{r.amount?.toLocaleString()} {r.currency}</Text>
      )
    },
    {
      title: t('table.maturity'),
      key: 'maturity',
      render: (r: any) => {
          if (r.type !== 'DA') return '-';
          const isOverdue = dayjs().isAfter(dayjs(r.maturityDate));
          return (
              <Space orientation="vertical" size={0}>
                  <Text style={{ color: isOverdue ? '#cf1322' : 'inherit' }}>
                      <CalendarOutlined /> {dayjs(r.maturityDate).format('DD/MM/YYYY')}
                  </Text>
                  {isOverdue && <Badge status="error" text={t('status.overdue')} />}
              </Space>
          )
      }
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      render: (v: string) => {
        const config: any = {
          'SENT': { color: 'processing', text: t('status.SENT') },
          'ACCEPTED': { color: 'warning', text: t('status.ACCEPTED') },
          'PAID': { color: 'success', text: t('status.PAID') },
          'DISHONOURED': { color: 'error', text: t('status.DISHONOURED') },
        };
        const item = config[v] || { color: 'default', text: v };
        return <Badge color={item.color} text={item.text} />;
      }
    },
    {
      title: t('table.actions'),
      key: 'action',
      render: (r: any) => (
        <Space>
          {r.status === 'SENT' && (
              <Button size="small" type="primary" ghost onClick={() => handleStatusUpdate(r._id, 'ACCEPTED')}>
                  {t('actions.acceptDA')}
              </Button>
          )}
          {r.status !== 'PAID' && (
              <Button size="small" type="primary" onClick={() => handleStatusUpdate(r._id, 'PAID')}>
                  {t('actions.markPaid')}
              </Button>
          )}
        </Space>
      ),
    }
  ];

  return (
    <AdminPageScroll>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <PageHeader 
          title={t('title')} 
          icon={<AuditOutlined style={{ color: '#722ed1' }} />} 
          description={t('description')} 
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setIsModalOpen(true)}
          size="large"
          style={{ borderRadius: 8, background: '#722ed1', borderColor: '#722ed1' }}
        >
          {t('actions.create')}
        </Button>
      </div>

      <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <Table
          rowKey={(record: any) => record._id || record.collectionNumber}
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...meta,
            showSizeChanger: true,
            onChange: (page, size) => setMeta({ ...meta, current: page, pageSize: size }),
          }}
        />
      </Card>

      <Modal
        title={
            <Space size="middle">
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GlobalOutlined style={{ color: '#fff', fontSize: 20 }} />
                </div>
                <Text strong style={{ fontSize: 18 }}>{t('modal.title')}</Text>
            </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={750}
        confirmLoading={loading}
        okText={t('modal.okText')}
        cancelText={t('modal.cancelText')}
      >
        <Form 
            form={form} 
            layout="vertical" 
            onFinish={handleSubmit} 
            initialValues={{ type: 'DP', currency: 'USD', presentationDate: dayjs() }}
            style={{ marginTop: 24 }}
        >
          <Row gutter={24}>
              <Col span={12}>
                <Form.Item label={t('modal.fields.orderNumber')} name="orderNumber" rules={[{ required: true }]}>
                    <Input placeholder={t('modal.placeholders.orderNumber')} size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('modal.fields.salesContract')} name="salesContractId" rules={[{ required: true }]}>
                    <Select placeholder={t('modal.placeholders.salesContract')} size="large" showSearch optionFilterProp="children">
                        {contracts.map(c => (
                            <Select.Option key={c._id} value={c._id}>{c.contractNumber} - {c.buyer?.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
              </Col>
          </Row>

          <Row gutter={24}>
              <Col span={12}>
                  <Form.Item label={t('modal.fields.type')} name="type" rules={[{ required: true }]}>
                      <Select size="large" onChange={(v) => setOrderType(v)}>
                          <Select.Option value="DP">{t('modal.typeOptions.DP')}</Select.Option>
                          <Select.Option value="DA">{t('modal.typeOptions.DA')}</Select.Option>
                      </Select>
                  </Form.Item>
              </Col>
              <Col span={12}>
                  <Form.Item label={t('modal.fields.presentationDate')} name="presentationDate" rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} size="large" format="DD/MM/YYYY" />
                  </Form.Item>
              </Col>
          </Row>

          <Card variant="borderless" style={{ background: isDark ? '#1e293b' : '#f0f5ff', marginBottom: 24, borderRadius: 12 }}>
              <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label={t('modal.fields.remittingBank')} name="remittingBank" rules={[{ required: true }]}>
                        <Input prefix={<BankOutlined />} placeholder={t('modal.placeholders.remittingBank')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('modal.fields.collectingBank')} name="collectingBank">
                        <Input prefix={<BankOutlined />} placeholder={t('modal.placeholders.collectingBank')} />
                    </Form.Item>
                  </Col>
              </Row>

              <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item label={t('modal.fields.amount')} name="amount" rules={[{ required: true }]}>
                        <InputNumber 
                            style={{ width: '100%' }} 
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                            parser={v => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                        />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item label={t('modal.fields.currency')} name="currency">
                        <Select>
                            <Select.Option value="USD">USD</Select.Option>
                            <Select.Option value="EUR">EUR</Select.Option>
                            <Select.Option value="VND">VND</Select.Option>
                        </Select>
                    </Form.Item>
                  </Col>
                  {orderType === 'DA' && (
                      <Col span={12}>
                        <Form.Item label={t('modal.fields.maturityDate')} name="maturityDate" rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={t('modal.placeholders.maturityDate')} />
                        </Form.Item>
                      </Col>
                  )}
              </Row>
          </Card>

          <Form.Item label={t('modal.fields.note')} name="note">
              <Input.TextArea rows={2} placeholder={t('modal.placeholders.note')} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
};

export default CollectionOrdersPage;
