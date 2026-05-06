import { Form, Input, Modal, Select, Switch } from "antd";
import { notification } from "@/library/antd.static";
import { useEffect, useState } from "react";
import { sendRequest } from "@/utils/api";
import { getSession } from "next-auth/react";

interface IProps {
    isUpdateModalOpen: boolean;
    setIsUpdateModalOpen: (v: boolean) => void;
    fetchUsers: () => void;
    dataUpdate: any;
    setDataUpdate: any;
    session: any;
}

interface IRole {
    id: string;
    name: string;
    description: string;
}

const UserUpdateModal = (props: IProps) => {
    const { isUpdateModalOpen, setIsUpdateModalOpen, fetchUsers, dataUpdate, setDataUpdate, session } = props;
    const [form] = Form.useForm();
    const [roles, setRoles] = useState<IRole[]>([]);

    useEffect(() => {
        const fetchRoles = async () => {
            const currentSession = await getSession();
            const res = await sendRequest<IBackendRes<IRole[]>>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/roles`,
                method: "GET",
                headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
            });
            if (res?.data) {
                setRoles(res.data);
            }
        }
        if (isUpdateModalOpen) {
            fetchRoles();
        }
    }, [isUpdateModalOpen]);

    useEffect(() => {
        if (dataUpdate) {
            form.setFieldsValue({
                name: dataUpdate.name,
                phone: dataUpdate.phone,
                address: dataUpdate.address,
                roleId: dataUpdate.role?.id || dataUpdate.roleId,
                isActive: dataUpdate.isActive
            });
        }
    }, [dataUpdate, form])

    const handleCloseUpdateModal = () => {
        form.resetFields();
        setIsUpdateModalOpen(false);
        setDataUpdate(null);
    }

    const onFinish = async (values: any) => {
        if (!dataUpdate?.id) return;
        
        const currentSession = await getSession();
        const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${dataUpdate.id}`,
            method: "PATCH",
            body: { id: dataUpdate.id, ...values },
            headers: { Authorization: `Bearer ${currentSession?.user?.access_token}` }
        })
        if (res?.data) {
            handleCloseUpdateModal();
            fetchUsers();
            notification.success({
                title: "Cập nhật tài khoản thành công!",
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
            title={`Chỉnh sửa: ${dataUpdate?.email}`}
            open={isUpdateModalOpen}
            onOk={() => form.submit()}
            onCancel={handleCloseUpdateModal}
            mask={{ closable: false }}
            destroyOnHidden
        >
            <Form name="update" onFinish={onFinish} layout="vertical" form={form}>
                <Form.Item
                    label="Tên hiển thị"
                    name="name"
                    rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
                >
                    <Input />
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
                    name="roleId"
                    rules={[{ required: true, message: 'Vui lòng chọn quyền!' }]}
                >
                    <Select
                        placeholder="Chọn vai trò người dùng"
                        options={roles.map(r => ({ value: r.id, label: r.name + (r.description ? ` - ${r.description}` : '') }))}
                    />
                </Form.Item>

                <Form.Item
                    label="Trạng thái kích hoạt"
                    name="isActive"
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    )
}

export default UserUpdateModal;
