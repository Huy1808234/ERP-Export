'use client';

import { Button, Form, Input, Modal, Space, Steps, Typography } from 'antd';
import {
  CheckCircleOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { notification } from '@/providers/antd-static';
import { sendRequest } from '@/lib/api-client';
import { useHasMounted } from '@/hooks/useHasMounted';
import AuthFlowModalStyles from './auth-flow-modal.styles';

const { Text, Title } = Typography;

type ModalChangePasswordProps = {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
};

const normalizeVerificationCode = (code: string): string =>
  code.replace(/[\s\u200B-\u200D\uFEFF]+/g, '');

const modalStyles = {
  mask: {
    backdropFilter: 'blur(14px)',
    background: 'rgba(2, 6, 23, 0.72)',
  },
  container: {
    padding: 0,
    borderRadius: 22,
    background: 'transparent',
    boxShadow: '0 28px 70px rgba(2, 6, 23, 0.55)',
  },
  body: {
    padding: 0,
    background: 'transparent',
  },
};

const ModalChangePassword = ({ isModalOpen, setIsModalOpen }: ModalChangePasswordProps) => {
  const [current, setCurrent] = useState(0);
  const [accountRef, setAccountRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const hasMounted = useHasMounted();

  if (!hasMounted) return null;

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrent(0);
    setAccountRef('');
    emailForm.resetFields();
    passwordForm.resetFields();
  };

  const onFinishStep0 = async (values: { email: string }) => {
    setLoading(true);
    const res = await sendRequest<IBackendRes<{ _id: string }>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/forgot-password`,
      method: 'POST',
      body: { email: values.email.trim() },
    });
    setLoading(false);

    if (res?.data?._id) {
      setAccountRef(res.data._id);
      setCurrent(1);
      return;
    }

    notification.error({
      title: 'Không thể xử lý yêu cầu',
      description: res?.message,
    });
  };

  const onFinishStep1 = async (values: {
    code: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      notification.error({
        title: 'Không thể xử lý yêu cầu',
        description: 'Mật khẩu xác nhận không khớp.',
      });
      return;
    }

    setLoading(true);
    const res = await sendRequest<IBackendRes<unknown>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/change-password`,
      method: 'POST',
      body: {
        code: normalizeVerificationCode(values.code),
        accountRef,
        password: values.password,
      },
    });
    setLoading(false);

    if (res?.data) {
      setCurrent(2);
      passwordForm.resetFields();
      return;
    }

    notification.error({
      title: 'Không thể xử lý yêu cầu',
      description: res?.message,
    });
  };

  return (
    <Modal
      open={isModalOpen}
      onCancel={closeModal}
      footer={null}
      centered
      width={560}
      className="auth-flow-modal"
      rootClassName="auth-flow-root"
      wrapClassName="auth-flow-wrap"
      classNames={{
        root: 'auth-flow-root-node',
        wrapper: 'auth-flow-wrapper',
        container: 'auth-flow-container',
        body: 'auth-flow-body',
        mask: 'auth-flow-mask',
      }}
      forceRender
      styles={modalStyles}
      title={null}
    >
      <div className="auth-flow-panel">
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          <div>
            <Text className="auth-flow-kicker">Admin Access</Text>
            <Title level={3} className="auth-flow-title">
              Đặt lại mật khẩu
            </Title>
            <Text className="auth-flow-subtitle">
              Xác minh email tài khoản trước khi tạo mật khẩu mới.
            </Text>
          </div>

          <Steps
            current={current}
            responsive={false}
            className="auth-flow-steps"
            items={[
              { title: 'Email', icon: <MailOutlined /> },
              { title: 'Xác minh', icon: <SafetyCertificateOutlined /> },
              { title: 'Hoàn tất', icon: <CheckCircleOutlined /> },
            ]}
          />

          <Form
              name="forgot-password-email"
              onFinish={onFinishStep0}
              autoComplete="off"
              layout="vertical"
              form={emailForm}
              className="auth-flow-form"
              style={{ display: current === 0 ? undefined : 'none' }}
            >
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email.' },
                  { type: 'email', message: 'Email không hợp lệ.' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="email@example.com" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                icon={<KeyOutlined />}
                className="auth-flow-primary"
              >
                Gửi mã xác minh
              </Button>
            </Form>

          <Form
              name="forgot-password-reset"
              onFinish={onFinishStep1}
              autoComplete="off"
              layout="vertical"
              form={passwordForm}
              className="auth-flow-form"
              style={{ display: current === 1 ? undefined : 'none' }}
            >
              <Form.Item
                label="Mã xác minh"
                name="code"
                normalize={(value?: string) => normalizeVerificationCode(value || '').slice(0, 6)}
                rules={[{ required: true, message: 'Vui lòng nhập mã xác minh.' }]}
              >
                <Input
                  prefix={<SafetyCertificateOutlined />}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Nhập mã trong email"
                />
              </Form.Item>
              <Form.Item
                label="Mật khẩu mới"
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới.' },
                  { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự.' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Tối thiểu 6 ký tự" />
              </Form.Item>
              <Form.Item
                label="Xác nhận mật khẩu"
                name="confirmPassword"
                rules={[{ required: true, message: 'Vui lòng xác nhận mật khẩu.' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                icon={<LockOutlined />}
                className="auth-flow-primary"
              >
                Cập nhật mật khẩu
              </Button>
            </Form>

          {current === 2 && (
            <div className="auth-flow-result">
              <CheckCircleOutlined />
              <Title level={4}>Mật khẩu đã được cập nhật</Title>
              <Text>Vui lòng đăng nhập lại bằng mật khẩu mới.</Text>
              <Button type="primary" block className="auth-flow-primary" onClick={closeModal}>
                Quay lại đăng nhập
              </Button>
            </div>
          )}
        </Space>
      </div>

      <AuthFlowModalStyles />
    </Modal>
  );
};

export default ModalChangePassword;
