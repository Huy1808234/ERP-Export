'use client'
import { useEffect, useState } from 'react'
import { Modal, Steps, Button, Input, Form, notification } from 'antd'
import { useHasMounted } from '@/utils/customHook';
import { SmileOutlined, SolutionOutlined, UserOutlined } from '@ant-design/icons';
import { sendRequest } from '@/utils/api';
import { useFormState } from 'react-dom';

const ModalReactive = (props: any) => {
    // 1. Giải nén props chính xác (dùng useEmail từ props truyền vào)
    const { isModalOpen, setIsModalOpen, useEmail } = props;
    const [current, setCurrent] = useState(0);
    const hasMounted = useHasMounted();
    const [userId, setUserId] = useState('');
    // 2. Khởi tạo Form instance đúng cách
    const [form] = Form.useForm();

    // 3. Sử dụng đúng tên biến (useEmail, không phải userEmail)
    useEffect(() => {
        if (useEmail) {
            form.setFieldsValue({
                username: useEmail // Sử dụng một object với key là tên field (name="username")
            });
        }
    }, [useEmail, form]);

    if (!hasMounted) return <></>

    const onFinishStep0 = async (value: any) => {
        const { username } = value;
        const res = await sendRequest<IBackendRes<any>>({
            method: "POST",
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/retry-active`,
            body: { email: username }
        })
        if (res?.data) {
            setUserId(res?.data?._id)
            setCurrent(1);
        } else {
            notification.error({
                title: "Call APIs errot",
                description: res?.message,
            });
        }
    }

    const onFinishStep1 = async (value: any) => {
        const { code } = value;
        const res = await sendRequest<IBackendRes<any>>({
            method: "POST",
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/check-code`,
            body: { _id: userId, code: code }
        })
        if (res?.data) {
            setCurrent(2);
        } else {
            notification.error({
                title: "Call APIs errot",
                description: res?.message,
            });
        }
    }

    const resendCode = async () => {
        const res = await sendRequest<IBackendRes<any>>({
            method: "POST",
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/retry-active`,
            body: { email: useEmail }
        })
        if (res?.data) {
            notification.success({
                title: "Thành công",
                description: "Mã kích hoạt mới đã được gửi vào email của bạn.",
            });
        } else {
            notification.error({
                title: "Có lỗi xảy ra",
                description: res?.message,
            });
        }
    }
    return (
        <>
            <Modal
                title="Kích Hoạt Tài Khoản"
                open={isModalOpen}
                onOk={() => setIsModalOpen(false)}
                onCancel={() => setIsModalOpen(false)}
                mask={{ closable: false }}
                footer={null}
            >
                <Steps
                    current={current}
                    items={[
                        { title: 'Đăng nhập', icon: <UserOutlined /> },
                        { title: 'Xác minh', icon: <SolutionOutlined /> },
                        { title: 'Hoàn tất', icon: <SmileOutlined /> },
                    ]}
                />
                {current === 0 &&
                    <>
                        <div style={{ margin: '20px 0' }}>
                            <p>Tài khoản của bạn chưa được kích hoạt.</p>
                        </div>
                        <Form
                            name="verify"
                            onFinish={onFinishStep0}
                            autoComplete="off"
                            layout="vertical"
                            form={form}
                        >
                            <Form.Item
                                label="Email"
                                name="username"
                            >
                                <Input disabled />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit">
                                    Gửi lại mã
                                </Button>
                            </Form.Item>
                        </Form>
                    </>
                }
                {current === 1 &&
                    <>
                        <div style={{ margin: '20px 0' }}>
                            <p>Vui Lòng Nhập Mã Xác Nhận.</p>
                        </div>
                        <Form
                            name="verify2"
                            onFinish={onFinishStep1}
                            autoComplete="off"
                            layout="vertical"
                        >
                            <Form.Item
                                label="Code"
                                name="code"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Please input your code!',
                                    },
                                ]}
                            >
                                <Input />
                            </Form.Item>

                            <Form.Item>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <Button type="primary" htmlType="submit">
                                        Kích Hoạt
                                    </Button>
                                    <Button onClick={resendCode} htmlType="button">
                                        Gửi lại mã
                                    </Button>
                                </div>
                            </Form.Item>
                        </Form>
                    </>
                }
                {current === 2 &&
                    <div style={{ margin: '20px 0' }}>
                        <p>Tài khoản của bạn đã được kích hoạt thành công. Vui lòng đăng nhập lại.</p>
                        <Button
                            type="primary"
                            onClick={() => {
                                setIsModalOpen(false); // Đóng modal
                                setCurrent(0);        // Reset về bước đầu cho lần sau
                            }}
                        >
                            Đăng Nhập 
                        </Button>
                    </div>
                }
            </Modal>
        </>
    )
}

export default ModalReactive