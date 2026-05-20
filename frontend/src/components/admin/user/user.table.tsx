'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, TeamOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { notification } from '@/providers/antd-static';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { Avatar, Badge, Button, Card, Col, Input, Popconfirm, Row, Select, Space, Statistic, Table, Tag, theme, Tooltip, Typography } from 'antd';
import { getSession, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, type Key } from 'react';
import UserCreateModal from './user.create';
import UserUpdateModal from './user.update';
import { getAccessToken } from '@/lib/auth-token';

const { Option } = Select;
const { Text } = Typography;

const roleColorMap: Record<string, string> = {
  ADMIN: 'magenta',
  SUPER_ADMIN: 'magenta',
  'SUPER ADMIN': 'magenta',
  DIRECTOR: 'red',
  MANAGER: 'gold',
  SALES_MANAGER: 'gold',
  SALES: 'blue',
  SALES_EXPORT: 'blue',
  SALES_STAFF: 'blue',
  PURCHASING: 'cyan',
  PURCHASE_OFFICER: 'cyan',
  LOGISTICS: 'purple',
  LOGISTICS_SPECIALIST: 'purple',
  ACCOUNTING: 'orange',
  ACCOUNTANT: 'orange',
  FINANCE_ACCOUNTANT: 'orange',
  CHIEF_ACCOUNTANT: 'volcano',
  WAREHOUSE: 'green',
  WAREHOUSE_KEEPER: 'green',
  KHO: 'green',
};

const UserTable = () => {
  const t = useTranslations('UserManagement');
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0,
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const { current, pageSize } = meta;

  const fetchRoles = useCallback(async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any[]>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles`,
      method: 'GET',
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });

    if (res?.data) {
      setRoles(res.data);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const currentSession = await getSession();

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
      method: 'GET',
      queryParams: {
        current,
        pageSize,
        ...(searchText ? { name: `/${searchText}/i` } : {}),
        ...(filterRole ? { 'role.name': filterRole } : {}),
        ...(filterStatus !== null ? { isActive: filterStatus === 'true' } : {}),
      },
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });

    setLoading(false);
    if (res?.data) {
      setUsers(res.data.results);
      setMeta((prev) => ({
        ...prev,
        pages: res.data.totalPages,
        total: res.data.totalItems || res.data.totalPages * pageSize,
      }));
    }
  }, [current, filterRole, filterStatus, pageSize, searchText]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const stats = useMemo(() => ({
    total: meta.total,
    active: users.filter((user) => user.isActive).length,
    admin: users.filter((user) => user.role?.name === 'ADMIN').length,
  }), [meta.total, users]);

  const confirmDelete = async (userRef: string) => {
    const currentSession = await getSession();
    const accessToken = getAccessToken(currentSession);
    if (!accessToken) {
      notification.error({
        title: t('messages.missingTokenTitle'),
        description: t('messages.missingTokenDescription'),
      });
      return;
    }

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${userRef}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res?.data) {
      notification.success({ title: t('messages.deleteSuccess') });
      fetchUsers();
    } else {
      notification.error({
        title: t('messages.error'),
        description: res.message,
      });
    }
  };

  const confirmBulkDelete = async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/bulk-delete`,
      method: 'POST',
      body: { ids: selectedRowKeys },
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });

    if (res?.data) {
      notification.success({ title: t('messages.bulkSuccess'), description: res.message });
      setSelectedRowKeys([]);
      fetchUsers();
    } else {
      notification.error({ title: t('messages.error'), description: res.message });
    }
  };

  const columns = [
    {
      title: t('table.member'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <Avatar
            src={record.image}
            style={{ backgroundColor: token.colorPrimary }}
            icon={<UserOutlined />}
          >
            {text?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>{text}</span>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.email}</span>
          </div>
        </Space>
      ),
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || <span style={{ color: token.colorTextPlaceholder }}>--</span>,
    },
    {
      title: t('table.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role: any) => {
        const name = typeof role === 'string' ? role : role?.name || 'N/A';
        return (
          <Tag color={roleColorMap[name] || 'default'} style={{ borderRadius: 12, padding: '0 10px' }}>
            {name}
          </Tag>
        );
      },
    },
    {
      title: t('table.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      title: t('table.actions'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Tooltip title={t('actions.edit')}>
            <Button
              type="text"
              icon={<EditOutlined style={{ color: token.colorPrimary }} />}
              onClick={() => {
                setDataUpdate(record);
                setIsUpdateModalOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title={t('confirm.deleteTitle')}
            onConfirm={() => confirmDelete(record._id || record.username)}
            okText={t('actions.delete')}
            cancelText={t('confirm.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t('actions.delete')}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleOnChange = (pagination: any) => {
    setMeta((prev) => ({
      ...prev,
      current: pagination.current,
      pageSize: pagination.pageSize,
    }));
  };

  return (
    <div style={{
      backgroundColor: 'transparent',
      transition: 'all 0.3s ease',
    }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: 12, background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.total')}</Text>}
              value={stats.total}
              prefix={<TeamOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
              styles={{ content: { color: isDark ? '#f8fafc' : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: 12, background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.active')}</Text>}
              value={stats.active}
              styles={{ content: { color: '#52c41a' } }}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: 12, background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.admin')}</Text>}
              value={stats.admin}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<UserOutlined style={{ color: '#cf1322' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        style={{
          borderRadius: 12,
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
        }}>
          <PageHeader
            title={t('title')}
            icon={<UserOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
            description={t('description')}
          />
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
            style={{ borderRadius: 8 }}
          >
            {t('actions.create')}
          </Button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space size="middle">
            <Input
              placeholder={t('filters.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              allowClear
              onChange={(event) => setSearchText(event.target.value)}
              style={{ width: 300 }}
              size="large"
            />
            <Select
              placeholder={t('filters.rolePlaceholder')}
              style={{ width: 150 }}
              allowClear
              size="large"
              onChange={setFilterRole}
            >
              {roles.map((role) => (
                <Option key={role._id || role.name} value={role.name}>{role.name}</Option>
              ))}
            </Select>
            <Select
              placeholder={t('filters.statusPlaceholder')}
              style={{ width: 150 }}
              allowClear
              size="large"
              onChange={setFilterStatus}
            >
              <Option value="true">{t('status.active')}</Option>
              <Option value="false">{t('status.inactive')}</Option>
            </Select>
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <Text type="secondary">{t('selection', { count: selectedRowKeys.length })}</Text>
              <Popconfirm
                title={t('confirm.bulkDeleteTitle', { count: selectedRowKeys.length })}
                onConfirm={confirmBulkDelete}
                okText={t('actions.deleteAll')}
                cancelText={t('confirm.cancel')}
                okButtonProps={{ danger: true }}
              >
                <Button danger type="primary" icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>
                  {t('actions.bulkDelete')}
                </Button>
              </Popconfirm>
            </Space>
          )}
        </div>

        <div className="premium-table">
          <Table
            rowKey={(record) => record._id || record.username}
            loading={loading}
            dataSource={users}
            columns={columns}
            bordered={false}
            onChange={handleOnChange}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              current: meta.current,
              pageSize: meta.pageSize,
              showSizeChanger: true,
              total: meta.total,
              showTotal: (total, range) => t('pagination', { start: range[0], end: range[1], total }),
            }}
          />
        </div>
      </Card>

      <UserCreateModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        fetchUsers={fetchUsers}
        session={session}
      />

      <UserUpdateModal
        isUpdateModalOpen={isUpdateModalOpen}
        setIsUpdateModalOpen={setIsUpdateModalOpen}
        fetchUsers={fetchUsers}
        dataUpdate={dataUpdate}
        setDataUpdate={setDataUpdate}
        session={session}
      />

      <style jsx global>{`
        .premium-table .ant-table {
          background: transparent !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: ${isDark ? 'rgba(30, 41, 59, 0.5)' : '#fafafa'} !important;
          color: ${isDark ? '#94a3b8' : '#595959'} !important;
          font-weight: 600 !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr > td {
          background: transparent !important;
          color: ${isDark ? '#e2e8f0' : token.colorText} !important;
          border-bottom: 1px solid ${isDark ? '#334155' : '#f0f0f0'} !important;
        }
        .premium-table .ant-table-tbody > tr:hover > td {
          background: ${isDark ? 'rgba(51, 65, 85, 0.45)' : '#f8fafc'} !important;
        }
        .premium-table .ant-table-placeholder {
          background: transparent !important;
        }
        .premium-table .ant-empty-description {
          color: ${isDark ? '#94a3b8' : '#595959'} !important;
        }
      `}</style>
    </div>
  );
};

export default UserTable;
