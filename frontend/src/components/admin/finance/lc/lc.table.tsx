'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Input,
  Card,
  Typography,
  Tooltip,
  Dropdown,
  App,
  Modal,
  Form,
  Select,
  DatePicker,
  Badge,
  Row,
  Col,
  Statistic,
  Segmented,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
  EyeOutlined,
  EditOutlined,
  MoreOutlined,
  FileProtectOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { lcService } from '@/services/lc.service';
import dayjs from 'dayjs';
import { useTheme } from '@/context/theme.context';
import { theme } from 'antd';
import LCModal from './lc.modal';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth-token';

const { Text } = Typography;

const deadlineSeverityMeta: Record<string, { color: string }> = {
  OVERDUE: { color: 'red' },
  TODAY: { color: 'volcano' },
  CRITICAL: { color: 'orange' },
  WARNING: { color: 'gold' },
  UPCOMING: { color: 'blue' },
};

const deadlineTypeLabel: Record<string, string> = {
  EXPIRY: 'L/C expiry',
  LATEST_SHIPMENT: 'Latest shipment',
  PRESENTATION: 'Presentation',
  DISCREPANCY: 'Discrepancy',
  INVOICE_DUE: 'Invoice due',
};

const formatMoney = (value: number | undefined, currency = 'USD') => (
  `${Number(value || 0).toLocaleString()} ${currency}`
);

const LCTable = () => {
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { message, notification } = App.useApp();
  const { data: session } = useSession();
  const t = useTranslations('LetterOfCredit');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0,
  });
  const { current, pageSize } = meta;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLC, setSelectedLC] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [deadlineWindow, setDeadlineWindow] = useState(14);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [discrepanciesByLc, setDiscrepanciesByLc] = useState<Record<string, any[]>>({});
  const [isDiscrepancyOpen, setIsDiscrepancyOpen] = useState(false);
  const [discrepancyForm] = Form.useForm();
  const accessToken = getAccessToken(session);

  const fetchData = useCallback(async (current: number, pageSize: number, query = '') => {
    setLoading(true);
    const res = await lcService.findAll<any>({
      current,
      pageSize,
      ...(query ? { lcNumber: `/${query}/i` } : {}),
    });

    setLoading(false);
    if (res?.data) {
      setData(res.data.results);
      setMeta(res.data.meta);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/deadline-dashboard`,
      method: 'GET',
      queryParams: { days: deadlineWindow },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) setAlerts(res.data);
  }, [accessToken, deadlineWindow]);

  const publishDeadlineNotifications = async () => {
    if (!accessToken) return;
    setNotifyLoading(true);
    try {
      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/deadline-dashboard/notify`,
        method: 'POST',
        queryParams: { days: deadlineWindow },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      notification.success({
        title: 'Deadline notifications sent',
        description: `${res?.data?.emitted || 0} alert(s) published to enabled channels`,
      });
      fetchAlerts();
    } catch (error: any) {
      message.error(error.message || 'Cannot publish deadline notifications');
    } finally {
      setNotifyLoading(false);
    }
  };

  useEffect(() => {
    fetchData(current, pageSize);
    fetchAlerts();
  }, [fetchData, fetchAlerts, current, pageSize]);

  const handleCreate = () => {
    setSelectedLC(null);
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setSelectedLC(record);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchData(current, pageSize);
    fetchAlerts();
  };

  const handleLCStatus = async (record: any, status: string) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${record._id}/status`,
        method: 'PATCH',
        body: { status },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      message.success('Đã cập nhật trạng thái L/C');
      fetchData(current, pageSize);
      fetchAlerts();
    } catch (error: any) {
      message.error(error.message || 'Không cập nhật được L/C');
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscrepancies = async (recordId: string) => {
    if (!accessToken) return;
    const res = await sendRequest<IBackendRes<any[]>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${recordId}/discrepancies`,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res?.data) setDiscrepanciesByLc(prev => ({ ...prev, [recordId]: res.data || [] }));
  };

  const openDiscrepancyModal = (record: any) => {
    setSelectedLC(record);
    discrepancyForm.resetFields();
    setIsDiscrepancyOpen(true);
  };

  const submitDiscrepancy = async (values: any) => {
    if (!selectedLC?._id || !accessToken) return;
    try {
      await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${selectedLC._id}/discrepancies`,
        method: 'POST',
        body: {
          ...values,
          dueDate: values.dueDate?.toISOString(),
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      notification.success({ title: 'Đã ghi nhận discrepancy' });
      setIsDiscrepancyOpen(false);
      fetchDiscrepancies(selectedLC._id);
      fetchAlerts();
    } catch (error: any) {
      message.error(error.message || 'Không tạo được discrepancy');
    }
  };

  const resolveDiscrepancy = async (lcId: string, discrepancyId: string, status: string) => {
    if (!accessToken) return;
    try {
      await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/trade-finance/lc/${lcId}/discrepancies/${discrepancyId}/resolve`,
        method: 'PATCH',
        body: { status },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      message.success('Đã xử lý discrepancy');
      fetchDiscrepancies(lcId);
      fetchAlerts();
    } catch (error: any) {
      message.error(error.message || 'Không xử lý được discrepancy');
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      DRAFT: { color: 'default', text: t('status.DRAFT') },
      RECEIVED: { color: 'processing', text: t('status.RECEIVED') },
      DOCUMENTS_PRESENTED: { color: 'warning', text: t('status.DOCUMENTS_PRESENTED') },
      ACCEPTED: { color: 'success', text: t('status.ACCEPTED') },
      PAID: { color: 'cyan', text: t('status.PAID') },
      EXPIRED: { color: 'error', text: t('status.EXPIRED') },
      CANCELLED: { color: 'magenta', text: t('status.CANCELLED') },
    };
    const item = statusMap[status] || { color: 'default', text: status };
    return <Tag color={item.color} style={{ borderRadius: '12px' }}>{item.text}</Tag>;
  };

  const columns = [
    {
      title: t('table.lcNumber'),
      dataIndex: 'lcNumber',
      key: 'lcNumber',
      render: (text: string) => <Text strong style={{ color: token.colorPrimary }}>{text}</Text>,
    },
    {
      title: t('table.issuingBank'),
      dataIndex: 'issuingBank',
      key: 'issuingBank',
    },
    {
      title: t('table.amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => (
        <Text strong>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: record.currency }).format(amount)}
        </Text>
      ),
    },
    {
      title: t('table.expiryDate'),
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: t('table.actions'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Tooltip title={t('tooltips.view')}>
            <Button type="text" icon={<EyeOutlined style={{ color: token.colorTextSecondary }} />} />
          </Tooltip>
          <Tooltip title={t('tooltips.edit')}>
            <Button
              type="text"
              icon={<EditOutlined style={{ color: token.colorPrimary }} />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: 'present', label: t('actions.presentDocuments'), icon: <FileProtectOutlined /> },
                { key: 'accept', label: 'Chấp nhận chứng từ', icon: <FileProtectOutlined /> },
                { key: 'report', label: t('actions.reportDiscrepancy'), icon: <ExclamationCircleOutlined />, danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'present') handleLCStatus(record, 'DOCUMENTS_PRESENTED');
                if (key === 'accept') handleLCStatus(record, 'ACCEPTED');
                if (key === 'report') openDiscrepancyModal(record);
              },
            }}
          >
            <Button type="text" icon={<MoreOutlined style={{ color: token.colorTextSecondary }} />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const discrepancyColumns = [
    {
      title: 'Discrepancy',
      dataIndex: 'description',
      render: (value: string, record: any) => (
        <div>
          <Text strong>{value}</Text>
          <div><Text type="secondary">{record.documentType || 'Document'} · {record.reportedByUsername}</Text></div>
        </div>
      ),
    },
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      width: 100,
      render: (value: string) => <Tag color={value === 'CRITICAL' ? 'red' : value === 'HIGH' ? 'volcano' : 'orange'}>{value}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 140,
      render: (value: string) => <Tag color={value === 'OPEN' ? 'red' : 'green'}>{value}</Tag>,
    },
    {
      title: 'Thao tác',
      width: 220,
      render: (_: any, record: any) => record.status === 'OPEN' ? (
        <Space>
          <Button size="small" onClick={() => resolveDiscrepancy(record.lcId, record._id, 'AMENDED')}>Đã sửa</Button>
          <Button size="small" type="primary" onClick={() => resolveDiscrepancy(record.lcId, record._id, 'WAIVED')}>Waive</Button>
        </Space>
      ) : record.resolvedByUsername || '-',
    },
  ];

  const deadlineColumns = [
    {
      title: 'Deadline',
      key: 'deadline',
      render: (_: unknown, record: any) => (
        <Space orientation="vertical" size={0}>
          <Space>
            <Tag color={deadlineSeverityMeta[record.severity]?.color || 'default'}>{record.severity}</Tag>
            <Text strong>{deadlineTypeLabel[record.type] || record.label}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.lcNumber} - {record.contractNumber || record.salesContractId || '-'} - {record.buyerName || '-'}
          </Text>
          {record.invoiceNumber && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Invoice {record.invoiceNumber} - open {formatMoney(record.openAmountForeign, record.currency)}
            </Text>
          )}
          {(record.notificationChannels || []).length > 0 && (
            <Space wrap size={4}>
              {(record.notificationChannels || []).map((channel: string) => (
                <Tag key={channel} color={channel === 'EMAIL_DIGEST' ? 'purple' : channel === 'SOCKET' ? 'geekblue' : 'default'}>
                  {channel}
                </Tag>
              ))}
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      width: 150,
      render: (value: string | null, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text>{value ? dayjs(value).format('DD/MM/YYYY') : 'No due date'}</Text>
          <Text type={record.daysRemaining !== null && record.daysRemaining < 0 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
            {record.daysRemaining === null
              ? 'Needs deadline'
              : record.daysRemaining < 0
                ? `Overdue ${Math.abs(record.daysRemaining)}d`
                : record.daysRemaining === 0
                  ? 'Today'
                  : `${record.daysRemaining}d left`}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (value: string, record: any) => (
        <Space orientation="vertical" size={0}>
          <Text>{value}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
          {(record.invoices || []).length > 0 && !record.invoiceNumber && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Open invoices: {(record.invoices || [])
                .slice(0, 3)
                .map((invoice: any) => `${invoice.invoiceNumber} ${formatMoney(invoice.openAmountForeign, invoice.currency)}`)
                .join(', ')}
            </Text>
          )}
        </Space>
      ),
    },
  ];

  const contractDeadlineColumns = [
    {
      title: 'Contract / Buyer',
      key: 'contract',
      render: (_: unknown, record: any) => (
        <Space orientation="vertical" size={0}>
          <Space>
            <Tag color={deadlineSeverityMeta[record.severity]?.color || 'default'}>{record.severity}</Tag>
            <Text strong>{record.label}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.buyerName || '-'} - {record.lcNumbers?.join(', ') || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Next deadline',
      dataIndex: 'nextDeadline',
      width: 150,
      render: (value: string | null) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Exposure',
      dataIndex: 'amountExposure',
      width: 150,
      align: 'right' as const,
      render: (value: number) => <Text strong>{formatMoney(value)}</Text>,
    },
    {
      title: 'Signals',
      key: 'signals',
      width: 220,
      render: (_: unknown, record: any) => (
        <Space wrap>
          <Badge status="error" text={`${record.counts?.overdue || 0} overdue`} />
          <Badge status="warning" text={`${record.counts?.critical || 0} critical`} />
          <Badge status="processing" text={`${record.typeBuckets?.PRESENTATION || 0} presentation`} />
          <Badge status="processing" text={`${record.typeBuckets?.INVOICE_DUE || 0} invoice`} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <PageHeader
          title={t('title')}
          icon={<FileProtectOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
          description={t('description')}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          style={{ borderRadius: '8px' }}
          onClick={handleCreate}
        >
          {t('actions.create')}
        </Button>
      </div>

      <Card
        variant="borderless"
        style={{
          borderRadius: '12px',
          background: 'transparent',
          boxShadow: 'none',
        }}
        styles={{ body: { padding: 0 } }}
      >
        {alerts?.counts && (
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}` }}>
            <Space className="w-full justify-between" style={{ marginBottom: 12 }} wrap>
              <Text strong>Deadline dashboard</Text>
              <Space wrap>
                <Segmented
                  value={deadlineWindow}
                  options={[
                    { label: '7 ngày', value: 7 },
                    { label: '14 ngày', value: 14 },
                    { label: '30 ngày', value: 30 },
                  ]}
                  onChange={(value) => setDeadlineWindow(Number(value))}
                />
                <Button
                  size="small"
                  icon={<BellOutlined />}
                  loading={notifyLoading}
                  onClick={publishDeadlineNotifications}
                >
                  Push notify
                </Button>
              </Space>
            </Space>
            <Row gutter={[16, 12]}>
              <Col xs={12} md={6}>
                <Statistic title="Overdue" value={alerts.counts.overdue || 0} styles={{ content: { color: token.colorError } }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Due today" value={alerts.counts.dueToday || 0} styles={{ content: { color: token.colorWarning } }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Critical" value={alerts.counts.critical || 0} styles={{ content: { color: token.colorWarning } }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Action required" value={alerts.counts.actionRequired || 0} styles={{ content: { color: token.colorError } }} />
              </Col>
            </Row>
            <Space wrap>
              <Badge status="error" text={`${alerts.counts.openDiscrepancies} discrepancy đang mở`} />
              <Badge status="warning" text={`${alerts.counts.expiring} L/C sắp hết hạn`} />
              <Badge status="processing" text={`${alerts.counts.presentationDeadline} deadline xuất trình`} />
              <Badge status="processing" text={`${alerts.counts.invoiceDue || 0} invoice due`} />
            </Space>
            <Row gutter={[16, 12]} style={{ marginTop: 12 }}>
              <Col xs={24} md={6}>
                <Statistic title="Deadline exposure" value={formatMoney(alerts.exposure?.deadlineAmount)} />
              </Col>
              <Col xs={24} md={6}>
                <Statistic title="Presentation exposure" value={formatMoney(alerts.exposure?.presentationAmount)} />
              </Col>
              <Col xs={24} md={6}>
                <Statistic title="Discrepancy exposure" value={formatMoney(alerts.exposure?.discrepancyAmount)} />
              </Col>
              <Col xs={24} md={6}>
                <Statistic title="Invoice open" value={formatMoney(alerts.exposure?.invoiceOpenAmount)} />
              </Col>
            </Row>
            {(alerts.notificationChannels || []).length > 0 && (
              <Space wrap style={{ marginTop: 12 }}>
                {(alerts.notificationChannels || []).map((channel: any) => (
                  <Tag key={channel.channel} color={channel.enabled ? 'processing' : 'default'}>
                    {channel.channel}: {channel.enabled ? 'on' : 'prepared'}
                  </Tag>
                ))}
              </Space>
            )}
            {(alerts.nextActions || []).length === 0 && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 12 }}
                title={`Không có deadline rủi ro trong ${deadlineWindow} ngày tới`}
              />
            )}
            {(alerts.nextActions || []).length > 0 && (
              <Table
                rowKey="_id"
                size="small"
                columns={deadlineColumns}
                dataSource={alerts.nextActions || []}
                pagination={false}
                style={{ marginTop: 12 }}
              />
            )}
            {(alerts.byContract || []).length > 0 && (
              <Table
                rowKey="key"
                size="small"
                columns={contractDeadlineColumns}
                dataSource={alerts.byContract || []}
                pagination={{ pageSize: 5 }}
                style={{ marginTop: 12 }}
                expandable={{
                  expandedRowRender: (record: any) => (
                    <Table
                      rowKey="_id"
                      size="small"
                      columns={deadlineColumns}
                      dataSource={record.deadlineItems || []}
                      pagination={false}
                    />
                  ),
                }}
              />
            )}
          </div>
        )}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
        }}>
          <Space>
            <Input
              placeholder={t('filters.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              size="large"
              style={{ width: 300 }}
              onPressEnter={(event: any) => fetchData(1, pageSize, event.target.value)}
            />
            <Button icon={<FilterOutlined />} size="large">
              {t('actions.filter')}
            </Button>
          </Space>
        </div>

        <div className="premium-table">
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="_id"
            bordered={false}
            expandable={{
              onExpand: (expanded, record: any) => {
                if (expanded && record?._id) fetchDiscrepancies(record._id);
              },
              expandedRowRender: (record: any) => (
                <Table
                  rowKey="_id"
                  size="small"
                  columns={discrepancyColumns}
                  dataSource={discrepanciesByLc[record._id] || []}
                  pagination={false}
                />
              ),
            }}
            pagination={{
              ...meta,
              onChange: (page, size) => fetchData(page, size),
              showSizeChanger: true,
            }}
            scroll={{ x: 1000 }}
          />
        </div>
      </Card>

      <LCModal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialValues={selectedLC}
      />

      <Modal
        title={`Ghi nhận discrepancy - ${selectedLC?.lcNumber || ''}`}
        open={isDiscrepancyOpen}
        onCancel={() => setIsDiscrepancyOpen(false)}
        onOk={() => discrepancyForm.submit()}
        destroyOnHidden
      >
        <Form form={discrepancyForm} layout="vertical" onFinish={submitDiscrepancy}>
          <Form.Item label="Loại chứng từ" name="documentType">
            <Input placeholder="VD: Commercial Invoice, B/L, C/O" />
          </Form.Item>
          <Form.Item label="Mức độ" name="severity" initialValue="MEDIUM" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Deadline xử lý" name="dueDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Mô tả sai biệt" name="description" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="VD: Invoice amount không khớp L/C, thiếu ký hậu B/L..." />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-container,
        .premium-table .ant-table-content {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#8c8c8c' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
      `}</style>
    </>
  );
};

export default LCTable;
