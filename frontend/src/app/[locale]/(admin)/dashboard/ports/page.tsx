'use client';

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import AdminPageScroll from '@/components/layout/admin.page-scroll';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCountries,
  getCountryDisplayName as getCatalogCountryDisplayName,
  normalizeCountryCode,
  loadCountries,
} from '@/constants/geo';
import { getAccessToken } from '@/lib/auth-token';
import { formatPortLabel, IPort, portService, PortPayload, PortType } from '@/services/port.service';
import { countryService } from '@/services/country.service';
import { useDebounce } from '@/hooks/useDebounce';
import { QuickAddCountryModal } from '@/components/admin/country/country.quick-add';

const { Text } = Typography;

type PortFormValues = {
  code: string;
  name: string;
  localName?: string;
  city?: string;
  country: string;
  countryCode: string;
  type?: PortType;
  timezone?: string;
  aliasesText?: string;
  notes?: string;
  isActive?: boolean;
};

const getCountryNameForStorage = (countryCode?: string | null, fallback?: string): string =>
  getCatalogCountryDisplayName(countryCode, 'en') || fallback?.trim() || '';

const toPayload = (values: PortFormValues): PortPayload => {
  const countryCode = normalizeCountryCode(values.countryCode) || values.countryCode.trim().toUpperCase();

  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    localName: values.localName?.trim() || undefined,
    city: values.city?.trim() || undefined,
    country: getCountryNameForStorage(countryCode, values.country),
    countryCode,
    type: values.type || 'SEA',
    timezone: values.timezone?.trim() || undefined,
    aliases: values.aliasesText
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    notes: values.notes?.trim() || undefined,
    isActive: values.isActive ?? true,
  };
};

const toFormValues = (port: IPort): PortFormValues => ({
  code: port.code,
  name: port.name,
  localName: port.localName || undefined,
  city: port.city || undefined,
  country: port.country,
  countryCode: normalizeCountryCode(port.countryCode) || port.countryCode,
  type: port.type,
  timezone: port.timezone || undefined,
  aliasesText: port.aliases?.join(', '),
  notes: port.notes || undefined,
  isActive: port.isActive,
});

export default function PortsPage() {
  const t = useTranslations('Ports');
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const { notification, modal } = App.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm<PortFormValues>();
  const [ports, setPorts] = useState<IPort[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPort, setEditingPort] = useState<IPort | null>(null);
  const [search, setSearch] = useState('');
  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<PortType | undefined>();
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const debouncedSearch = useDebounce(search, 350);

  const accessToken = getAccessToken(session);
  const authReady = sessionStatus === 'authenticated' && Boolean(accessToken);
  const hasFilters = Boolean(debouncedSearch || countryCode || typeFilter || statusFilter !== undefined);
  const portTypeOptions = useMemo<Array<{ value: PortType; label: string }>>(() => [
    { value: 'SEA', label: t('types.SEA') },
    { value: 'INLAND', label: t('types.INLAND') },
    { value: 'AIR', label: t('types.AIR') },
  ], [t]);
  const { options: countryOptions } = useCountries(locale);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const getCountryDisplayName = useCallback((record: Pick<IPort, 'country' | 'countryCode'>) => (
    getCatalogCountryDisplayName(record.countryCode, locale) || record.country || record.countryCode || '-'
  ), [locale]);

  const fetchPorts = useCallback(async (current = 1, pageSize = pagination.pageSize) => {
    if (sessionStatus === 'loading') return;

    if (!authReady || !accessToken) {
      setPorts([]);
      setApiError(t('messages.sessionNotReadyDescription'));
      return;
    }

    setLoading(true);
    try {
      const res = await portService.findAll({
        search: debouncedSearch || undefined,
        countryCode,
        type: typeFilter,
        isActive: statusFilter,
        current,
        pageSize,
      }, accessToken);

      if (res.data) {
        setPorts(res.data.results || []);
        setPagination({
          current: res.data.meta?.current || current,
          pageSize: res.data.meta?.pageSize || pageSize,
          total: res.data.meta?.total || 0,
        });
        setApiError(null);
        setLastLoadedAt(new Date().toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US'));
      } else {
        const message = res.message || t('messages.loadError');
        setPorts([]);
        setApiError(message);
        notification.error({ title: t('messages.loadError'), description: message });
      }
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    authReady,
    countryCode,
    debouncedSearch,
    locale,
    notification,
    pagination.pageSize,
    sessionStatus,
    statusFilter,
    t,
    typeFilter,
  ]);

  useEffect(() => {
    fetchPorts(1, pagination.pageSize);
  }, [countryCode, debouncedSearch, fetchPorts, pagination.pageSize, statusFilter, typeFilter]);

  const openCreate = useCallback(() => {
    setEditingPort(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'SEA',
      countryCode: 'VN',
      country: getCatalogCountryDisplayName('VN', locale),
      isActive: true,
    });
    setModalOpen(true);
  }, [form, locale]);

  const openEdit = useCallback((port: IPort) => {
    setEditingPort(port);
    form.setFieldsValue(toFormValues(port));
    setModalOpen(true);
  }, [form]);

  const savePort = useCallback(async () => {
    if (!authReady || !accessToken) {
      notification.error({ title: t('messages.sessionNotReady') });
      return;
    }

    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = toPayload(values);
      const res = editingPort
        ? await portService.update(editingPort._id, payload, accessToken)
        : await portService.create(payload, accessToken);

      if (res.data) {
        notification.success({ title: editingPort ? t('messages.updateSuccess') : t('messages.createSuccess') });
        setModalOpen(false);
        await fetchPorts(pagination.current, pagination.pageSize);
      } else {
        notification.error({ title: t('messages.saveError'), description: res.message });
      }
    } finally {
      setSaving(false);
    }
  }, [accessToken, authReady, editingPort, fetchPorts, form, notification, pagination.current, pagination.pageSize, t]);

  const activatePort = useCallback(async (port: IPort) => {
    if (!authReady || !accessToken) {
      notification.error({ title: t('messages.sessionNotReady') });
      return;
    }

    const res = await portService.update(port._id, { isActive: true }, accessToken);
    if (res.data) {
      notification.success({ title: t('messages.activateSuccess') });
      await fetchPorts(pagination.current, pagination.pageSize);
      return;
    }

    notification.error({ title: t('messages.activateError'), description: res.message });
  }, [accessToken, authReady, fetchPorts, notification, pagination.current, pagination.pageSize, t]);

  const deactivatePort = useCallback((port: IPort) => {
    if (!authReady || !accessToken) {
      notification.error({ title: t('messages.sessionNotReady') });
      return;
    }

    modal.confirm({
      title: t('confirm.deactivateTitle'),
      content: t('confirm.deactivateContent', { port: formatPortLabel(port) }),
      okText: t('actions.deactivate'),
      okButtonProps: { danger: true },
      cancelText: t('actions.cancel'),
      onOk: async () => {
        const res = await portService.remove(port._id, accessToken);
        if (res.error) {
          notification.error({ title: t('messages.deactivateError'), description: res.message });
          return;
        }
        notification.success({ title: t('messages.deactivateSuccess') });
        await fetchPorts(pagination.current, pagination.pageSize);
      },
    });
  }, [accessToken, authReady, fetchPorts, modal, notification, pagination.current, pagination.pageSize, t]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setCountryCode(undefined);
    setTypeFilter(undefined);
    setStatusFilter(true);
  }, []);

  const pageActiveCount = useMemo(() => ports.filter((port) => port.isActive).length, [ports]);
  const pageInactiveCount = ports.length - pageActiveCount;
  const pageCountryCount = useMemo(() => new Set(ports.map((port) => port.countryCode)).size, [ports]);

  const columns = useMemo<ColumnsType<IPort>>(() => [
    {
      title: t('table.code'),
      dataIndex: 'code',
      key: 'code',
      width: 190,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    {
      title: t('table.name'),
      key: 'name',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.localName || record.name}</Text>
          <Text type="secondary">{record.localName ? record.name : record.city || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('table.country'),
      key: 'country',
      width: 220,
      render: (_, record) => (
        <Space>
          <GlobalOutlined />
          <Text>{getCountryDisplayName(record)}</Text>
          <Tag>{record.countryCode}</Tag>
        </Space>
      ),
    },
    {
      title: t('table.type'),
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (value: PortType) => {
        const label = portTypeOptions.find((item) => item.value === value)?.label || value;
        return <Tag color={value === 'SEA' ? 'blue' : value === 'INLAND' ? 'cyan' : 'purple'}>{label}</Tag>;
      },
    },
    {
      title: t('table.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 160,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? t('status.active') : t('status.inactive')}</Tag>
      ),
    },
    {
      title: t('table.actions'),
      key: 'actions',
      width: 150,
      align: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('actions.edit')}>
            <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          {record.isActive ? (
            <Tooltip title={t('actions.deactivate')}>
              <Button danger icon={<StopOutlined />} onClick={() => deactivatePort(record)} />
            </Tooltip>
          ) : (
            <Tooltip title={t('actions.activate')}>
              <Button icon={<CheckCircleOutlined />} onClick={() => activatePort(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [activatePort, deactivatePort, getCountryDisplayName, openEdit, portTypeOptions, t]);

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={<EnvironmentOutlined />}
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => fetchPorts(pagination.current, pagination.pageSize)} loading={loading}>
              {t('actions.reload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('actions.create')}
            </Button>
          </Space>
        )}
      />

      {apiError && (
        <Alert
          type="error"
          showIcon
          title={t('messages.loadError')}
          description={apiError}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('stats.filteredTotal')} value={pagination.total} suffix={t('units.ports')} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('stats.activeOnPage')} value={pageActiveCount} suffix={t('units.ports')} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('stats.inactiveOnPage')} value={pageInactiveCount} suffix={t('units.ports')} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('stats.countriesOnPage')} value={pageCountryCount} suffix={t('units.countries')} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 20 } }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={9}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('filters.searchPlaceholder')}
            />
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Select
              allowClear
              showSearch
              value={countryCode}
              optionFilterProp="label"
              onChange={setCountryCode}
              options={countryOptions}
              placeholder={t('filters.country')}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Select
              allowClear
              value={typeFilter}
              onChange={setTypeFilter}
              options={portTypeOptions}
              placeholder={t('filters.type')}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: true, label: t('status.active') },
                { value: false, label: t('status.inactive') },
              ]}
              placeholder={t('filters.status')}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} lg={3}>
            <Button block onClick={resetFilters}>
              {t('actions.reset')}
            </Button>
          </Col>
        </Row>

        <Table<IPort>
          rowKey="_id"
          columns={columns}
          dataSource={ports}
          loading={loading || sessionStatus === 'loading'}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (current, pageSize) => fetchPorts(current, pageSize),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasFilters ? t('empty.noMatch') : t('empty.noPorts')}
              >
                {hasFilters ? (
                  <Button onClick={resetFilters}>{t('actions.resetFilters')}</Button>
                ) : (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    {t('actions.createFirst')}
                  </Button>
                )}
              </Empty>
            ),
          }}
          scroll={{ x: 980 }}
        />

        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          {lastLoadedAt ? t('labels.lastLoadedAt', { time: lastLoadedAt }) : t('labels.masterDataHint')}
        </Text>
      </Card>

      <Modal
        title={editingPort ? t('modal.editTitle') : t('modal.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={savePort}
        okText={t('actions.save')}
        cancelText={t('actions.cancel')}
        confirmLoading={saving}
        width={860}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="code"
                label={t('form.code')}
                rules={[
                  { required: true, message: t('validation.codeRequired') },
                  { pattern: /^[A-Za-z]{2}[A-Za-z0-9]{3,10}$/, message: t('validation.codePattern') },
                ]}
              >
                <Input placeholder={t('placeholders.code')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="countryCode"
                label={t('form.countryCode')}
                rules={[
                  { required: true, message: t('validation.countryCodeRequired') },
                  { len: 2, message: t('validation.countryCodeLength') },
                ]}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={countryOptions}
                    onChange={(value?: string) => {
                      const nextCountryCode = normalizeCountryCode(value) || value;
                      form.setFieldsValue({
                        countryCode: nextCountryCode,
                        country: getCatalogCountryDisplayName(nextCountryCode, locale),
                      });
                    }}
                    placeholder={t('placeholders.countryCode')}
                    style={{ width: 'calc(100% - 40px)' }}
                  />
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setIsQuickAddOpen(true)}
                    style={{ width: 40 }}
                  />
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="type" label={t('form.type')} rules={[{ required: true, message: t('validation.typeRequired') }]}>
                <Select options={portTypeOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label={t('form.name')} rules={[{ required: true, message: t('validation.nameRequired') }]}>
                <Input placeholder={t('placeholders.name')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="localName" label={t('form.localName')}>
                <Input placeholder={t('placeholders.localName')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="city" label={t('form.city')}>
                <Input placeholder={t('placeholders.city')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="country" label={t('form.country')} rules={[{ required: true, message: t('validation.countryRequired') }]}>
                <Input disabled placeholder={t('placeholders.country')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="timezone" label={t('form.timezone')}>
                <Input placeholder={t('placeholders.timezone')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="aliasesText" label={t('form.aliases')}>
            <Input placeholder={t('placeholders.aliases')} />
          </Form.Item>

          <Form.Item name="notes" label={t('form.notes')}>
            <Input.TextArea rows={3} placeholder={t('placeholders.notes')} />
          </Form.Item>

          <Form.Item name="isActive" label={t('form.active')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Text type="secondary" style={{ color: token.colorTextSecondary }}>
            {t('labels.formHint')}
          </Text>
        </Form>
        <QuickAddCountryModal
          open={isQuickAddOpen}
          onCancel={() => setIsQuickAddOpen(false)}
          onSuccess={(code) => {
            form.setFieldsValue({
              countryCode: code,
              country: getCatalogCountryDisplayName(code, locale),
            });
          }}
        />
      </Modal>
    </AdminPageScroll>
  );
}
