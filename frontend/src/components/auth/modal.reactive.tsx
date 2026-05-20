'use client';

import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Steps, Typography } from 'antd';
import {
  CheckCircleOutlined,
  MailOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { notification } from '@/providers/antd-static';
import { useHasMounted } from '@/hooks/useHasMounted';
import { sendRequest } from '@/lib/api-client';
import AuthFlowModalStyles from './auth-flow-modal.styles';

const { Text, Title } = Typography;

type ModalReactiveProps = {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
  useEmail?: string;
};

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

const ModalReactive = ({ isModalOpen, setIsModalOpen, useEmail }: ModalReactiveProps) => {
  const [current, setCurrent] = useState(0);
  const [accountRef, setAccountRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [codeForm] = Form.useForm();
  const hasMounted = useHasMounted();

  useEffect(() => {
    if (useEmail) {
      form.setFieldsValue({ username: useEmail });
    }
  }, [form, useEmail]);

  if (!hasMounted) return null;

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrent(0);
    setAccountRef('');
    form.resetFields();
    codeForm.resetFields();
  };

  const requestActivationCode = async (email: string) => {
    setLoading(true);
    const res = await sendRequest<IBackendRes<{ _id: string }>>({
      method: 'POST',
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/retry-active`,
      body: { email },
    });
    setLoading(false);

    if (res?.data?._id) {
      setAccountRef(res.data._id);
      return true;
    }

    notification.error({
      title: 'Không thể gửi mã kích hoạt',
      description: res?.message,
    });
    return false;
  };

  const onFinishStep0 = async (values: { username: string }) => {
    const requested = await requestActivationCode(values.username);
    if (requested) {
      setCurrent(1);
    }
  };

  const onFinishStep1 = async (values: { code: string }) => {
    setLoading(true);
    const res = await sendRequest<IBackendRes<unknown>>({
      method: 'POST',
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/check-code`,
      body: { accountRef, code: values.code },
    });
    setLoading(false);

    if (res?.data) {
      setCurrent(2);
      codeForm.resetFields();
      return;
    }

    notification.error({
      title: 'Kích hoạt thất bại',
      description: res?.message,
    });
  };

  const resendCode = async () => {
    const email = useEmail || form.getFieldValue('username');
    if (!email) {
      notification.error({
        title: 'Thiếu email',
        description: 'Vui lòng nhập email để gửi lại mã kích hoạt.',
      });
      return;
    }

    const requested = await requestActivationCode(email);
    if (requested) {
      notification.success({
        title: 'Đã gửi mã mới',
        description: 'Mã kích hoạt mới đã được gửi vào email của bạn.',
      });
    }
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
              Kích hoạt tài khoản
            </Title>
            <Text className="auth-flow-subtitle">
              Gửi lại mã và xác minh email để mở quyền truy cập hệ thống.
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
              name="reactive-email"
              onFinish={onFinishStep0}
              autoComplete="off"
              layout="vertical"
              form={form}
              className="auth-flow-form"
              style={{ display: current === 0 ? undefined : 'none' }}
            >
              <Form.Item
                label="Email"
                name="username"
                rules={[
                  { required: true, message: 'Vui lòng nhập email.' },
                  { type: 'email', message: 'Email không hợp lệ.' },
                ]}
              >
                <Input
                  disabled={Boolean(useEmail)}
                  prefix={<UserOutlined />}
                  placeholder="email@example.com"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                icon={<ReloadOutlined />}
                className="auth-flow-primary"
              >
                Gửi mã kích hoạt
              </Button>
            </Form>

          <Form
              name="reactive-code"
              onFinish={onFinishStep1}
              autoComplete="off"
              layout="vertical"
              form={codeForm}
              className="auth-flow-form"
              style={{ display: current === 1 ? undefined : 'none' }}
            >
              <Form.Item
                label="Mã kích hoạt"
                name="code"
                rules={[{ required: true, message: 'Vui lòng nhập mã kích hoạt.' }]}
              >
                <Input
                  prefix={<SafetyCertificateOutlined />}
                  placeholder="Nhập mã được gửi qua email"
                />
              </Form.Item>
              <div className="auth-flow-actions">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<SafetyCertificateOutlined />}
                  className="auth-flow-primary"
                >
                  Kích hoạt
                </Button>
                <Button
                  htmlType="button"
                  loading={loading}
                  icon={<ReloadOutlined />}
                  className="auth-flow-secondary"
                  onClick={resendCode}
                >
                  Gửi lại mã
                </Button>
              </div>
            </Form>

          {current === 2 && (
            <div className="auth-flow-result">
              <CheckCircleOutlined />
              <Title level={4}>Tài khoản đã được kích hoạt</Title>
              <Text>Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.</Text>
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

export default ModalReactive;
