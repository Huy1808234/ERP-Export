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
import { getAccessToken } from '@/lib/auth-token';
import { countryService, ICountry, CountryPayload } from '@/services/country.service';
import { useDebounce } from '@/hooks/useDebounce';
import { BUYER_REGION_KEYS, loadCountries } from '@/constants/geo';

const { Text } = Typography;

type CountryFormValues = {
  code: string;
  name: string;
  nameVi: string;
  region: string;
  aliasesText?: string;
  isActive?: boolean;
};

const toPayload = (values: CountryFormValues): CountryPayload => ({
  code: values.code.trim().toUpperCase(),
  name: values.name.trim(),
  nameVi: values.nameVi.trim(),
  region: values.region,
  aliases: values.aliasesText
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) || [],
  isActive: values.isActive ?? true,
});

const toFormValues = (country: ICountry): CountryFormValues => ({
  code: country.code,
  name: country.name,
  nameVi: country.nameVi,
  region: country.region,
  aliasesText: country.aliases?.join(', '),
  isActive: country.isActive,
});

export default function CountriesPage() {
  const t = useTranslations('Countries');
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const { notification, modal } = App.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm<CountryFormValues>();
  const [countriesList, setCountriesList] = useState<ICountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<ICountry | null>(null);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const debouncedSearch = useDebounce(search, 350);

  const accessToken = getAccessToken(session);
  const authReady = sessionStatus === 'authenticated' && Boolean(accessToken);
  const hasFilters = Boolean(debouncedSearch || regionFilter || statusFilter !== undefined);

  const regionOptions = useMemo(() => {
    return BUYER_REGION_KEYS.map((region) => ({
      value: region,
      label: t(`regions.${region}`),
    }));
  }, [t]);

  const fetchCountries = useCallback(async (current = 1, pageSize = pagination.pageSize) => {
    if (sessionStatus === 'loading') return;

    if (!authReady || !accessToken) {
      setCountriesList([]);
      setApiError(t('messages.sessionNotReadyDescription'));
      return;
    }

    setLoading(true);
    try {
      const res = await countryService.findAll({
        search: debouncedSearch || undefined,
        region: regionFilter,
        isActive: statusFilter,
        current,
        pageSize,
      }, accessToken);

      if (res.data) {
        setCountriesList(res.data.results || []);
        setPagination({
          current: res.data.meta?.current || current,
          pageSize: res.data.meta?.pageSize || pageSize,
          total: res.data.meta?.total || 0,
        });
        setApiError(null);
        setLastLoadedAt(new Date().toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US'));
      } else {
        const message = res.message || t('messages.loadError');
        setCountriesList([]);
        setApiError(message);
        notification.error({ title: t('messages.loadError'), description: message });
      }
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    authReady,
    regionFilter,
    debouncedSearch,
    locale,
    notification,
    pagination.pageSize,
    sessionStatus,
    statusFilter,
    t,
  ]);

  useEffect(() => {
    fetchCountries(1, pagination.pageSize);
  }, [regionFilter, debouncedSearch, fetchCountries, pagination.pageSize, statusFilter]);

  const openCreate = useCallback(() => {
    setEditingCountry(null);
    form.resetFields();
    form.setFieldsValue({
      region: 'OTHER',
      isActive: true,
    });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback((country: ICountry) => {
    setEditingCountry(country);
    form.setFieldsValue(toFormValues(country));
    setModalOpen(true);
  }, [form]);

  const saveCountry = useCallback(async () => {
    if (!authReady || !accessToken) {
      notification.error({ title: t('messages.sessionNotReady') });
      return;
    }

    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = toPayload(values);
      const res = editingCountry
        ? await countryService.update(editingCountry._id, payload, accessToken)
        : await countryService.create(payload, accessToken);

      if (res.data) {
        notification.success({ title: editingCountry ? t('messages.updateSuccess') : t('messages.createSuccess') });
        setModalOpen(false);
        // Refresh local UI list
        await fetchCountries(pagination.current, pagination.pageSize);
        // Sync dynamic frontend geo cache
        await loadCountries(accessToken, true);
      } else {
        notification.error({ title: t('messages.saveError'), description: res.message });
      }
    } finally {
      setSaving(false);
    }
  }, [accessToken, authReady, editingCountry, fetchCountries, form, notification, pagination.current, pagination.pageSize, t]);

  const activateCountry = useCallback(async (country: ICountry) => {
    if (!authReady || !accessToken) {
      notification.error({ title: t('messages.sessionNotReady') });
      return;
    }

    const res = await countryService.update(country._id, { isActive: true }, accessToken);
    if (res.data) {
      notification.success({ title: t('messages.activateSuccess') });
      await fetchCountries(pagination.current, pagination.pageSize);
      await loadCountries(accessToken, true);
      return;
    }

    notification.error({ title: t('messages.activateError'), description: res.message });
  }, [accessToken, authReady, fetchCountries, notification, pagination.current, pagination.pageSize, t]);

  const deactivateCountry = useCallback((country: ICountry) => {
    if (!authReady || !accessToken) {
      notification.error({ title: t('messages.sessionNotReady') });
      return;
    }

    modal.confirm({
      title: t('confirm.deactivateTitle'),
      content: t('confirm.deactivateContent', { country: `${locale === 'vi' ? country.nameVi : country.name} (${country.code})` }),
      okText: t('actions.deactivate'),
      okButtonProps: { danger: true },
      cancelText: t('actions.cancel'),
      onOk: async () => {
        const res = await countryService.remove(country._id, accessToken);
        if (res.error) {
          notification.error({ title: t('messages.deactivateError'), description: res.message });
          return;
        }
        notification.success({ title: t('messages.deactivateSuccess') });
        await fetchCountries(pagination.current, pagination.pageSize);
        await loadCountries(accessToken, true);
      },
    });
  }, [accessToken, authReady, fetchCountries, locale, modal, notification, pagination.current, pagination.pageSize, t]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setRegionFilter(undefined);
    setStatusFilter(true);
  }, []);

  const pageActiveCount = useMemo(() => countriesList.filter((c) => c.isActive).length, [countriesList]);
  const pageInactiveCount = countriesList.length - pageActiveCount;

  const columns = useMemo<ColumnsType<ICountry>>(() => [
    {
      title: t('table.code'),
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    {
      title: t('table.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: t('table.nameVi'),
      dataIndex: 'nameVi',
      key: 'nameVi',
      width: 200,
      render: (nameVi: string) => <Text>{nameVi}</Text>,
    },
    {
      title: t('table.region'),
      dataIndex: 'region',
      key: 'region',
      width: 180,
      render: (region: string) => {
        const label = regionOptions.find((r) => r.value === region)?.label || region;
        return <Tag color="blue">{label}</Tag>;
      },
    },
    {
      title: t('table.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 150,
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
              <Button danger icon={<StopOutlined />} onClick={() => deactivateCountry(record)} />
            </Tooltip>
          ) : (
            <Tooltip title={t('actions.activate')}>
              <Button icon={<CheckCircleOutlined />} onClick={() => activateCountry(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [activateCountry, deactivateCountry, openEdit, regionOptions, t]);

  return (
    <AdminPageScroll>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={<GlobalOutlined />}
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => fetchCountries(pagination.current, pagination.pageSize)} loading={loading}>
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
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={t('stats.filteredTotal')} value={pagination.total} suffix={t('units.countries')} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={t('stats.activeOnPage')} value={pageActiveCount} suffix={t('units.countries')} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={t('stats.inactiveOnPage')} value={pageInactiveCount} suffix={t('units.countries')} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 20 } }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={10}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('filters.searchPlaceholder')}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Select
              allowClear
              value={regionFilter}
              onChange={setRegionFilter}
              options={regionOptions}
              placeholder={t('filters.region')}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} lg={5}>
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

        <Table<ICountry>
          rowKey="_id"
          columns={columns}
          dataSource={countriesList}
          loading={loading || sessionStatus === 'loading'}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (current, pageSize) => fetchCountries(current, pageSize),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasFilters ? t('empty.noMatch') : t('empty.noCountries')}
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
          scroll={{ x: 800 }}
        />

        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          {lastLoadedAt ? t('labels.lastLoadedAt', { time: lastLoadedAt }) : t('labels.masterDataHint')}
        </Text>
      </Card>

      <Modal
        title={editingCountry ? t('modal.editTitle') : t('modal.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={saveCountry}
        okText={t('actions.save')}
        cancelText={t('actions.cancel')}
        confirmLoading={saving}
        width={650}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="code"
                label={t('form.code')}
                rules={[
                  { required: true, message: t('validation.codeRequired') },
                  { len: 2, message: t('validation.codeLength') },
                ]}
              >
                <Input disabled={Boolean(editingCountry)} placeholder={t('placeholders.code')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="region"
                label={t('form.region')}
                rules={[{ required: true, message: t('validation.regionRequired') }]}
              >
                <Select options={regionOptions} placeholder={t('placeholders.region')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label={t('form.name')}
                rules={[{ required: true, message: t('validation.nameRequired') }]}
              >
                <Input placeholder={t('placeholders.name')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="nameVi"
                label={t('form.nameVi')}
                rules={[{ required: true, message: t('validation.nameViRequired') }]}
              >
                <Input placeholder={t('placeholders.nameVi')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="aliasesText" label={t('form.aliases')}>
            <Input placeholder={t('placeholders.aliases')} />
          </Form.Item>

          <Form.Item name="isActive" label={t('form.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageScroll>
  );
}
