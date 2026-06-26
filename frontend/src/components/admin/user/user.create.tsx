import { Form, Input, Modal, Select, Switch } from 'antd';
import { notification } from '@/providers/antd-static';
import type { CreateUserPayload, RoleOption } from '@/types/user';

interface UserCreateModalProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (value: boolean) => void;
  roles: RoleOption[];
  rolesLoading: boolean;
  submitting: boolean;
  onCreate: (payload: CreateUserPayload) => Promise<boolean>;
}

const UserCreateModal = (props: UserCreateModalProps) => {
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    roles,
    rolesLoading,
    submitting,
    onCreate,
  } = props;
  const [form] = Form.useForm<CreateUserPayload>();

  const handleCloseCreateModal = () => {
    form.resetFields();
    setIsCreateModalOpen(false);
  };

  const handleFinish = async (values: CreateUserPayload) => {
    const success = await onCreate({
      ...values,
      username: values.username.trim(),
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || undefined,
      address: values.address?.trim() || undefined,
    });

    if (success) {
      handleCloseCreateModal();
      notification.success({ title: 'Tạo mới tài khoản thành công!' });
    }
  };

  return (
    <Modal
      title="Thêm mới người dùng"
      open={isCreateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleCloseCreateModal}
      confirmLoading={submitting}
      okText="Tạo người dùng"
      cancelText="Hủy"
      mask={{ closable: false }}
      destroyOnHidden
    >
      <Form
        name="create-user"
        onFinish={handleFinish}
        layout="vertical"
        form={form}
        initialValues={{ isActive: true }}
      >
        <Form.Item
          label="Tên hiển thị"
          name="name"
          rules={[{ required: true, message: 'Vui lòng nhập tên hiển thị!' }]}
        >
          <Input autoComplete="name" />
        </Form.Item>

        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: 'Vui lòng nhập username!' }]}
        >
          <Input autoComplete="username" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Vui lòng nhập email!' },
            { type: 'email', message: 'Email không hợp lệ!' },
          ]}
        >
          <Input autoComplete="email" />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu!' },
            { min: 6, message: 'Mật khẩu nên có ít nhất 6 ký tự.' },
          ]}
        >
          <Input.Password autoComplete="new-password" />
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

        <Form.Item
          label="Trạng thái kích hoạt"
          name="isActive"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserCreateModal;
