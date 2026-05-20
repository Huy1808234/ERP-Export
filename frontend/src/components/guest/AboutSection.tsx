"use client";

import React from "react";
import { Row, Col, Typography, Button, Space, Card } from "antd";
import { CheckCircleOutlined, GlobalOutlined, TeamOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import PageBanner from "./PageBanner";

const { Title, Paragraph, Text } = Typography;

export function AboutSection() {
  return (
    <div id="about" style={{ background: "#000814", position: "relative" }}>
      <PageBanner 
        title="CHÚNG TÔI ĐỊNH NGHĨA LẠI LOGISTICS"
        subtitle="VinaExport là đơn vị tiên phong trong việc ứng dụng công nghệ số vào quy trình vận tải quốc tế. Chúng tôi cam kết mang lại giải pháp tối ưu nhất cho doanh nghiệp Việt vươn ra thế giới."
        height="400px"
        offset={false}
        imageUrl="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=2500"
      />

      <div style={{ padding: '120px 60px', position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <Row gutter={[80, 64]} align="middle">
            {/* Image side */}
            <Col xs={24} lg={12}>
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                style={{ position: 'relative' }}
              >
                <img 
                  src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=1200" 
                  alt="About VinaExport"
                  style={{ 
                    width: '100%', 
                    borderRadius: '32px', 
                    boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
                <Card 
                  variant="borderless"
                  style={{ 
                    position: 'absolute', 
                    bottom: '-40px', 
                    right: '30px', 
                    width: '240px', 
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                    boxShadow: '0 20px 40px rgba(24, 144, 255, 0.4)'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 900 }}>15+</Title>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>NĂM KINH NGHIỆM</Text>
                  </div>
                </Card>
              </motion.div>
            </Col>

            {/* Text side */}
            <Col xs={24} lg={12}>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <Title level={2} style={{ color: "#fff", fontWeight: 900, fontSize: "42px", marginBottom: "32px", letterSpacing: "-1px" }}>
                  Tại sao chọn VinaExport?
                </Title>
                
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                  {[
                    { 
                      icon: <GlobalOutlined />, 
                      title: "Mạng lưới đại lý toàn cầu",
                      desc: "Hợp tác với hơn 200 quốc gia, đảm bảo hàng hóa đi khắp thế giới." 
                    },
                    { 
                      icon: <TeamOutlined />, 
                      title: "Đội ngũ chuyên gia 24/7",
                      desc: "Hỗ trợ tận tâm, giải quyết mọi vấn đề thủ tục nhanh chóng." 
                    },
                    { 
                      icon: <CheckCircleOutlined />, 
                      title: "An toàn tuyệt đối",
                      desc: "Quy trình kiểm soát chất lượng nghiêm ngặt cho từng kiện hàng." 
                    }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                      <div style={{ 
                        color: '#1890ff', 
                        fontSize: '28px',
                        width: '56px',
                        height: '56px',
                        background: 'rgba(24, 144, 255, 0.1)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>{item.icon}</div>
                      <div>
                        <Title level={4} style={{ color: "#fff", margin: "0 0 8px 0", fontWeight: 800 }}>{item.title}</Title>
                        <Paragraph style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", margin: 0 }}>{item.desc}</Paragraph>
                      </div>
                    </div>
                  ))}

                  <Button 
                    type="primary" 
                    size="large" 
                    style={{ 
                      marginTop: '24px', 
                      height: '56px', 
                      padding: '0 48px', 
                      borderRadius: '14px', 
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                      border: 'none',
                      boxShadow: '0 10px 20px rgba(24, 144, 255, 0.2)'
                    }}
                  >
                    KHÁM PHÁ NGAY
                  </Button>
                </Space>
              </motion.div>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
}
