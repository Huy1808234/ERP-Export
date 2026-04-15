'use client'
import { Button, Popconfirm, Space, Table, notification, Tag } from "antd"
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons"
import { useEffect, useState } from "react"
import { sendRequest } from "@/utils/api"
import { getSession, useSession } from "next-auth/react"
import UserCreateModal from "./user.create"
import UserUpdateModal from "./user.update"

const UserTable = () => {
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

    const fetchUsers = async () => {
        const currentSession = await getSession();
        const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
            method: "GET",
            queryParams: {
                current: meta.current,
                pageSize: meta.pageSize
            },
            headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` }
        });
        if (res?.data) {
            setUsers(res.data.results);
            setMeta({
                current: meta.current,
                pageSize: meta.pageSize,
                pages: res.data.totalPages,
                total: res.data.totalPages * meta.pageSize // approx
            })
        }
    }

    useEffect(() => {
        fetchUsers();
    }, [meta.current, meta.pageSize])

    const confirmDelete = async (id: string) => {
        const currentSession = await getSession();
        const token = (currentSession as any)?.user?.access_token;
        console.log("SENDING DELETE WITH TOKEN: ", token ? `VALID_STRING_LEN_${token.length}` : typeof token);
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
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => (
                <Tag color={role === 'ADMIN' ? 'red' : 'green'}>{role}</Tag>
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'blue' : 'default'}>
                    {isActive ? "Active" : "Inactive"}
                </Tag>
            )
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (text: any, record: any) => (
                <Space size="middle">
                    <Button 
                        type="primary" 
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setDataUpdate(record);
                            setIsUpdateModalOpen(true);
                        }}
                    >
                        Sửa
                    </Button>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa không?"
                        onConfirm={() => confirmDelete(record._id)}
                        okText="Có"
                        cancelText="Hủy"
                    >
                        <Button danger icon={<DeleteOutlined />}>Xóa</Button>
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
        <>
            <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20
            }}>
                <span>Manager Users</span>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    Create User
                </Button>
            </div>
            
            <Table
                rowKey={"_id"}
                bordered
                dataSource={users}
                columns={columns}
                onChange={handleOnChange}
                pagination={{
                    current: meta.current,
                    pageSize: meta.pageSize,
                    showSizeChanger: true,
                    total: meta.total,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`
                }}
            />

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
        </>
    )
}

export default UserTable;