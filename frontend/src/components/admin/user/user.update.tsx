import { Form, Input, Modal, Select } from 'antd';
import { notification } from '@/providers/antd-static';
import { useEffect } from 'react';
import type { RoleOption, UpdateUserPayload, UserRow } from '@/types/user';

interface UserUpdateModalProps {
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (value: boolean) => void;
  dataUpdate: UserRow | null;
  setDataUpdate: (user: UserRow | null) => void;
  roles: RoleOption[];
  rolesLoading: boolean;
  submitting: boolean;
  onUpdate: (userRef: string, payload: UpdateUserPayload) => Promise<boolean>;
}

const getUserRoleName = (user: UserRow): string | undefined => {
  if (typeof user.role === 'string') return user.role;
  return user.role?.name || user.roleName || undefined;
};

const UserUpdateModal = (props: UserUpdateModalProps) => {
  const {
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    dataUpdate,
    setDataUpdate,
    roles,
    rolesLoading,
    submitting,
    onUpdate,
  } = props;
  const [form] = Form.useForm<UpdateUserPayload>();

  useEffect(() => {
    if (!dataUpdate) return;

    form.setFieldsValue({
      name: dataUpdate.name,
      email: dataUpdate.email,
      phone: dataUpdate.phone || undefined,
      address: dataUpdate.address || undefined,
      roleName: getUserRoleName(dataUpdate),
    });
  }, [dataUpdate, form]);

  const handleCloseUpdateModal = () => {
    form.resetFields();
    setIsUpdateModalOpen(false);
    setDataUpdate(null);
  };

  const handleFinish = async (values: UpdateUserPayload) => {
    const userRef = dataUpdate?._id || dataUpdate?.username;
    if (!userRef) return;

    const success = await onUpdate(userRef, {
      ...values,
      name: values.name?.trim() || undefined,
      email: values.email?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      address: values.address?.trim() || undefined,
    });

    if (success) {
      handleCloseUpdateModal();
      notification.success({ title: 'Cập nhật tài khoản thành công!' });
    }
  };

  return (
    <Modal
      title={`Chỉnh sửa: ${dataUpdate?.username || ''}`}
      open={isUpdateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleCloseUpdateModal}
      confirmLoading={submitting}
      okText="Lưu thay đổi"
      cancelText="Hủy"
      mask={{ closable: false }}
      destroyOnHidden
      forceRender
    >
      <Form name="update-user" onFinish={handleFinish} layout="vertical" form={form}>
        <Form.Item
          label="Tên hiển thị"
          name="name"
          rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
        >
          <Input autoComplete="name" />
        </Form.Item>

        <Form.Item label="Username">
          <Input value={dataUpdate?.username} disabled />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[{ type: 'email', message: 'Email không hợp lệ!' }]}
        >
          <Input autoComplete="email" />
        </Form.Item>

        <Form.Item label="Số điện thoại" name="phone">
          <Input autoComplete="tel" />
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
            loading={rolesLoading}
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
