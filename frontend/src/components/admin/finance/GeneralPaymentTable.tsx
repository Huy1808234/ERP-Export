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
  Badge,
  Row,
  Col,
  App,
  Segmented,
  Tabs,
  Progress,
  theme
} from 'antd';
import { useTranslations } from 'next-intl';
import {
  TransactionOutlined,
  PlusOutlined,
  FileTextOutlined,
  SolutionOutlined,
  BankOutlined,
  DollarOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import dayjs from 'dayjs';
import { useTheme } from '@/context/theme.context';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const formatForeignAmount = (value: number | undefined, currency: string | undefined) => (
  `${Number(value || 0).toLocaleString()} ${currency || ''}`.trim()
);

const GeneralPaymentTable = () => {
  const { data: session } = useSession();
  const tF = useTranslations('Finance');
  const { message, modal, notification } = App.useApp();
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ current: 1, pageSize: 15, total: 0 });
  const { current, pageSize } = meta;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [targetType, setTargetType] = useState<'CONTRACT' | 'INVOICE'>('CONTRACT');
  const [reconciliationSummary, setReconciliationSummary] = useState<any>(null);
  const [form] = Form.useForm();

  const accessToken = getAccessToken(session);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/transactions`,
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
        pageSize: res.data.pageSize || 15,
        total: res.data.totalItems || 0
      });
    }
    setLoading(false);
  }, [accessToken, current, pageSize]);

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

  const fetchInvoices = useCallback(async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/vendor-invoices`,
      method: 'GET',
      queryParams: { status: 'PENDING' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setInvoices(res.data.results || []);
    }
  }, [accessToken]);

  const fetchReconciliationSummary = useCallback(async (salesContractId: string) => {
    if (!accessToken || !salesContractId) return;
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/transactions/reconciliation/sales-contract/${salesContractId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) {
      setReconciliationSummary(res.data);
      const currentType = form.getFieldValue('type');
      const suggestedAmount = currentType === 'TT_ADVANCE'
        ? res.data.paymentPlan?.advance?.remaining || res.data.remainingAdvance || res.data.openAr
        : res.data.paymentPlan?.balance?.remaining || res.data.openAr;
      if (suggestedAmount > 0) {
        form.setFieldsValue({
          amount: suggestedAmount,
          currency: res.data.currency,
        });
      }
    }
  }, [accessToken, form]);

  useEffect(() => {
    fetchData();
    fetchContracts();
    fetchInvoices();
  }, [fetchData, fetchContracts, fetchInvoices]);

  const openPaymentModal = (type: 'CONTRACT' | 'INVOICE', record?: any) => {
    setTargetType(type);
    setReconciliationSummary(null);
    form.resetFields();
    setIsModalOpen(true);
    if (record) {
      setTimeout(() => {
        if (type === 'CONTRACT') {
          form.setFieldsValue({
            salesContractId: record._id,
            amount: record.totalAmount,
            currency: 'USD',
            exchangeRate: 25450,
            type: 'TT_BALANCE'
          });
          fetchReconciliationSummary(record._id);
        } else if (type === 'INVOICE') {
          form.setFieldsValue({
            vendorInvoiceIds: [record._id],
            amount: record.totalAmount,
            currency: record.currency || 'VND',
            exchangeRate: record.currency === 'VND' ? 1 : 25450,
            type: 'TT_BALANCE'
          });
        }
      }, 50);
    }
  };

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
        notification.success({ title: tF('notifications.success'), description: tF('notifications.successDetail') });
        setIsModalOpen(false);
        form.resetFields();
        setTargetType('CONTRACT');
        fetchData();
      }
    } catch (error: any) {
      message.error(error.message || tF('notifications.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!accessToken) return;

    // Confirm with user before posting accounting
    const statusText = status === 'RECEIVED' ? tF('table.received') : status === 'PAID' ? tF('table.paid') : tF('table.cancelled');

    modal.confirm({
      title: tF('notifications.confirmTitle', { status: statusText }),
      content: status === 'RECEIVED' || status === 'PAID'
        ? tF('notifications.confirmContent')
        : tF('notifications.confirmCancel'),
      okText: tF('notifications.confirmOk'),
      cancelText: tF('notifications.confirmBack'),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/transactions/${id}/status`,
            method: 'PATCH',
            body: { status },
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res?.data) {
            message.success(tF('notifications.statusUpdateSuccess'));
            fetchData();
          }
        } catch (error: any) {
          message.error(error.message || tF('notifications.error'));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleInvoicesChange = (ids: string[]) => {
    const selectedInvoices = invoices.filter(i => ids.includes(i._id));
    const total = selectedInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

    // Lấy thông tin currency từ invoice đầu tiên nếu có
    const firstInvoice = selectedInvoices[0];

    form.setFieldsValue({
      amount: total,
      currency: firstInvoice?.currency || 'VND',
      exchangeRate: firstInvoice?.currency === 'VND' ? 1 : 25450
    });
  };

  const columns = [
    {
      title: tF('table.date'),
      dataIndex: 'transactionDate',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: tF('table.subject'),
      render: (_: any, r: any) => {
        if (r.salesContract) {
          return (
            <Space orientation="vertical" size={0}>
              <Space><SolutionOutlined style={{ color: '#1890ff' }} /><Text strong>{r.salesContract.contractNumber}</Text></Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{tF('table.customer')}: {r.salesContract.buyer?.name}</Text>
            </Space>
          );
        }
        if (r.vendorInvoice) {
          const isMulti = r.note?.includes('Multi-payment');
          return (
            <Space orientation="vertical" size={0}>
              <Space>
                <FileTextOutlined style={{ color: '#fa8c16' }} />
                <Text strong>{isMulti ? tF('table.multiPayment') : `${tF('table.invoice')}: ${r.vendorInvoice.invoiceNumber}`}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{tF('table.supplier')}: {r.vendorInvoice.vendor?.name}</Text>
            </Space>
          );
        }
        return <Text type="secondary">N/A</Text>;
      }
    },
    {
      title: tF('table.method'),
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
      title: tF('table.amount'),
      dataIndex: 'amount',
      align: 'right' as const,
      render: (v: number, r: any) => (
        <Space orientation="vertical" align="end" size={0}>
          <Text strong style={{ color: (r.vendorInvoice || r.note?.includes('Multi-payment')) ? '#cf1322' : '#389e0d' }}>
            {(r.vendorInvoice || r.note?.includes('Multi-payment')) ? '-' : '+'}{v?.toLocaleString()} {r.currency}
          </Text>
          {r.exchangeRate > 1 && <Text type="secondary" style={{ fontSize: 11 }}>{tF('table.rate')}: {r.exchangeRate?.toLocaleString()}</Text>}
        </Space>
      ),
    },
    {
      title: tF('table.reference'),
      dataIndex: 'bankReference',
      render: (v: string) => <Text code>{v || '-'}</Text>,
    },
    {
      title: tF('table.status'),
      dataIndex: 'status',
      render: (v: string) => {
        const statusMap: any = {
          'PENDING': { color: 'processing', text: tF('table.pending') },
          'RECEIVED': { color: 'success', text: tF('table.received') },
          'PAID': { color: 'success', text: tF('table.paid') },
          'REJECTED': { color: 'error', text: tF('table.rejected') },
          'CANCELLED': { color: 'default', text: tF('table.cancelled') },
        };
        const item = statusMap[v] || { color: 'default', text: v };
        return <Badge color={item.color} text={item.text} />;
      }
    },
    {
      title: 'Đối chiếu',
      dataIndex: 'reconciliationStatus',
      render: (v: string, r: any) => {
        const status = v || 'PENDING';
        const color: Record<string, string> = {
          MATCHED: 'green',
          PARTIAL: 'orange',
          OVERPAID: 'red',
          UNDERPAID: 'volcano',
          NOT_REQUIRED: 'default',
          REJECTED: 'default',
          PENDING: 'processing',
        };
        return (
          <Space orientation="vertical" size={0}>
            <Tag color={color[status] || 'default'}>{status}</Tag>
            {r.expectedAmount !== null && r.expectedAmount !== undefined && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                Kỳ vọng: {Number(r.expectedAmount).toLocaleString()} {r.currency}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: tF('table.actions'),
      key: 'action',
      align: 'center' as const,
      render: (_: any, r: any) => {
        if (r.status !== 'PENDING') return null;

        const isIncome = !!r.salesContract;
        const approveStatus = isIncome ? 'RECEIVED' : 'PAID';

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              style={{ backgroundColor: '#389e0d', borderColor: '#389e0d' }}
              onClick={() => handleUpdateStatus(r._id, approveStatus)}
            >
              {tF('table.approve')}
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleUpdateStatus(r._id, 'CANCELLED')}
            >
              {tF('table.cancel')}
            </Button>
          </Space>
        );
      }
    }
  ];

  const contractColumns = [
    { title: tF('table.contractNumber'), dataIndex: 'contractNumber', render: (v: string) => <Text strong style={{ color: token.colorPrimary }}>{v}</Text> },
    { title: tF('table.customer'), dataIndex: ['buyer', 'name'] },
    { title: tF('table.amount'), dataIndex: 'totalAmount', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#389e0d' }}>+ {v?.toLocaleString()} USD</Text> },
    { title: tF('table.status'), dataIndex: 'status', render: () => <Badge status="warning" text={tF('table.arStatus')} /> },
    {
      title: tF('table.actions'), align: 'center' as const, render: (_: any, r: any) => (
        <Button type="primary" size="small" onClick={() => openPaymentModal('CONTRACT', r)}>
          {tF('table.createAR')}
        </Button>
      )
    }
  ];

  const invoiceColumns = [
    { title: tF('table.invoiceNumber'), dataIndex: 'invoiceNumber', render: (v: string) => <Text strong style={{ color: token.colorError }}>{v}</Text> },
    { title: tF('table.supplier'), dataIndex: ['vendor', 'name'] },
    { title: tF('table.amount'), dataIndex: 'totalAmount', align: 'right' as const, render: (v: number, r: any) => <Text strong style={{ color: '#cf1322' }}>- {v?.toLocaleString()} {r.currency}</Text> },
    { title: tF('table.status'), dataIndex: 'status', render: () => <Badge status="error" text={tF('table.apStatus')} /> },
    {
      title: tF('table.actions'), align: 'center' as const, render: (_: any, r: any) => (
        <Button type="primary" size="small" danger onClick={() => openPaymentModal('INVOICE', r)}>
          {tF('table.createAP')}
        </Button>
      )
    }
  ];

  const receivableAllocationColumns = [
    {
      title: 'Invoice / Contract',
      key: 'invoice',
      render: (_: unknown, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.invoiceNumber}</Text>
          <Space size={4}>
            {record.commercialInvoice_id && <Tag color="geekblue">CI</Tag>}
            {record.sourceType && <Tag color="default">{record.sourceType}</Tag>}
            <Text type="secondary" style={{ fontSize: 12 }}>{record.status}</Text>
            {record.isOverdue && <Tag color="red">OVERDUE</Tag>}
            {record.suggestedNextStage && <Tag>{record.suggestedNextStage}</Tag>}
          </Space>
          {record.dueDate && (
            <Text type="secondary" style={{ fontSize: 12 }}>Due {dayjs(record.dueDate).format('DD/MM/YYYY')}</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Stage status',
      key: 'stageStatus',
      width: 170,
      render: (_: unknown, record: any) => (
        <Space orientation="vertical" size={0}>
          <Tag color={record.advanceStatus === 'ALLOCATED' ? 'blue' : 'default'}>{record.advanceStatus || 'ADVANCE_NA'}</Tag>
          <Tag color={record.balanceStatus === 'SETTLED' ? 'green' : record.balanceStatus === 'PARTIAL_BALANCE' ? 'cyan' : 'orange'}>
            {record.balanceStatus || 'BALANCE_OPEN'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Invoice amount',
      dataIndex: 'amountForeign',
      align: 'right' as const,
      render: (value: number, record: any) => formatForeignAmount(value, record.currency),
    },
    {
      title: 'Advance allocated',
      dataIndex: 'advanceAllocated',
      align: 'right' as const,
      render: (value: number, record: any) => <Text type={value > 0 ? 'success' : 'secondary'}>{formatForeignAmount(value, record.currency)}</Text>,
    },
    {
      title: 'Balance allocated',
      dataIndex: 'balanceAllocated',
      align: 'right' as const,
      render: (value: number, record: any) => <Text type={value > 0 ? 'success' : 'secondary'}>{formatForeignAmount(value, record.currency)}</Text>,
    },
    {
      title: 'Collection',
      dataIndex: 'collectionAllocated',
      align: 'right' as const,
      render: (value: number, record: any) => <Text type={value > 0 ? 'success' : 'secondary'}>{formatForeignAmount(value, record.currency)}</Text>,
    },
    {
      title: 'Allocated',
      dataIndex: 'allocatedTotal',
      align: 'right' as const,
      render: (value: number, record: any) => (
        <Space orientation="vertical" align="end" size={0}>
          <Text strong>{formatForeignAmount(value ?? Number(record.paidAmountForeign || 0), record.currency)}</Text>
          <Progress
            percent={Math.min(Number(record.allocationPercent || 0), 100)}
            size="small"
            showInfo={false}
            style={{ width: 90 }}
          />
        </Space>
      ),
    },
    {
      title: 'Open',
      dataIndex: 'remainingForeign',
      align: 'right' as const,
      render: (value: number, record: any) => <Text type={value > 0 ? 'danger' : 'success'}>{formatForeignAmount(value, record.currency)}</Text>,
    },
  ];

  const allocationDetailColumns = [
    {
      title: 'Stage',
      dataIndex: 'paymentStage',
      width: 110,
      render: (value: string) => <Tag color={value === 'ADVANCE' ? 'blue' : value === 'BALANCE' ? 'cyan' : 'orange'}>{value}</Tag>,
    },
    {
      title: 'Transaction',
      key: 'transaction',
      render: (_: unknown, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text code>{record.bankReference || record.tradeFinanceTransactionId || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.transactionType || 'MANUAL'} - {record.transactionStatus || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Allocated',
      dataIndex: 'allocatedAmountForeign',
      align: 'right' as const,
      render: (value: number, record: any) => formatForeignAmount(value, record.currency),
    },
    {
      title: 'Date',
      dataIndex: 'allocatedAt',
      width: 130,
      render: (value: string) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
    },
  ];

  const transactionAllocationColumns = [
    {
      title: 'Transaction',
      key: 'transaction',
      render: (_: unknown, record: any) => (
        <Space orientation="vertical" size={0}>
          <Space>
            <Tag color={record.paymentStage === 'ADVANCE' ? 'blue' : record.paymentStage === 'BALANCE' ? 'cyan' : 'orange'}>
              {record.type}
            </Tag>
            <Text code>{record.bankReference || record._id}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.transactionDate ? dayjs(record.transactionDate).format('DD/MM/YYYY') : '-'} - {record.reconciliationStatus || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Received',
      dataIndex: 'amount',
      align: 'right' as const,
      render: (value: number, record: any) => formatForeignAmount(value, record.currency),
    },
    {
      title: 'Allocated',
      dataIndex: 'allocatedAmount',
      align: 'right' as const,
      render: (value: number, record: any) => <Text type="success">{formatForeignAmount(value, record.currency)}</Text>,
    },
    {
      title: 'Unallocated',
      dataIndex: 'unallocatedAmount',
      align: 'right' as const,
      render: (value: number, record: any) => <Text type={value > 0 ? 'danger' : 'secondary'}>{formatForeignAmount(value, record.currency)}</Text>,
    },
  ];

  return (
    <div style={{ backgroundColor: 'transparent', transition: 'all 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <PageHeader
          title={tF('title')}
          icon={<TransactionOutlined style={{ color: '#1890ff' }} />}
          description={tF('description')}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          size="large"
          style={{ borderRadius: 8, height: 45, fontWeight: 600 }}
        >
          {tF('createBtn')}
        </Button>
      </div>

      <Card
        variant="borderless"
        style={{
          borderRadius: 16,
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.06)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          defaultActiveKey="1"
          size="large"
          tabBarStyle={{
            padding: '0 24px',
            marginBottom: 0,
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '16px 16px 0 0',
          }}
          items={[
            {
              key: '1',
              label: <span style={{ fontWeight: 600 }}>{tF('tabs.history')}</span>,
              children: (
                <div style={{ padding: 24 }}>
                  <Table
                    rowKey="_id"
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
                </div>
              )
            },
            {
              key: '2',
              label: <span style={{ fontWeight: 600 }}><Badge count={contracts.length} offset={[10, 0]} color="blue">{tF('tabs.ar')}</Badge></span>,
              children: (
                <div style={{ padding: 24 }}>
                  <Table rowKey="_id" columns={contractColumns} dataSource={contracts} className="premium-table" pagination={{ pageSize: 10 }} />
                </div>
              )
            },
            {
              key: '3',
              label: <span style={{ fontWeight: 600 }}><Badge count={invoices.length} offset={[10, 0]} color="red">{tF('tabs.ap')}</Badge></span>,
              children: (
                <div style={{ padding: 24 }}>
                  <Table rowKey="_id" columns={invoiceColumns} dataSource={invoices} className="premium-table" pagination={{ pageSize: 10 }} />
                </div>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={
          <Space size="middle">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(24, 144, 255, 0.2)' }}>
              <DollarOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 18, display: 'block' }}>{tF('modal.title')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{tF('modal.subtitle')}</Text>
            </div>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setTargetType('CONTRACT');
        }}
        onOk={() => form.submit()}
        width={950}
        confirmLoading={loading}
        okText={tF('modal.okText')}
        cancelText={tF('modal.cancelText')}
        className="general-payment-modal"
        styles={{
          header: { paddingBottom: 24, borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`, background: token.colorBgContainer },
          body: { paddingTop: 24, background: token.colorBgContainer },
          footer: { background: token.colorBgContainer, borderTop: `1px solid ${isDark ? '#334155' : '#f0f0f0'}` },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ currency: 'VND', exchangeRate: 1, type: 'TT_BALANCE' }}
        >
          <Form.Item label={<Text strong>{tF('modal.paymentType')}</Text>}>
            <Segmented
              block
              size="large"
              options={[
                { label: tF('modal.typeIn'), value: 'CONTRACT', icon: <SolutionOutlined /> },
                { label: tF('modal.typeOut'), value: 'INVOICE', icon: <FileTextOutlined /> },
              ]}
              value={targetType}
              onChange={(v: any) => {
                setTargetType(v);
                setReconciliationSummary(null);
                form.resetFields(['salesContractId', 'vendorInvoiceIds', 'amount']);
              }}
            />
          </Form.Item>

          <Card
            variant="borderless"
            style={{
              background: isDark ? '#1e293b' : '#f8fafc',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <Row gutter={24}>
              <Col span={24}>
                {targetType === 'CONTRACT' ? (
                  <Form.Item label={<Text strong>{tF('modal.contractLabel')}</Text>} name="salesContractId" rules={[{ required: true }]}>
                    <Select
                      placeholder={tF('modal.contractPlaceholder')}
                      showSearch
                      optionFilterProp="children"
                      size="large"
                      onChange={(value) => fetchReconciliationSummary(value)}
                    >
                      {contracts.map(c => (
                        <Select.Option key={c._id} value={c._id}>
                          <Space>
                            <Badge status="processing" />
                            {c.contractNumber} - {c.buyer?.name}
                          </Space>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                ) : (
                  <Form.Item label={<Text strong>{tF('modal.invoiceLabel')}</Text>} name="vendorInvoiceIds" rules={[{ required: true }]}>
                    <Select
                      mode="multiple"
                      placeholder={tF('modal.invoicePlaceholder')}
                      showSearch
                      optionFilterProp="children"
                      onChange={handleInvoicesChange}
                      size="large"
                      maxTagCount="responsive"
                    >
                      {invoices.map(i => (
                        <Select.Option key={i._id} value={i._id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong>#{i.invoiceNumber} - {i.vendor?.name}</Text>
                            <Text type="danger">{i.totalAmount.toLocaleString()} {i.currency}</Text>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )}
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label={<Text strong>{tF('modal.methodLabel')}</Text>} name="type" rules={[{ required: true }]}>
                  <Select
                    placeholder={tF('modal.methodLabel')}
                    size="large"
                    onChange={() => {
                      const salesContractId = form.getFieldValue('salesContractId');
                      if (salesContractId) fetchReconciliationSummary(salesContractId);
                    }}
                  >
                    <Select.Option value="TT_ADVANCE">T/T Advance (Trả trước/Tạm ứng)</Select.Option>
                    <Select.Option value="TT_BALANCE">T/T Balance (Thanh toán nốt)</Select.Option>
                    <Select.Option value="DP">Nhờ thu trả ngay (D/P)</Select.Option>
                    <Select.Option value="DA">Nhờ thu trả chậm (D/A)</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={<Text strong>{tF('modal.dateLabel')}</Text>} name="transactionDate" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" size="large" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {targetType === 'CONTRACT' && reconciliationSummary && (
            <Card
              variant="borderless"
              style={{
                border: `1px solid ${isDark ? '#334155' : '#dbeafe'}`,
                background: isDark ? '#0f172a' : '#eff6ff',
                borderRadius: 12,
                marginBottom: 24,
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <Text type="secondary">Giá trị HĐ</Text>
                  <div><Text strong>{formatForeignAmount(reconciliationSummary.contractTotal, reconciliationSummary.currency)}</Text></div>
                </Col>
                <Col xs={24} md={6}>
                  <Text type="secondary">T/T Advance</Text>
                  <div>
                    <Text strong>
                      {formatForeignAmount(reconciliationSummary.paymentPlan?.advance?.received, reconciliationSummary.currency)}
                    </Text>
                    <Text type="secondary"> / {formatForeignAmount(reconciliationSummary.paymentPlan?.advance?.expected, reconciliationSummary.currency)}</Text>
                  </div>
                  <Progress
                    percent={Math.min(Math.round(((reconciliationSummary.paymentPlan?.advance?.received || 0) / Math.max(reconciliationSummary.paymentPlan?.advance?.expected || 1, 1)) * 100), 100)}
                    size="small"
                    showInfo={false}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Alloc {formatForeignAmount(reconciliationSummary.paymentPlan?.advance?.allocated, reconciliationSummary.currency)}
                    {' '}| Remain {formatForeignAmount(reconciliationSummary.paymentPlan?.advance?.remaining, reconciliationSummary.currency)}
                  </Text>
                </Col>
                <Col xs={24} md={6}>
                  <Text type="secondary">T/T Balance</Text>
                  <div>
                    <Text strong>
                      {formatForeignAmount(
                        (reconciliationSummary.paymentPlan?.balance?.received || 0)
                        + (reconciliationSummary.paymentPlan?.balance?.receivedViaCollections || 0),
                        reconciliationSummary.currency,
                      )}
                    </Text>
                    <Text type="secondary"> / {formatForeignAmount(reconciliationSummary.paymentPlan?.balance?.expected, reconciliationSummary.currency)}</Text>
                  </div>
                  <Progress
                    percent={Math.min(Math.round((((reconciliationSummary.paymentPlan?.balance?.received || 0) + (reconciliationSummary.paymentPlan?.balance?.receivedViaCollections || 0)) / Math.max(reconciliationSummary.paymentPlan?.balance?.expected || 1, 1)) * 100), 100)}
                    size="small"
                    showInfo={false}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    T/T {formatForeignAmount(reconciliationSummary.paymentPlan?.balance?.received, reconciliationSummary.currency)}
                    {' '}| Collection {formatForeignAmount(reconciliationSummary.paymentPlan?.balance?.receivedViaCollections, reconciliationSummary.currency)}
                  </Text>
                </Col>
                <Col xs={24} md={6}>
                  <Text type="secondary">Còn phải thu</Text>
                  <div>
                    <Text strong type={reconciliationSummary.openAr > 0 ? 'danger' : 'success'}>
                      {formatForeignAmount(reconciliationSummary.openAr, reconciliationSummary.currency)}
                    </Text>
                  </div>
                  <Tag color={reconciliationSummary.status === 'SETTLED' ? 'green' : 'orange'}>{reconciliationSummary.status}</Tag>
                </Col>
              </Row>
              {(reconciliationSummary.invoiceAllocationMatrix || reconciliationSummary.receivableAllocations || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>Phân bổ theo invoice / contract</Text>
                  <Table
                    rowKey="accountReceivableId"
                    size="small"
                    columns={receivableAllocationColumns}
                    dataSource={reconciliationSummary.invoiceAllocationMatrix || reconciliationSummary.receivableAllocations || []}
                    pagination={false}
                    style={{ marginTop: 8 }}
                    expandable={{
                      expandedRowRender: (record: any) => (
                        <Table
                          rowKey="_id"
                          size="small"
                          columns={allocationDetailColumns}
                          dataSource={record.allocations || []}
                          pagination={false}
                        />
                      ),
                    }}
                  />
                </div>
              )}
              {(reconciliationSummary.transactionAllocations || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>Allocation theo từng giao dịch T/T</Text>
                  <Table
                    rowKey="_id"
                    size="small"
                    columns={transactionAllocationColumns}
                    dataSource={reconciliationSummary.transactionAllocations || []}
                    pagination={false}
                    style={{ marginTop: 8 }}
                  />
                </div>
              )}
            </Card>
          )}

          <Row gutter={24}>
            <Col span={10}>
              <Form.Item label={<Text strong>{tF('modal.amountLabel', { type: targetType === 'INVOICE' ? tF('modal.typeOutLabel') : tF('modal.typeInLabel') })}</Text>} name="amount" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                  prefix={targetType === 'INVOICE' ? <Text type="danger" strong>-</Text> : <Text type="success" strong>+</Text>}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label={<Text strong>{tF('modal.currencyLabel')}</Text>} name="currency" rules={[{ required: true }]}>
                <Select size="large" onChange={(v) => form.setFieldsValue({ exchangeRate: v === 'VND' ? 1 : 25450 })}>
                  <Select.Option value="VND">VND</Select.Option>
                  <Select.Option value="USD">USD</Select.Option>
                  <Select.Option value="EUR">EUR</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<Text strong>{tF('modal.rateLabel')}</Text>} name="exchangeRate" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={24}>
              <Form.Item label={<Text strong>{tF('modal.referenceLabel')}</Text>} name="bankReference">
                <Input size="large" prefix={<BankOutlined style={{ color: '#bfbfbf' }} />} placeholder={tF('modal.referencePlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={<Text strong>{tF('modal.noteLabel')}</Text>} name="note">
            <Input.TextArea rows={2} placeholder={tF('modal.notePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx global>{`
        .general-payment-modal .ant-modal-content {
          background: ${token.colorBgContainer} !important;
        }
        .general-payment-modal .ant-modal-header {
          margin-bottom: 0 !important;
        }
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc'} !important;
          color: ${isDark ? '#94a3b8' : '#64748b'} !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.05em !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          background: transparent !important;
          color: ${isDark ? '#e2e8f0' : token.colorText} !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'} !important;
        }
        .premium-table .ant-table-tbody > tr:hover > td {
          background: ${isDark ? 'rgba(51, 65, 85, 0.45)' : '#f1f5f9'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
        .premium-table .ant-empty-description {
          color: ${isDark ? '#94a3b8' : '#64748b'} !important;
        }
        .premium-table .ant-pagination {
          color: ${token.colorText} !important;
        }
      `}</style>
    </div>
  );
};

export default GeneralPaymentTable;
