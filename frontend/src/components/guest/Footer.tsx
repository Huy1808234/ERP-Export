"use client";

import React from "react";
import { Layout, Row, Col, Typography, Space, Divider } from "antd";
import { 
  FacebookOutlined, 
  TwitterOutlined, 
  LinkedinOutlined, 
  InstagramOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  GlobalOutlined
} from "@ant-design/icons";
import Link from "next/link";

const { Footer: AntFooter } = Layout;
const { Title, Text, Paragraph } = Typography;

export function Footer() {
  return (
    <AntFooter style={{ background: '#001529', padding: '80px 50px 40px', color: 'rgba(255,255,255,0.45)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Row gutter={[48, 48]}>
          {/* Brand & Social */}
          <Col xs={24} md={8}>
            <Space orientation="vertical" size="large">
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <GlobalOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 900 }}>VINAEXPORT</Title>
              </Link>
              <Paragraph style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '280px' }}>
                Tiên phong trong giải pháp vận tải số hóa. Kết nối giao thương toàn cầu với sự tận tâm và chuyên nghiệp tuyệt đối.
              </Paragraph>
              <Space size="middle" style={{ fontSize: '24px' }}>
                <FacebookOutlined style={{ cursor: 'pointer', color: 'inherit' }} />
                <TwitterOutlined style={{ cursor: 'pointer', color: 'inherit' }} />
                <LinkedinOutlined style={{ cursor: 'pointer', color: 'inherit' }} />
                <InstagramOutlined style={{ cursor: 'pointer', color: 'inherit' }} />
              </Space>
            </Space>
          </Col>

          {/* Quick Links */}
          <Col xs={12} md={4}>
            <Title level={5} style={{ color: '#fff', marginBottom: '24px' }}>DỊCH VỤ</Title>
            <Space orientation="vertical">
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>Vận tải hàng không</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>Vận tải đường biển</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>Vận tải đường bộ</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>Kho bãi & Lưu trữ</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>Danh mục sản phẩm</Text>
            </Space>
          </Col>

          {/* About Links */}
          <Col xs={12} md={4}>
            <Title level={5} style={{ color: '#fff', marginBottom: '24px' }}>VỀ CHÚNG TÔI</Title>
            <Space orientation="vertical">
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>Câu chuyện thương hiệu</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>Đội ngũ chuyên gia</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }} onClick={() => document.getElementById('tracking')?.scrollIntoView({ behavior: 'smooth' })}>Tra cứu vận đơn</Text>
              <Text style={{ color: 'inherit', cursor: 'pointer' }}>Liên hệ</Text>
            </Space>
          </Col>

          {/* Contact Info */}
          <Col xs={24} md={8}>
            <Title level={5} style={{ color: '#fff', marginBottom: '24px' }}>LIÊN HỆ</Title>
            <Space orientation="vertical" size="middle">
              <div style={{ display: 'flex', gap: '12px' }}>
                <EnvironmentOutlined style={{ color: '#1890ff', marginTop: '4px' }} />
                <Text style={{ color: 'inherit' }}>123 Đại lộ Xuất Nhập Khẩu, Quận 1, TP. Hồ Chí Minh</Text>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <PhoneOutlined style={{ color: '#1890ff', marginTop: '4px' }} />
                <Text style={{ color: 'inherit' }}>+84 123 456 789</Text>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <MailOutlined style={{ color: '#1890ff', marginTop: '4px' }} />
                <Text style={{ color: 'inherit' }}>contact@vinaexport.com</Text>
              </div>
            </Space>
          </Col>
        </Row>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '60px 0 30px' }} />

        <Row justify="space-between" align="middle">
          <Col>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              © 2024 VINAEXPORT LOGISTICS. ALL RIGHTS RESERVED.
            </Text>
          </Col>
          <Col>
            <Space size="large" style={{ fontSize: '12px' }}>
              <Text style={{ color: 'rgba(255,255,255,0.3)' }}>ĐIỀU KHOẢN</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)' }}>BẢO MẬT</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)' }}>SƠ ĐỒ TRANG</Text>
            </Space>
          </Col>
        </Row>
      </div>
    </AntFooter>
  );
};

export default Footer;
