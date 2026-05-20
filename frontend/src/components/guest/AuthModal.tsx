'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, Button, Divider, Typography, message } from 'antd';
import {
    UserOutlined,
    LockOutlined,
    MailOutlined,
    ArrowLeftOutlined,
    SafetyCertificateOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import { sendRequest } from '@/lib/api-client';
import { authenticate } from '@/utils/action';

const { Text } = Typography;

type AuthView = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface AuthModalProps {
    open: boolean;
    onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
    const [view, setView] = useState<AuthView>('login');
    const [loading, setLoading] = useState(false);
    const [loginForm] = Form.useForm();
    const [registerForm] = Form.useForm();
    const [verifyForm] = Form.useForm();
    const [forgotForm] = Form.useForm();
    const [resetForm] = Form.useForm();
    const [userId, setUserId] = useState('');
    const [userEmail, setUserEmail] = useState('');

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    const handleClose = () => {
        setView('login');
        loginForm.resetFields();
        registerForm.resetFields();
        verifyForm.resetFields();
        forgotForm.resetFields();
        resetForm.resetFields();
        onClose();
    };

    // ===== LOGIN =====
    const handleLogin = async (values: { username: string; password: string }) => {
        setLoading(true);
        try {
            const res = await authenticate(values.username, values.password);
            if (!res.ok) {
                if (res.code === 2) {
                    setUserEmail(values.username);
                    message.warning('Tài khoản chưa kích hoạt. Vui lòng nhập mã xác thực.');
                    await sendRequest({ url: `${backendUrl}/api/v1/auth/retry-active`, method: 'POST', body: { email: values.username } });
                    setView('verify');
                } else {
                    message.error('Email hoặc mật khẩu không đúng');
                }
            } else {
                message.success('Đăng nhập thành công!');
                handleClose();
                // Reload to update session — Header sẽ hiển thị theo role
                window.location.reload();
            }
        } catch {
            message.error('Đã có lỗi xảy ra');
        }
        setLoading(false);
    };

    // ===== REGISTER =====
    const handleRegister = async (values: { name: string; email: string; password: string }) => {
        setLoading(true);
        try {
            const res = await sendRequest<IBackendRes<{ _id: string }>>({
                url: `${backendUrl}/api/v1/auth/register`,
                method: 'POST',
                body: values,
            });
            if (res?.data) {
                setUserId(res.data._id);
                setUserEmail(values.email);
                message.success('Đăng ký thành công! Kiểm tra email để lấy mã xác thực.');
                setView('verify');
            } else {
                message.error(res?.message || 'Đăng ký thất bại');
            }
        } catch {
            message.error('Đã có lỗi xảy ra');
        }
        setLoading(false);
    };

    // ===== VERIFY CODE =====
    const handleVerify = async (values: { code: string }) => {
        setLoading(true);
        try {
            const res = await sendRequest<IBackendRes<any>>({
                url: `${backendUrl}/api/v1/auth/check-code`,
                method: 'POST',
                body: { accountRef: userId, code: values.code },
            });
            if (res?.data || res?.statusCode === 201) {
                message.success('Kích hoạt thành công! Vui lòng đăng nhập.');
                setView('login');
            } else {
                message.error(res?.message || 'Mã xác thực không đúng');
            }
        } catch {
            message.error('Đã có lỗi xảy ra');
        }
        setLoading(false);
    };

    // ===== FORGOT PASSWORD =====
    const handleForgot = async (values: { email: string }) => {
        setLoading(true);
        try {
            const res = await sendRequest<IBackendRes<{ _id: string }>>({
                url: `${backendUrl}/api/v1/auth/forgot-password`,
                method: 'POST',
                body: { email: values.email },
            });
            if (res?.data || res?.statusCode === 201) {
                setUserId(res?.data?._id || '');
                setUserEmail(values.email);
                message.success('Mã xác nhận đã gửi vào email.');
                setView('reset');
            } else {
                message.error(res?.message || 'Không tìm thấy tài khoản');
            }
        } catch {
            message.error('Đã có lỗi xảy ra');
        }
        setLoading(false);
    };

    // ===== RESET PASSWORD =====
    const handleReset = async (values: { code: string; password: string }) => {
        setLoading(true);
        try {
            const res = await sendRequest<IBackendRes<any>>({
                url: `${backendUrl}/api/v1/auth/change-password`,
                method: 'POST',
                body: { accountRef: userId, code: values.code, password: values.password },
            });
            if (res?.data || res?.statusCode === 201) {
                message.success('Đổi mật khẩu thành công!');
                setView('login');
            } else {
                message.error(res?.message || 'Mã xác thực không đúng');
            }
        } catch {
            message.error('Đã có lỗi xảy ra');
        }
        setLoading(false);
    };

    const getTitle = () => {
        switch (view) {
            case 'login': return 'Chào mừng trở lại';
            case 'register': return 'Tạo tài khoản';
            case 'verify': return 'Xác thực email';
            case 'forgot': return 'Quên mật khẩu';
            case 'reset': return 'Đặt lại mật khẩu';
        }
    };

    const getSubtitle = () => {
        switch (view) {
            case 'login': return 'Đăng nhập để tiếp tục sử dụng dịch vụ';
            case 'register': return 'Đăng ký miễn phí để trải nghiệm';
            case 'verify': return `Nhập mã 6 số đã gửi đến ${userEmail}`;
            case 'forgot': return 'Nhập email để nhận mã đặt lại';
            case 'reset': return 'Tạo mật khẩu mới cho tài khoản';
        }
    };

    const getIcon = () => {
        switch (view) {
            case 'login': return '👋';
            case 'register': return '🚀';
            case 'verify': return '🔐';
            case 'forgot': return '📧';
            case 'reset': return '🔑';
        }
    };

    return (
        <>
            <style>{`
                .auth-modal .ant-modal-content {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .auth-modal .ant-modal-close {
                    top: 16px;
                    right: 16px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.06);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .auth-modal .ant-modal-close:hover {
                    background: rgba(255,255,255,0.12);
                }
                .auth-modal .ant-modal-body {
                    padding: 0 !important;
                }
                .auth-modal-inner {
                    background: linear-gradient(160deg, #0c1524 0%, #111d32 50%, #0f172a 100%);
                    border: none;
                    border-radius: 20px;
                    padding: 44px 40px 36px;
                    position: relative;
                    overflow: hidden;
                }
                .auth-modal-inner::before {
                    content: '';
                    position: absolute;
                    top: -80px;
                    right: -80px;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
                    pointer-events: none;
                }
                .auth-modal-inner::after {
                    content: '';
                    position: absolute;
                    bottom: -60px;
                    left: -60px;
                    width: 180px;
                    height: 180px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
                    pointer-events: none;
                }
                .auth-input .ant-input,
                .auth-input .ant-input-password .ant-input {
                    background: rgba(15, 23, 42, 0.8) !important;
                    border: 1px solid rgba(99, 102, 241, 0.15) !important;
                    color: #e2e8f0 !important;
                    border-radius: 14px !important;
                    height: 52px !important;
                    font-size: 15px !important;
                    padding-left: 16px !important;
                    transition: all 0.25s ease !important;
                }
                .auth-input .ant-input:focus,
                .auth-input .ant-input-password:focus-within .ant-input {
                    border-color: rgba(99, 102, 241, 0.5) !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08), 0 0 20px rgba(99, 102, 241, 0.05) !important;
                }
                .auth-input .ant-input::placeholder {
                    color: #475569 !important;
                }
                .auth-input .ant-input-password {
                    background: rgba(15, 23, 42, 0.8) !important;
                    border: 1px solid rgba(99, 102, 241, 0.15) !important;
                    border-radius: 14px !important;
                    padding-right: 14px !important;
                    transition: all 0.25s ease !important;
                }
                .auth-input .ant-input-password:focus-within {
                    border-color: rgba(99, 102, 241, 0.5) !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08) !important;
                }
                .auth-input .ant-input-prefix {
                    margin-right: 12px;
                    color: #6366f1;
                    font-size: 16px;
                }
                .auth-input .ant-input-suffix {
                    color: #64748b;
                }
                .auth-input .ant-form-item-label > label {
                    color: #94a3b8 !important;
                    font-weight: 500 !important;
                    font-size: 13px !important;
                    letter-spacing: 0.3px;
                }
                .auth-btn-submit {
                    height: 52px !important;
                    border-radius: 14px !important;
                    border: none !important;
                    font-weight: 700 !important;
                    font-size: 16px !important;
                    letter-spacing: 0.5px;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%) !important;
                    box-shadow: 0 8px 32px -4px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255,255,255,0.1) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .auth-btn-submit:hover {
                    transform: translateY(-1px) !important;
                    box-shadow: 0 12px 40px -4px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255,255,255,0.15) !important;
                }
                .auth-btn-submit:active {
                    transform: translateY(0) !important;
                }
            `}</style>

            <Modal
                open={open}
                onCancel={handleClose}
                footer={null}
                centered
                width={440}
                className="auth-modal"
                closeIcon={<span style={{ color: '#64748b', fontSize: 16 }}>✕</span>}
                styles={{
                    mask: {
                        backdropFilter: 'blur(12px)',
                        background: 'rgba(0, 0, 0, 0.65)',
                    },
                }}
            >
                <div className="auth-modal-inner">
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: 44, marginBottom: 12, lineHeight: 1 }}>
                            {getIcon()}
                        </div>
                        <h2 style={{
                            color: '#f1f5f9',
                            fontSize: 26,
                            fontWeight: 800,
                            margin: '0 0 8px',
                            letterSpacing: '-0.5px',
                            lineHeight: 1.2,
                        }}>
                            {getTitle()}
                        </h2>
                        <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
                            {getSubtitle()}
                        </Text>
                    </div>

                    {/* ===== LOGIN VIEW ===== */}
                    {view === 'login' && (
                        <div className="auth-input" style={{ position: 'relative', zIndex: 1 }}>
                            <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large" requiredMark={false}>
                                <Form.Item
                                    name="username"
                                    label="Email"
                                    rules={[{ required: true, message: 'Vui lòng nhập email' }]}
                                >
                                    <Input
                                        prefix={<MailOutlined />}
                                        placeholder="email@example.com"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    label="Mật khẩu"
                                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder="Nhập mật khẩu"
                                        iconRender={(visible) => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    />
                                </Form.Item>
                                <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 20 }}>
                                    <Button
                                        type="link"
                                        onClick={() => setView('forgot')}
                                        style={{ color: '#818cf8', padding: 0, fontWeight: 600, fontSize: 13 }}
                                    >
                                        Quên mật khẩu?
                                    </Button>
                                </div>
                                <Form.Item style={{ marginBottom: 0 }}>
                                    <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn-submit">
                                        Đăng nhập
                                    </Button>
                                </Form.Item>
                            </Form>
                            <Divider style={{ borderColor: 'rgba(99, 102, 241, 0.1)', margin: '28px 0 20px' }}>
                                <Text style={{ color: '#334155', fontSize: 12, letterSpacing: 1.5, fontWeight: 600 }}>HOẶC</Text>
                            </Divider>
                            <div style={{ textAlign: 'center' }}>
                                <Text style={{ color: '#64748b', fontSize: 14 }}>Chưa có tài khoản? </Text>
                                <Button
                                    type="link"
                                    onClick={() => { setView('register'); loginForm.resetFields(); }}
                                    style={{ color: '#a78bfa', fontWeight: 700, padding: 0, fontSize: 14 }}
                                >
                                    Đăng ký miễn phí
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ===== REGISTER VIEW ===== */}
                    {view === 'register' && (
                        <div className="auth-input" style={{ position: 'relative', zIndex: 1 }}>
                            <Form form={registerForm} onFinish={handleRegister} layout="vertical" size="large" requiredMark={false}>
                                <Form.Item
                                    name="name"
                                    label="Họ và tên"
                                    rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                                >
                                    <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" />
                                </Form.Item>
                                <Form.Item
                                    name="email"
                                    label="Email"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập email' },
                                        { type: 'email', message: 'Email không đúng định dạng' },
                                    ]}
                                >
                                    <Input prefix={<MailOutlined />} placeholder="email@example.com" />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    label="Mật khẩu"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập mật khẩu' },
                                        { min: 6, message: 'Tối thiểu 6 ký tự' },
                                    ]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder="Tối thiểu 6 ký tự"
                                        iconRender={(visible) => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="confirmPassword"
                                    label="Xác nhận mật khẩu"
                                    dependencies={['password']}
                                    rules={[
                                        { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                                        ({ getFieldValue }) => ({
                                            validator(_, value) {
                                                if (!value || getFieldValue('password') === value) return Promise.resolve();
                                                return Promise.reject(new Error('Mật khẩu không khớp'));
                                            },
                                        }),
                                    ]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder="Nhập lại mật khẩu"
                                        iconRender={(visible) => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 0 }}>
                                    <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn-submit">
                                        Tạo tài khoản
                                    </Button>
                                </Form.Item>
                            </Form>
                            <Divider style={{ borderColor: 'rgba(99, 102, 241, 0.1)', margin: '28px 0 20px' }}>
                                <Text style={{ color: '#334155', fontSize: 12, letterSpacing: 1.5, fontWeight: 600 }}>HOẶC</Text>
                            </Divider>
                            <div style={{ textAlign: 'center' }}>
                                <Text style={{ color: '#64748b', fontSize: 14 }}>Đã có tài khoản? </Text>
                                <Button
                                    type="link"
                                    onClick={() => { setView('login'); registerForm.resetFields(); }}
                                    style={{ color: '#a78bfa', fontWeight: 700, padding: 0, fontSize: 14 }}
                                >
                                    Đăng nhập
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ===== VERIFY VIEW ===== */}
                    {view === 'verify' && (
                        <div className="auth-input" style={{ position: 'relative', zIndex: 1 }}>
                            <Form form={verifyForm} onFinish={handleVerify} layout="vertical" size="large" requiredMark={false}>
                                <Form.Item
                                    name="code"
                                    label="Mã xác thực"
                                    rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
                                >
                                    <Input
                                        prefix={<SafetyCertificateOutlined />}
                                        placeholder="Nhập mã từ email"
                                        maxLength={10}
                                        style={{ textAlign: 'center', letterSpacing: 4, fontSize: 18, fontWeight: 700 }}
                                    />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 16 }}>
                                    <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn-submit">
                                        Xác thực
                                    </Button>
                                </Form.Item>
                            </Form>
                            <div style={{ textAlign: 'center' }}>
                                <Button
                                    type="link"
                                    onClick={() => setView('login')}
                                    icon={<ArrowLeftOutlined />}
                                    style={{ color: '#818cf8', fontWeight: 600, fontSize: 13 }}
                                >
                                    Quay lại đăng nhập
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ===== FORGOT PASSWORD VIEW ===== */}
                    {view === 'forgot' && (
                        <div className="auth-input" style={{ position: 'relative', zIndex: 1 }}>
                            <Form form={forgotForm} onFinish={handleForgot} layout="vertical" size="large" requiredMark={false}>
                                <Form.Item
                                    name="email"
                                    label="Email đã đăng ký"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập email' },
                                        { type: 'email', message: 'Email không đúng định dạng' },
                                    ]}
                                >
                                    <Input prefix={<MailOutlined />} placeholder="email@example.com" />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 16 }}>
                                    <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn-submit">
                                        Gửi mã xác nhận
                                    </Button>
                                </Form.Item>
                            </Form>
                            <div style={{ textAlign: 'center' }}>
                                <Button
                                    type="link"
                                    onClick={() => setView('login')}
                                    icon={<ArrowLeftOutlined />}
                                    style={{ color: '#818cf8', fontWeight: 600, fontSize: 13 }}
                                >
                                    Quay lại đăng nhập
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ===== RESET PASSWORD VIEW ===== */}
                    {view === 'reset' && (
                        <div className="auth-input" style={{ position: 'relative', zIndex: 1 }}>
                            <Form form={resetForm} onFinish={handleReset} layout="vertical" size="large" requiredMark={false}>
                                <Form.Item
                                    name="code"
                                    label="Mã xác nhận"
                                    rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
                                >
                                    <Input
                                        prefix={<SafetyCertificateOutlined />}
                                        placeholder="Nhập mã từ email"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    label="Mật khẩu mới"
                                    rules={[
                                        { required: true, message: 'Vui lòng nhập mật khẩu' },
                                        { min: 6, message: 'Tối thiểu 6 ký tự' },
                                    ]}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        placeholder="Tối thiểu 6 ký tự"
                                        iconRender={(visible) => visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                    />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 16 }}>
                                    <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn-submit">
                                        Đặt lại mật khẩu
                                    </Button>
                                </Form.Item>
                            </Form>
                            <div style={{ textAlign: 'center' }}>
                                <Button
                                    type="link"
                                    onClick={() => setView('login')}
                                    icon={<ArrowLeftOutlined />}
                                    style={{ color: '#818cf8', fontWeight: 600, fontSize: 13 }}
                                >
                                    Quay lại đăng nhập
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}
