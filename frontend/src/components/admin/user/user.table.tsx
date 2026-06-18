'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, TeamOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { notification } from '@/providers/antd-static';
import { useTheme } from '@/context/theme.context';
import { sendRequest } from '@/lib/api-client';
import { Avatar, Badge, Button, Card, Col, Input, Modal, Row, Select, Space, Statistic, Table, Tag, theme, Tooltip, Typography } from 'antd';
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

interface RoleOption {
  _id?: string;
  name: string;
  description?: string | null;
}

interface UserRow {
  _id: string;
  username: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  image?: string | null;
  roleName?: string | null;
  role?: RoleOption | string | null;
  isActive: boolean;
}

interface UserSummary {
  total: number;
  active: number;
  admin: number;
}

interface UserListResponse {
  results: UserRow[];
  totalPages: number;
  totalItems: number;
  summary?: UserSummary;
}

const UserTable = () => {
  const t = useTranslations('UserManagement');
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [summary, setSummary] = useState<UserSummary>({ total: 0, active: 0, admin: 0 });
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0,
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<UserRow | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const { current, pageSize } = meta;

  const fetchRoles = useCallback(async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<RoleOption[]>>({
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

    const res = await sendRequest<IBackendRes<UserListResponse>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
      method: 'GET',
      queryParams: {
        current,
        pageSize,
        ...(searchText ? { search: searchText } : {}),
        ...(filterRole ? { roleName: filterRole } : {}),
        ...(filterStatus !== null ? { isActive: filterStatus === 'true' } : {}),
      },
      headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` },
    });

    setLoading(false);
    if (res?.data) {
      const data = res.data;
      setUsers(data.results);
      setMeta((prev) => ({
        ...prev,
        pages: data.totalPages,
        total: data.totalItems || data.totalPages * pageSize,
      }));
      setSummary(data.summary ?? {
        total: data.totalItems || 0,
        active: data.results.filter((user) => user.isActive).length,
        admin: data.results.filter((user) => {
          const roleName = typeof user.role === 'string' ? user.role : user.role?.name || user.roleName;
          return roleName === 'ADMIN' || roleName === 'SUPER_ADMIN';
        }).length,
      });
    }
  }, [current, filterRole, filterStatus, pageSize, searchText]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const stats = useMemo(() => summary, [summary]);

  const confirmDeactivate = async (userRef: string, reason: string) => {
    const currentSession = await getSession();
    const accessToken = getAccessToken(currentSession);
    if (!accessToken) {
      notification.error({
        title: t('messages.missingTokenTitle'),
        description: t('messages.missingTokenDescription'),
      });
      return;
    }

    const res = await sendRequest<IBackendRes<{ message?: string }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${userRef}`,
      method: 'DELETE',
      body: { reason },
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

  const openDeactivateConfirm = (record: UserRow) => {
    let reason = '';

    Modal.confirm({
      title: t('confirm.deleteTitle'),
      content: (
        <Input.TextArea
          autoFocus
          rows={3}
          placeholder="Nhập lý do tạm khóa tài khoản"
          onChange={(event) => {
            reason = event.target.value;
          }}
        />
      ),
      okText: t('actions.delete'),
      cancelText: t('confirm.cancel'),
      okButtonProps: { danger: true, disabled: !record.isActive },
      onOk: async () => {
        const trimmedReason = reason.trim();
        if (trimmedReason.length < 3) {
          notification.error({
            title: t('messages.error'),
            description: 'Vui lòng nhập lý do tối thiểu 3 ký tự.',
          });
          throw new Error('Deactivation reason is required');
        }

        await confirmDeactivate(record._id || record.username, trimmedReason);
      },
    });
  };

  const confirmBulkDeactivate = async (reason: string) => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<{ deactivatedCount: number }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/bulk-deactivate`,
      method: 'POST',
      body: { userRefs: selectedRowKeys.map(String), reason },
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

  const openBulkDeactivateConfirm = () => {
    let reason = '';

    Modal.confirm({
      title: t('confirm.bulkDeleteTitle', { count: selectedRowKeys.length }),
      content: (
        <Input.TextArea
          autoFocus
          rows={3}
          placeholder="Nhập lý do tạm khóa các tài khoản đã chọn"
          onChange={(event) => {
            reason = event.target.value;
          }}
        />
      ),
      okText: t('actions.deleteAll'),
      cancelText: t('confirm.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const trimmedReason = reason.trim();
        if (trimmedReason.length < 3) {
          notification.error({
            title: t('messages.error'),
            description: 'Vui lòng nhập lý do tối thiểu 3 ký tự.',
          });
          throw new Error('Bulk deactivation reason is required');
        }

        await confirmBulkDeactivate(trimmedReason);
      },
    });
  };

  const columns = [
    {
      title: t('table.member'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: UserRow) => (
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
      render: (role: UserRow['role'], record: UserRow) => {
        const name = typeof role === 'string' ? role : role?.name || record.roleName || 'N/A';
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
      render: (_: unknown, record: UserRow) => (
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
          <Tooltip title={record.isActive ? t('actions.delete') : t('status.inactive')}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!record.isActive}
              onClick={() => openDeactivateConfirm(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleOnChange = (pagination: { current?: number; pageSize?: number }) => {
    setMeta((prev) => ({
      ...prev,
      current: pagination.current || 1,
      pageSize: pagination.pageSize || prev.pageSize,
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
              onChange={(event) => {
                setMeta((prev) => ({ ...prev, current: 1 }));
                setSearchText(event.target.value);
              }}
              style={{ width: 300 }}
              size="large"
            />
            <Select
              placeholder={t('filters.rolePlaceholder')}
              style={{ width: 150 }}
              allowClear
              size="large"
              onChange={(value) => {
                setMeta((prev) => ({ ...prev, current: 1 }));
                setFilterRole(value ?? null);
              }}
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
              onChange={(value) => {
                setMeta((prev) => ({ ...prev, current: 1 }));
                setFilterStatus(value ?? null);
              }}
            >
              <Option value="true">{t('status.active')}</Option>
              <Option value="false">{t('status.inactive')}</Option>
            </Select>
          </Space>

          {selectedRowKeys.length > 0 && (
            <Space>
              <Text type="secondary">{t('selection', { count: selectedRowKeys.length })}</Text>
              <Button
                danger
                type="primary"
                icon={<DeleteOutlined />}
                style={{ borderRadius: 8 }}
                onClick={openBulkDeactivateConfirm}
              >
                {t('actions.bulkDelete')}
              </Button>
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
              getCheckboxProps: (record) => ({
                disabled: !record.isActive,
              }),
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
