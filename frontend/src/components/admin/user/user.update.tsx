import { Form, Input, Modal, Select } from "antd";
import { notification } from "@/providers/antd-static";
import { useEffect, useState } from "react";
import { sendRequest } from "@/lib/api-client";
import { getSession } from "next-auth/react";
import { getAccessToken } from '@/lib/auth-token';

interface IProps {
    isUpdateModalOpen: boolean;
    setIsUpdateModalOpen: (v: boolean) => void;
    fetchUsers: () => void;
    dataUpdate: IUserUpdateModalData | null;
    setDataUpdate: (user: null) => void;
    session: unknown;
}

interface IRole {
    _id: string;
    name: string;
    description: string;
}

interface IUserUpdateModalData {
    _id: string;
    username: string;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    roleName?: string | null;
    role?: { name?: string | null } | string | null;
}

interface IUserUpdateFormValues {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    roleName: string;
}

const UserUpdateModal = (props: IProps) => {
    const { isUpdateModalOpen, setIsUpdateModalOpen, fetchUsers, dataUpdate, setDataUpdate } = props;
    const [form] = Form.useForm<IUserUpdateFormValues>();
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
        };
        if (isUpdateModalOpen) {
            fetchRoles();
        }
    }, [isUpdateModalOpen]);

    useEffect(() => {
        if (dataUpdate) {
            form.setFieldsValue({
                name: dataUpdate.name,
                email: dataUpdate.email,
                phone: dataUpdate.phone || undefined,
                address: dataUpdate.address || undefined,
                roleName: (typeof dataUpdate.role === 'string' ? dataUpdate.role : dataUpdate.role?.name) || dataUpdate.roleName || undefined,
            });
        }
    }, [dataUpdate, form]);

    const handleCloseUpdateModal = () => {
        form.resetFields();
        setIsUpdateModalOpen(false);
        setDataUpdate(null);
    };

    const onFinish = async (values: IUserUpdateFormValues) => {
        const userRef = dataUpdate?._id || dataUpdate?.username;
        if (!userRef) return;

        const currentSession = await getSession();
        const payload: Record<string, unknown> = { ...values };
        const res = await sendRequest<IBackendRes<{ message: string }>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${userRef}`,
            method: "PATCH",
            body: payload,
            headers: { Authorization: `Bearer ${getAccessToken(currentSession)}` }
        });
        if (res?.data) {
            handleCloseUpdateModal();
            fetchUsers();
            notification.success({
                title: "Cập nhật tài khoản thành công!",
            });
        } else {
            notification.error({
                title: "Có lỗi xảy ra",
                description: res.message
            });
        }
    };

    return (
        <Modal
            title={`Chỉnh sửa: ${dataUpdate?.username || ''}`}
            open={isUpdateModalOpen}
            onOk={() => form.submit()}
            onCancel={handleCloseUpdateModal}
            mask={{ closable: false }}
            destroyOnHidden
            forceRender
        >
            <Form name="update" onFinish={onFinish} layout="vertical" form={form}>
                <Form.Item
                    label="Tên hiển thị"
                    name="name"
                    rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item label="Username">
                    <Input value={dataUpdate?.username} disabled />
                </Form.Item>

                <Form.Item
                    label="Email"
                    name="email"
                    rules={[{ type: 'email', message: 'Email không hợp lệ!' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item label="Số điện thoại" name="phone">
                    <Input />
                </Form.Item>

                <Form.Item label="Địa chỉ" name="address">
                    <Input />
                </Form.Item>

                <Form.Item
                    label="Vai trò"
                    name="roleName"
                    rules={[{ required: true, message: 'Vui lòng chọn quyền!' }]}
                >
                    <Select
                        placeholder="Chọn vai trò người dùng"
                        options={roles.map((role) => ({
                            value: role.name,
                            label: role.name + (role.description ? ` - ${role.description}` : ''),
                        }))}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default UserUpdateModal;
