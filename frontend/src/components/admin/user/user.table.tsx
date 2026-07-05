'use client';

import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTheme } from '@/context/theme.context';
import { useDebounce } from '@/hooks/useDebounce';
import { useUsers } from '@/hooks/useUsers';
import { notification } from '@/providers/antd-static';
import type { CreateUserPayload, UpdateUserPayload, UserRow } from '@/types/user';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, type Key } from 'react';
import UserCreateModal from './user.create';
import UserUpdateModal from './user.update';

const { Text } = Typography;

const roleColorMap: Record<string, string> = {
  ADMIN: 'magenta',
  SUPER_ADMIN: 'magenta',
  'SUPER ADMIN': 'magenta',
  DIRECTOR: 'red',
  MANAGER: 'gold',
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

const getRoleName = (user: UserRow): string => {
  if (typeof user.role === 'string') return user.role;
  return user.role?.name || user.roleName || 'N/A';
};

const UserTable = () => {
  const t = useTranslations('UserManagement');
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { data: session } = useSession();
  const {
    users,
    roles,
    summary,
    meta,
    loading,
    rolesLoading,
    submitting,
    error,
    fetchUsers,
    fetchRoles,
    addUser,
    editUser,
    deactivate,
    bulkDeactivate,
  } = useUsers();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<UserRow | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [paginationState, setPaginationState] = useState({
    current: 1,
    pageSize: 10,
  });

  const debouncedSearchText = useDebounce(searchText.trim(), 350);
  const currentUsername = session?.user?.username;

  const listParams = useMemo(() => ({
    current: paginationState.current,
    pageSize: paginationState.pageSize,
    ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
    ...(filterRole ? { roleName: filterRole } : {}),
    ...(filterStatus !== null ? { isActive: filterStatus === 'true' } : {}),
  }), [debouncedSearchText, filterRole, filterStatus, paginationState.current, paginationState.pageSize]);

  const refreshUsers = useCallback(async () => {
    await fetchUsers(listParams);
  }, [fetchUsers, listParams]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const handleCreateUser = async (payload: CreateUserPayload): Promise<boolean> => {
    const result = await addUser(payload);
    if (!result.success) {
      notification.error({
        title: t('messages.error'),
        description: result.message,
      });
      return false;
    }

    await refreshUsers();
    return true;
  };

  const handleUpdateUser = async (
    userRef: string,
    payload: UpdateUserPayload,
  ): Promise<boolean> => {
    const result = await editUser(userRef, payload);
    if (!result.success) {
      notification.error({
        title: t('messages.error'),
        description: result.message,
      });
      return false;
    }

    await refreshUsers();
    return true;
  };

  const confirmDeactivate = async (userRef: string, reason: string) => {
    const result = await deactivate(userRef, reason);
    if (!result.success) {
      notification.error({
        title: t('messages.error'),
        description: result.message,
      });
      return;
    }

    notification.success({ title: t('messages.deleteSuccess') });
    setSelectedRowKeys((prev) => prev.filter((key) => key !== userRef));
    await refreshUsers();
  };

  const openActivateConfirm = (record: UserRow) => {
    Modal.confirm({
      title: 'Xác nhận kích hoạt tài khoản',
      content: 'Bạn có chắc chắn muốn kích hoạt lại tài khoản này không?',
      okText: 'Kích hoạt',
      cancelText: t('confirm.cancel'),
      onOk: async () => {
        await handleUpdateUser(record._id, { isActive: true });
      },
    });
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

        await confirmDeactivate(record._id, trimmedReason);
      },
    });
  };

  const confirmBulkDeactivate = async (reason: string) => {
    const userRefs = selectedRowKeys.map(String);
    const result = await bulkDeactivate(userRefs, reason);
    if (!result.success) {
      notification.error({
        title: t('messages.error'),
        description: result.message,
      });
      return;
    }

    notification.success({ title: t('messages.bulkSuccess'), description: result.message });
    setSelectedRowKeys([]);
    await refreshUsers();
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

  const columns: ColumnsType<UserRow> = [
    {
      title: t('table.member'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <Avatar
            src={record.image}
            style={{ backgroundColor: token.colorPrimary }}
            icon={<UserOutlined />}
          >
            {name?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>{name || record.username}</span>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.email}</span>
          </div>
        </Space>
      ),
    },
    {
      title: t('table.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (phone?: string | null) => phone || <span style={{ color: token.colorTextPlaceholder }}>--</span>,
    },
    {
      title: t('table.role'),
      key: 'role',
      render: (_, record) => {
        const name = getRoleName(record);
        return (
          <Tag color={roleColorMap[name] || 'default'} style={{ borderRadius: 8, padding: '0 10px' }}>
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
      width: 120,
      render: (_, record) => (
        <Space size="small">
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
          <Tooltip title={record.isActive ? t('actions.delete') : 'Kích hoạt'}>
            <Button
              type="text"
              danger={record.isActive}
              icon={record.isActive ? <DeleteOutlined /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
              disabled={record.username === currentUsername}
              onClick={() => record.isActive ? openDeactivateConfirm(record) : openActivateConfirm(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
    setSelectedRowKeys([]);
    setPaginationState((prev) => ({
      current: pagination.current || 1,
      pageSize: pagination.pageSize || prev.pageSize,
    }));
  };

  const handleFilterChange = (callback: () => void) => {
    setSelectedRowKeys([]);
    setPaginationState((prev) => ({ ...prev, current: 1 }));
    callback();
  };

  const tableEmptyText = error ? (
    <Empty
      description={
        <Space orientation="vertical" size={8}>
          <Text type="danger">{error}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => void refreshUsers()}>
            Tải lại
          </Button>
        </Space>
      }
    />
  ) : (
    <Empty description="Không có người dùng phù hợp" />
  );

  return (
    <div style={{ backgroundColor: 'transparent', transition: 'all 0.3s ease' }}>
      <PageHeader
        title={t('title')}
        icon={<UserOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
        description={t('description')}
        extra={(
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
            style={{ borderRadius: 8 }}
          >
            {t('actions.create')}
          </Button>
        )}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: 8, background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.total')}</Text>}
              value={summary.total}
              prefix={<TeamOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
              styles={{ content: { color: isDark ? '#f8fafc' : undefined } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: 8, background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.active')}</Text>}
              value={summary.active}
              styles={{ content: { color: '#52c41a' } }}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" hoverable style={{ borderRadius: 8, background: isDark ? '#1e293b' : token.colorBgContainer }}>
            <Statistic
              title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>{t('stats.admin')}</Text>}
              value={summary.admin}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<UserOutlined style={{ color: '#cf1322' }} />}
            />
          </Card>
        </Col>
      </Row>

      {error ? (
        <Alert
          showIcon
          type="error"
          title="Không tải được danh sách người dùng"
          description={error}
          action={<Button size="small" onClick={() => void refreshUsers()}>Tải lại</Button>}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Card
        variant="borderless"
        style={{
          borderRadius: 8,
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space size="middle" wrap>
            <Input
              value={searchText}
              placeholder={t('filters.searchPlaceholder')}
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              allowClear
              onChange={(event) => handleFilterChange(() => setSearchText(event.target.value))}
              style={{ width: 300 }}
              size="large"
            />
            <Select
              value={filterRole}
              placeholder={t('filters.rolePlaceholder')}
              style={{ width: 180 }}
              allowClear
              size="large"
              loading={rolesLoading}
              onChange={(value) => handleFilterChange(() => setFilterRole(value ?? null))}
              options={roles.map((role) => ({
                value: role.name,
                label: role.name,
              }))}
            />
            <Select
              value={filterStatus}
              placeholder={t('filters.statusPlaceholder')}
              style={{ width: 160 }}
              allowClear
              size="large"
              onChange={(value) => handleFilterChange(() => setFilterStatus(value ?? null))}
              options={[
                { value: 'true', label: t('status.active') },
                { value: 'false', label: t('status.inactive') },
              ]}
            />
          </Space>

          {selectedRowKeys.length > 0 ? (
            <Space>
              <Text type="secondary">{t('selection', { count: selectedRowKeys.length })}</Text>
              <Button
                danger
                type="primary"
                icon={<DeleteOutlined />}
                loading={submitting}
                style={{ borderRadius: 8 }}
                onClick={openBulkDeactivateConfirm}
              >
                {t('actions.bulkDelete')}
              </Button>
            </Space>
          ) : null}
        </div>

        <div className="premium-table">
          <Table<UserRow>
            rowKey="_id"
            loading={loading}
            dataSource={users}
            columns={columns}
            bordered={false}
            onChange={handleTableChange}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              getCheckboxProps: (record) => ({
                disabled: !record.isActive || record.username === currentUsername,
              }),
            }}
            pagination={{
              current: paginationState.current,
              pageSize: paginationState.pageSize,
              showSizeChanger: true,
              total: meta.total,
              showTotal: (total, range) => t('pagination', { start: range[0], end: range[1], total }),
            }}
            locale={{ emptyText: tableEmptyText }}
          />
        </div>
      </Card>

      <UserCreateModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        roles={roles}
        rolesLoading={rolesLoading}
        submitting={submitting}
        onCreate={handleCreateUser}
      />

      <UserUpdateModal
        isUpdateModalOpen={isUpdateModalOpen}
        setIsUpdateModalOpen={setIsUpdateModalOpen}
        dataUpdate={dataUpdate}
        setDataUpdate={setDataUpdate}
        roles={roles}
        rolesLoading={rolesLoading}
        submitting={submitting}
        onUpdate={handleUpdateUser}
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
