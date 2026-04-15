import { Button, Form, Input, Modal, notification } from "antd";
import { sendRequest } from "@/utils/api";
import { getSession } from "next-auth/react";

interface IProps {
    isCreateModalOpen: boolean;
    setIsCreateModalOpen: (v: boolean) => void;
    fetchUsers: () => void;
    session: any;
}

const UserCreateModal = (props: IProps) => {
    const { isCreateModalOpen, setIsCreateModalOpen, fetchUsers, session } = props;
    const [form] = Form.useForm();

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
            headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` }
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
            </Form>
        </Modal>
    )
}

export default UserCreateModal;
