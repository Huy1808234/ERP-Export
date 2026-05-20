'use client'
import React, { useState } from 'react';
import { Button, Divider, Form, Input } from 'antd';
import { notification } from '@/providers/antd-static';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useRouter } from "@/i18n/routing";
import { sendRequest } from '@/lib/api-client';

const Verify = ({ id }: { id: string }) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values: { code: string }) => {
        setLoading(true);
        const res = await sendRequest<IBackendRes<any>>({
            method: "POST",
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/check-code`,
            body: { accountRef: id, code: values.code }
        })
        setLoading(false);
        if (res?.data) {
            notification.success({ title: "Kích hoạt thành công" });
            router.push(`/auth/login`)
        } else {
            notification.error({
                title: "Kích hoạt thất bại",
                description: res?.message,
            });
        }
    };

    return (

    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)",
      padding: "20px"
    }}>
      {/* Background Glows */}
      <div style={{
        position: "fixed", top: "20%", left: "30%", width: "400px", height: "400px",
        background: "rgba(16, 185, 129, 0.15)", filter: "blur(100px)", borderRadius: "50%", zIndex: 0
      }} />
      <div style={{
        position: "fixed", bottom: "20%", right: "30%", width: "400px", height: "400px",
        background: "rgba(6, 182, 212, 0.15)", filter: "blur(100px)", borderRadius: "50%", zIndex: 0
      }} />

      <div style={{ width: "100%", maxWidth: "450px", position: "relative", zIndex: 1 }}>
        <div style={{
          background: "rgba(30, 41, 59, 0.5)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "24px",
          padding: "40px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: "32px", fontWeight: 700,
              background: "linear-gradient(to right, #34d399, #22d3ee)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 8px 0"
            }}>
              Kích hoạt
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "15px", margin: 0 }}>
              Nhập mã kích hoạt đã được gửi đến email của bạn
            </p>
          </div>
          
          <Form
            name="verify"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
          >
            <Form.Item
              label={<span style={{ color: "#e2e8f0" }}>Mã kích hoạt</span>}
              name="code"
              rules={[{ required: true, message: "Vui lòng nhập mã kích hoạt!" }]}
            >
              <Input
                placeholder="123456"
                style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "12px" }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  border: "none", fontWeight: 600, fontSize: "16px", boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.3)"
                }}
              >
                Kích hoạt tài khoản
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <Link href="/" style={{ color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <ArrowLeftOutlined style={{ fontSize: "12px" }} /> Quay lại trang chủ
            </Link>
          </div>

        </div>
      </div>
    </div>

    )
}

export default Verify;
