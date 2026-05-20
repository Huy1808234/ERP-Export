'use client'
import React, { useState } from 'react';
import { Button, Divider, Form, Input, Row, Col, Select } from 'antd';
import { notification } from '@/providers/antd-static';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { sendRequest } from '@/lib/api-client';

const Register = () => {
    const t = useTranslations("Auth.register");
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values: any) => {
        setLoading(true);
        const res = await sendRequest<IBackendRes<{ _id: string }>>({
            method: "POST",
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/register`,
            body: {
                name: values.name,
                email: values.email,
                password: values.password,
                // Gửi thêm các thông tin B2B nếu backend đã hỗ trợ hoặc lưu vào metadata
                phone: values.phone,
                address: `${values.companyName}, ${values.country}`
            }
        })
        setLoading(false);
        if (res?.data) {
            router.push(`/auth/verify/${res?.data?._id}`)
        } else {
            notification.error({
                title: "Đăng ký thất bại",
                description: res?.message || "Có lỗi xảy ra, vui lòng thử lại sau.",
            });
        }
    };

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        padding: "40px 20px"
      }}>
        <div style={{ width: "100%", maxWidth: "900px", position: "relative", zIndex: 1 }}>
          <div style={{
            background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "24px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", overflow: "hidden"
          }}>
            <Row>
              <Col xs={0} md={10} style={{ 
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                padding: "48px",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
              }}>
                <h2 style={{ color: "#fff", fontSize: "32px", fontWeight: 700, marginBottom: "24px" }}>
                  Đối Tác Chiến Lược
                </h2>
                <p style={{ fontSize: "16px", lineHeight: "1.6", opacity: 0.9 }}>
                  Gia nhập hệ thống B2B của VinaExport để tiếp cận nguồn hàng ổn định và quy trình xuất khẩu minh bạch.
                </p>
                <ul style={{ marginTop: "32px", padding: 0, listStyle: "none" }}>
                  <li style={{ marginBottom: "16px" }}>✓ Quản lý đơn hàng 24/7</li>
                  <li style={{ marginBottom: "16px" }}>✓ Tra cứu công nợ tự động</li>
                  <li style={{ marginBottom: "16px" }}>✓ Chứng từ số hóa 100%</li>
                </ul>
              </Col>
              
              <Col xs={24} md={14} style={{ padding: "48px" }}>
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                  <h1 style={{ color: "#fff", fontSize: "28px", fontWeight: 700, margin: 0 }}>
                    {t("legend") || "Đăng Ký Đối Tác"}
                  </h1>
                </div>

                <Form
                  name="register"
                  onFinish={onFinish}
                  layout="vertical"
                  size="large"
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={<span style={{ color: "#e2e8f0" }}>Tên công ty</span>}
                        name="companyName"
                        rules={[{ required: true, message: "Vui lòng nhập tên công ty" }]}
                      >
                        <Input placeholder="Công ty ABC" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "8px" }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={<span style={{ color: "#e2e8f0" }}>Quốc gia</span>}
                        name="country"
                        rules={[{ required: true }]}
                      >
                        <Select placeholder="Chọn quốc gia" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "8px" }}>
                          <Select.Option value="VN">Việt Nam</Select.Option>
                          <Select.Option value="US">Hoa Kỳ</Select.Option>
                          <Select.Option value="EU">Châu Âu</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={<span style={{ color: "#e2e8f0" }}>{t("fields.name.label")}</span>}
                    name="name"
                    rules={[{ required: true, message: "Vui lòng nhập tên người liên hệ" }]}
                  >
                    <Input placeholder="Họ và tên" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "8px" }} />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={<span style={{ color: "#e2e8f0" }}>{t("fields.email.label")}</span>}
                        name="email"
                        rules={[{ required: true, type: 'email', message: "Email không hợp lệ" }]}
                      >
                        <Input placeholder="email@company.com" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "8px" }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={<span style={{ color: "#e2e8f0" }}>Số điện thoại</span>}
                        name="phone"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="+84 ..." style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "8px" }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={<span style={{ color: "#e2e8f0" }}>{t("fields.password.label")}</span>}
                    name="password"
                    rules={[{ required: true, message: t("fields.password.required") }]}
                  >
                    <Input.Password placeholder="••••••••" style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", borderRadius: "8px" }} />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      style={{
                        height: "50px", borderRadius: "12px", background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                        border: "none", fontWeight: 700, fontSize: "16px", marginTop: "10px"
                      }}
                    >
                      {t("submit") || "ĐĂNG KÝ NGAY"}
                    </Button>
                  </Form.Item>
                </Form>

                <div style={{ textAlign: "center", marginTop: "24px", color: "#94a3b8" }}>
                  <Link href="/" style={{ color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <ArrowLeftOutlined /> Quay lại trang chủ
                  </Link>
                  <Divider style={{ borderColor: "rgba(255, 255, 255, 0.1)" }} />
                  {t("hasAccount")}{" "}
                  <Link href="/auth/login" style={{ color: "#34d399", fontWeight: 600 }}>
                    {t("loginLink")}
                  </Link>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </div>
    );
};

export default Register;
