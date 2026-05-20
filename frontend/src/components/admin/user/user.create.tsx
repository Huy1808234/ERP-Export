import { Button, Form, Input, Modal, Select, Switch } from "antd";
import { notification } from "@/providers/antd-static";
import { useEffect, useState } from "react";
import { sendRequest } from "@/lib/api-client";
import { getSession } from "next-auth/react";
import { getAccessToken } from '@/lib/auth-token';

interface IProps {
    isCreateModalOpen: boolean;
    setIsCreateModalOpen: (v: boolean) => void;
    fetchUsers: () => void;
    session: any;
}

interface IRole {
    _id: string;
    name: string;
    description: string;
}

const UserCreateModal = (props: IProps) => {
    const { isCreateModalOpen, setIsCreateModalOpen, fetchUsers, session } = props;
    const [form] = Form.useForm();
    const [roles, setRoles] = useState<IRole[]>([]);

    useEffect(() => {
        const fetchRoles = async () => {
            const currentSession = await getSession();
            const res = await sendRequest<IBackendRes<IRole[]>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles`,
                method: "GET",
                headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` }
            });
            if (res?.data) {
                setRoles(res.data);
            }
        }
        if (isCreateModalOpen) {
            fetchRoles();
        }
    }, [isCreateModalOpen]);

    const handleCloseCreateModal = () => {
        form.resetFields();
        setIsCreateModalOpen(false);
    }

    const onFinish = async (values: any) => {
        const currentSession = await getSession();
        const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users`,
            method: "POST",
            body: { ...values },
            headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` }
        })
        if (res?.data) {
            handleCloseCreateModal();
            fetchUsers();
            notification.success({
                title: "Tạo mới tài khoản thành công!",
            })
        } else {
            notification.error({
                title: "Có lỗi xảy ra",
                description: res.message
            })
        }
    };

    return (
        <Modal
            title="Thêm Mới Người Dùng"
            open={isCreateModalOpen}
            onOk={() => form.submit()}
            onCancel={handleCloseCreateModal}
            mask={{ closable: false }}
            destroyOnHidden
        >
            <Form name="basic" onFinish={onFinish} layout="vertical" form={form}>
                <Form.Item
                    label="Tên hiển thị"
                    name="name"
                    rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Username"
                    name="username"
                    rules={[{ required: true, message: 'Vui long nhap username!' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Email"
                    name="email"
                    rules={[{ required: true, message: 'Vui lòng nhập email!' }]}
                >
                    <Input type="email" />
                </Form.Item>

                <Form.Item
                    label="Password"
                    name="password"
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                >
                    <Input.Password />
                </Form.Item>

                <Form.Item
                    label="Số điện thoại"
                    name="phone"
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Địa chỉ"
                    name="address"
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Loại Quyền (Role)"
                    name="roleName"
                    rules={[{ required: true, message: 'Vui lòng chọn quyền!' }]}
                >
                    <Select
                        placeholder="Chọn vai trò người dùng"
                        options={roles.map(r => ({ value: r.name, label: r.name + (r.description ? ` - ${r.description}` : '') }))}
                    />
                </Form.Item>
                
                <Form.Item
                    label="Trạng thái kích hoạt"
                    name="isActive"
                    valuePropName="checked"
                    initialValue={true}
                >
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    )
}

export default UserCreateModal;
