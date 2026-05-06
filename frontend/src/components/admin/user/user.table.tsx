'use client'
import { Button, Popconfirm, Space, Table, Tag, Input } from "antd"
import { notification } from "@/library/antd.static"
import { DeleteOutlined, EditOutlined, PlusOutlined, UserOutlined, SearchOutlined, FilterOutlined, TeamOutlined, CheckCircleOutlined, StopOutlined } from "@ant-design/icons"
import { PageHeader } from "@/components/ui/PageHeader"
import { useEffect, useState, useMemo } from "react"
import { sendRequest } from "@/utils/api"
import { getSession, useSession } from "next-auth/react"
import UserCreateModal from './user.create'
import UserUpdateModal from './user.update'
import { Card, Row, Col, Statistic, Avatar, Divider, Select, Tooltip, Badge, theme, Typography } from "antd"

import { useTheme } from "@/library/theme.context"

const { Option } = Select;
const { Text } = Typography;

const UserTable = () => {
    const { token } = theme.useToken();
    const { isDark } = useTheme();
    const { data: session } = useSession();
    const [users, setUsers] = useState<any[]>([]);
    const [meta, setMeta] = useState({
        current: 1,
        pageSize: 10,
        pages: 0,
        total: 0
    });
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
    const [dataUpdate, setDataUpdate] = useState<any>(null);
    const [searchText, setSearchText] = useState<string>("");
    const [filterRole, setFilterRole] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const fetchUsers = async () => {
        setLoading(true);
        const currentSession = await getSession();
        const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
            method: "GET",
            queryParams: {
                current: meta.current,
                pageSize: meta.pageSize,
                ...(searchText ? { name: `/${searchText}/i` } : {}),
                ...(filterRole ? { "role.name": filterRole } : {}),
                ...(filterStatus !== null ? { isActive: filterStatus } : {})
            },
            headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
        });
        setLoading(false);
        if (res?.data) {
            setUsers(res.data.results);
            setMeta({
                current: meta.current,
                pageSize: meta.pageSize,
                pages: res.data.totalPages,
                total: res.data.totalItems || (res.data.totalPages * meta.pageSize)
            })
        }
    }

    useEffect(() => {
        fetchUsers();
    }, [meta.current, meta.pageSize, searchText, filterRole, filterStatus])

    const stats = useMemo(() => {
        return {
            total: meta.total,
            active: users.filter(u => u.isActive).length,
            admin: users.filter(u => u.role?.name === 'ADMIN').length
        }
    }, [users, meta.total]);

    const confirmDelete = async (id: string) => {
        const currentSession = await getSession();
        const token = currentSession?.user?.access_token;
        if (!token) {
            notification.error({ title: "Lỗi nội bộ", description: "Không tìm thấy token!" });
            return;
        }

        const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${id}`,
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res?.data) {
            notification.success({
                title: "Xoá người dùng thành công",
            });
            fetchUsers();
        } else {
            notification.error({
                title: "Có lỗi xảy ra",
                description: res.message
            });
        }
    }

    const columns = [
        {
            title: 'Hội viên',
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
                        <span style={{ fontSize: '12px', color: token.colorTextSecondary }}>{record.email}</span>
                    </div>
                </Space>
            )
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
            render: (phone: string) => phone || <span style={{ color: token.colorTextPlaceholder }}>--</span>
        },
        {
            title: 'Quyền hạn',
            dataIndex: 'role',
            key: 'role',
            render: (role: any) => {
                const name = typeof role === 'string' ? role : role?.name || 'N/A';
                const colorMap: any = {
                    'ADMIN': 'magenta',
                    'SALES': 'blue',
                    'PURCHASING': 'cyan',
                    'LOGISTICS': 'purple',
                    'ACCOUNTING': 'orange',
                    'WAREHOUSE': 'green'
                };
                return (
                    <Tag color={colorMap[name] || 'default'} style={{ borderRadius: '12px', padding: '0 10px' }}>
                        {name}
                    </Tag>
                )
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                <Badge 
                    status={isActive ? "success" : "default"} 
                    text={isActive ? "Đang hoạt động" : "Tạm khóa"} 
                />
            )
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (text: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="Chỉnh sửa">
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
                        title="Xóa người dùng?"
                        onConfirm={() => confirmDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const handleOnChange = (pagination: any) => {
        if (pagination && pagination.current !== meta.current) {
            setMeta({
                ...meta,
                current: pagination.current,
                pageSize: pagination.pageSize
            })
        }
    }

    return (
        <div style={{ 
            padding: '24px', 
            backgroundColor: isDark ? '#0f172a' : token.colorBgLayout, 
            minHeight: '100vh',
            transition: 'all 0.3s ease'
        }}>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
                        <Statistic
                            title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Tổng người dùng</Text>}
                            value={stats.total}
                            prefix={<TeamOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
                            styles={{ content: { color: isDark ? '#f8fafc' : undefined } }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
                        <Statistic
                            title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Đang hoạt động</Text>}
                            value={stats.active}
                            styles={{ content: { color: '#52c41a' } }}
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card variant="borderless" hoverable style={{ borderRadius: '12px', background: isDark ? '#1e293b' : token.colorBgContainer }}>
                        <Statistic
                            title={<Text type="secondary" style={{ color: isDark ? '#94a3b8' : undefined }}>Quản trị viên</Text>}
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
                    borderRadius: '12px', 
                    background: isDark ? '#1e293b' : token.colorBgContainer,
                    boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)' 
                }}
                styles={{ body: { padding: 0 } }}
            >
                <div style={{
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: '20px 24px',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`
                }}>
                    <PageHeader 
                        title="Quản Lý Người Dùng" 
                        icon={<UserOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />} 
                        description="Hệ thống quản trị nhân sự và phân quyền đa cấp" 
                    />
                    <Button 
                        type="primary" 
                        size="large"
                        icon={<PlusOutlined />} 
                        onClick={() => setIsCreateModalOpen(true)}
                        style={{ borderRadius: '8px' }}
                    >
                        Tạo người dùng mới
                    </Button>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <Space size="middle">
                        <Input
                            placeholder="Tìm tên, email..."
                            prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                            allowClear
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 300 }}
                            size="large"
                        />
                        <Select 
                            placeholder="Vai trò" 
                            style={{ width: 150 }} 
                            allowClear
                            size="large"
                            onChange={setFilterRole}
                        >
                            <Option value="ADMIN">ADMIN</Option>
                            <Option value="SALES">SALES</Option>
                            <Option value="LOGISTICS">LOGISTICS</Option>
                            <Option value="WAREHOUSE">WAREHOUSE</Option>
                        </Select>
                        <Select 
                            placeholder="Trạng thái" 
                            style={{ width: 150 }} 
                            allowClear
                            size="large"
                            onChange={setFilterStatus}
                        >
                            <Option value="true">Hoạt động</Option>
                            <Option value="false">Tạm khóa</Option>
                        </Select>
                    </Space>

                    {selectedRowKeys.length > 0 && (
                        <Space>
                            <Text type="secondary">
                                Đã chọn <b>{selectedRowKeys.length}</b> mục
                            </Text>
                            <Popconfirm
                                title={`Xóa ${selectedRowKeys.length} người dùng?`}
                                onConfirm={async () => {
                                    const currentSession = await getSession();
                                    const res = await sendRequest<IBackendRes<any>>({
                                        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/bulk-delete`,
                                        method: "POST",
                                        body: { ids: selectedRowKeys },
                                        headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
                                    });
                                    if (res?.data) {
                                        notification.success({ title: "Thao tác thành công", description: res.message });
                                        setSelectedRowKeys([]);
                                        fetchUsers();
                                    } else {
                                        notification.error({ title: "Lỗi", description: res.message });
                                    }
                                }}
                                okText="Xóa tất cả"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                            >
                                <Button 
                                    danger 
                                    type="primary"
                                    icon={<DeleteOutlined />}
                                    style={{ borderRadius: '8px' }}
                                >
                                    Xóa hàng loạt
                                </Button>
                            </Popconfirm>
                        </Space>
                    )}
                </div>
                
                <div className="premium-table">
                    <Table
                        rowKey={"id"}
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
                            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} người dùng`
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
                    color: ${isDark ? '#8c8c8c' : '#595959'} !important;
                    font-weight: 600 !important;
                    border-bottom: 1px solid ${isDark ? '#303030' : '#f0f0f0'} !important;
                }
                .premium-table .ant-table-tbody > tr > td {
                    border-bottom: 1px solid ${isDark ? '#303030' : '#f0f0f0'} !important;
                }
                .premium-table .ant-table-placeholder {
                    background: transparent !important;
                }
            `}</style>
        </div>
    )
}

export default UserTable;
