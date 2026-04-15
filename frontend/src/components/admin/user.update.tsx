import { Form, Input, Modal, Select, Switch, notification } from "antd";
import { useEffect } from "react";
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

const UserUpdateModal = (props: IProps) => {
    const { isUpdateModalOpen, setIsUpdateModalOpen, fetchUsers, dataUpdate, setDataUpdate, session } = props;
    const [form] = Form.useForm();

    useEffect(() => {
        if (dataUpdate) {
            form.setFieldsValue({
                name: dataUpdate.name,
                phone: dataUpdate.phone,
                address: dataUpdate.address,
                role: dataUpdate.role,
                isActive: dataUpdate.isActive
            });
        }
    }, [dataUpdate])

    const handleCloseUpdateModal = () => {
        form.resetFields();
        setIsUpdateModalOpen(false);
        setDataUpdate(null);
    }

    const onFinish = async (values: any) => {
        if (!dataUpdate?._id) return;
        
        const currentSession = await getSession();
        const res = await sendRequest<IBackendRes<any>>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/users/${dataUpdate._id}`,
            method: "PATCH",
            body: { _id: dataUpdate._id, ...values },
            headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` }
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
                    label="Loại Quyền"
                    name="role"
                >
                    <Select
                        options={[
                            { value: 'USER', label: 'USER' },
                            { value: 'ADMIN', label: 'ADMIN' },
                        ]}
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
