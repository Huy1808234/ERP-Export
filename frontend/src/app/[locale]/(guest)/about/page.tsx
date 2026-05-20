'use client'
import React from 'react';
import { Row, Col, Typography, Card, Space, theme, Timeline, Statistic } from 'antd';
import PageBanner from '@/components/guest/PageBanner';
import { 
  SafetyCertificateOutlined, 
  GlobalOutlined, 
  RocketOutlined, 
  TeamOutlined,
  CheckCircleFilled,
  HistoryOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;

const AboutPage = () => {
  const { token } = theme.useToken();

  const coreValues = [
    {
      title: 'Minh Bạch',
      icon: <SafetyCertificateOutlined style={{ fontSize: '32px', color: '#10b981' }} />,
      desc: 'Hệ thống ERP thời gian thực giúp khách hàng tra cứu mọi chứng từ và công nợ một cách minh bạch nhất.'
    },
    {
      title: 'Toàn Cầu',
      icon: <GlobalOutlined style={{ fontSize: '32px', color: '#3b82f6' }} />,
      desc: 'Mạng lưới đối tác vận tải phủ rộng khắp các châu lục EU, US, và khu vực ASEAN.'
    },
    {
      title: 'Tốc Độ',
      icon: <RocketOutlined style={{ fontSize: '32px', color: '#f59e0b' }} />,
      desc: 'Quy trình xử lý hồ sơ hải quan và đóng gói hàng hóa tối ưu, đảm bảo ETD luôn đúng hạn.'
    }
  ];

  return (
    <div style={{ background: '#fff' }}>
      <PageBanner 
        title="Năng Lực Xuất Khẩu Việt Nam"
        subtitle="VinaExport không chỉ là một doanh nghiệp thương mại, chúng tôi là đối tác cung ứng chiến lược với nền tảng công nghệ quản trị hiện đại."
        breadcrumbs={[{ title: 'Giới thiệu' }]}
      >
        <Row gutter={[48, 48]} style={{ marginTop: '40px' }}>
          <Col xs={12} md={6}>
            <Statistic value={15} suffix="+" title={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Quốc gia xuất khẩu</Text>} styles={{ content: { color: '#fff', fontWeight: 800 } }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic value={500} suffix="+" title={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Lô hàng/năm</Text>} styles={{ content: { color: '#fff', fontWeight: 800 } }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic value={98} suffix="%" title={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Đúng hạn (On-time)</Text>} styles={{ content: { color: '#fff', fontWeight: 800 } }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic value={100} suffix="%" title={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Chứng từ minh bạch</Text>} styles={{ content: { color: '#fff', fontWeight: 800 } }} />
          </Col>
        </Row>
      </PageBanner>

      {/* Services Section */}
      <div style={{ padding: '100px 0' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <Row gutter={[60, 60]} align="middle">
            <Col xs={24} lg={12}>
              <Title level={2}>Dịch Vụ Logistics Trọn Gói</Title>
              <Paragraph style={{ fontSize: '16px', color: '#475569' }}>
                Chúng tôi cung cấp giải pháp End-to-End từ khâu thu mua, kiểm định chất lượng, đóng gói container đến thông quan hải quan và vận tải quốc tế.
              </Paragraph>
              <Space orientation="vertical" size="middle" style={{ marginTop: '24px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <CheckCircleFilled style={{ color: '#3b82f6', fontSize: '20px', marginTop: '4px' }} />
                  <div>
                    <Text strong>Quản lý Chuỗi cung ứng</Text>
                    <br /><Text type="secondary">Tối ưu hóa chi phí vận hành và lưu kho cho đối tác B2B.</Text>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <CheckCircleFilled style={{ color: '#3b82f6', fontSize: '20px', marginTop: '4px' }} />
                  <div>
                    <Text strong>Khai báo Hải quan & Chứng từ</Text>
                    <br /><Text type="secondary">Chuyên gia về C/O, Phytosanitary, Health Certificate cho từng thị trường khó tính.</Text>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <CheckCircleFilled style={{ color: '#3b82f6', fontSize: '20px', marginTop: '4px' }} />
                  <div>
                    <Text strong>Theo dõi hành trình thời gian thực</Text>
                    <br /><Text type="secondary">Cập nhật trạng thái tàu biển trực tiếp lên Portal khách hàng.</Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col xs={24} lg={12}>
              <div style={{ position: 'relative' }}>
                <img 
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1000" 
                  alt="Logistics" 
                  style={{ width: '100%', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                />
                <div style={{ 
                  position: 'absolute', 
                  bottom: '-30px', 
                  right: '-30px', 
                  background: '#fff', 
                  padding: '32px', 
                  borderRadius: '24px', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <HistoryOutlined style={{ fontSize: '40px', color: '#3b82f6' }} />
                  <div>
                    <Text strong style={{ fontSize: '24px' }}>10+ Năm</Text>
                    <br /><Text type="secondary">Kinh nghiệm vận tải</Text>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Values */}
      <div style={{ padding: '80px 0', background: '#f8fafc' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: '60px' }}>Giá Trị Cốt Lõi</Title>
          <Row gutter={[32, 32]}>
            {coreValues.map(val => (
              <Col xs={24} md={8} key={val.title}>
                <Card bordered={false} style={{ height: '100%', borderRadius: '16px', textAlign: 'center', padding: '24px' }}>
                  <div style={{ marginBottom: '24px' }}>{val.icon}</div>
                  <Title level={4}>{val.title}</Title>
                  <Text type="secondary">{val.desc}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
