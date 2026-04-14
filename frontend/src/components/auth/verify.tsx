'use client'
import React from 'react';
import { Button, Col, Divider, Form, Input, message, notification, Row } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { sendRequest } from '@/utils/api';
import { useRouter } from 'next/navigation';

const Verify = (props: any) => {
    const { id } = props;
    const router = useRouter();

    const onFinish = async (values: any) => {
        const { _id, code } = values;
        console.log("values: ", values);
        const res = await sendRequest<IBackendRes<any>>({
            method: "POST",
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/check-code`,
            body: { _id, code }
        })
        console.log("res: ", res);
        if (res?.data) {
            notification.success({
                title: "Kích hoạt tài khoản thành công",
                description: "Bạn đã kích hoạt tài khoản thành công. Vui lòng đăng nhập.",
            })
            router.push('/auth/login')
        } else {
            notification.error({
                title: "Verify thất bại",
                description: res?.message,
            });
        }
    };

    return (
        <Row justify={"center"} style={{ marginTop: "30px" }}>
            <Col xs={24} md={16} lg={8}>
                <fieldset style={{
                    padding: "15px",
                    margin: "5px",
                    border: "1px solid #ccc",
                    borderRadius: "5px"
                }}>
                    <legend>Kích Hoạt Tài Khoản</legend>
                    <Form
                        name="basic"
                        onFinish={onFinish}
                        autoComplete="off"
                        layout='vertical'
                    >
                        <Form.Item
                            label="Id"
                            name="_id"
                            initialValue={id}
                            hidden
                        >
                            <Input disabled />
                        </Form.Item>
                        <div>
                            Mã Code đã được gửi đến email đăng kí vui lòng kiểm tra email
                        </div>
                        <Divider />
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
                            <Input.Password />
                        </Form.Item>
                        <Form.Item
                        >
                            <Button type="primary" htmlType="submit">
                                Submit
                            </Button>
                        </Form.Item>
                    </Form>
                    <Link href={"/"}><ArrowLeftOutlined /> Quay lại trang chủ</Link>
                    <Divider />
                    <div style={{ textAlign: "center" }}>
                        Đã có tài khoản? <Link href={"/auth/login"}>Đăng nhập</Link>
                    </div>

                </fieldset>
            </Col>
        </Row>

    )
}


export default Verify