"use client";

import React from "react";
import { Row, Col, Card, Typography, Button, Space, theme } from "antd";
import { 
  RocketOutlined, 
  GlobalOutlined, 
  SafetyCertificateOutlined,
  ContainerOutlined,
  ArrowRightOutlined
} from "@ant-design/icons";
import { motion } from "framer-motion";
import PageBanner from "./PageBanner";

const { Title, Text, Paragraph } = Typography;

const services = [
  {
    icon: <GlobalOutlined style={{ fontSize: "32px", color: "#1890ff" }} />,
    title: "Vận tải Đa phương thức",
    description: "Kết nối đường biển, đường hàng không và đường bộ để tối ưu hóa thời gian và chi phí vận chuyển toàn cầu.",
    bg: "rgba(24, 144, 255, 0.1)"
  },
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: "32px", color: "#22c55e" }} />,
    title: "Ủy thác Xuất nhập khẩu",
    description: "Dịch vụ trọn gói từ tìm kiếm nguồn hàng, đàm phán hợp đồng đến thực hiện các thủ tục hải quan phức tạp.",
    bg: "rgba(34, 197, 94, 0.1)"
  },
  {
    icon: <ContainerOutlined style={{ fontSize: "32px", color: "#f59e0b" }} />,
    title: "Quản lý Kho bãi & WMS",
    description: "Hệ thống kho bãi hiện đại cùng phần mềm quản lý thông minh giúp kiểm soát hàng hóa theo thời gian thực.",
    bg: "rgba(245, 158, 11, 0.1)"
  },
  {
    icon: <RocketOutlined style={{ fontSize: "32px", color: "#ef4444" }} />,
    title: "Logistics 4.0",
    description: "Ứng dụng AI và Blockchain trong theo dõi đơn hàng, đảm bảo tính minh bạch và an toàn tuyệt đối.",
    bg: "rgba(239, 68, 68, 0.1)"
  }
];

const ServicesSection = () => {
  return (
    <div id="services" style={{ 
      background: "linear-gradient(180deg, #000814 0%, #001d3d 100%)", 
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Decorative Grid Background */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: "radial-gradient(rgba(24, 144, 255, 0.1) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        zIndex: 1
      }} />

      <PageBanner 
        title="Giải pháp Logistics"
        subtitle="Chúng tôi không chỉ vận chuyển hàng hóa, chúng tôi xây dựng mạng lưới kết nối tương lai cho doanh nghiệp của bạn."
        imageUrl="https://images.unsplash.com/photo-1494412574358-a19b5a443f39?auto=format&fit=crop&q=80&w=2500"
        height="400px"
        offset={false}
      />
      
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "100px 60px", position: "relative", zIndex: 10 }}>
        <Row gutter={[32, 32]}>
          {services.map((service, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card
                  variant="borderless"
                  style={{ 
                    height: "100%", 
                    borderRadius: "32px",
                    textAlign: "left",
                    padding: "24px",
                    background: "rgba(255, 255, 255, 1)",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                    transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                  }}
                  className="service-card"
                >
                  <div style={{ 
                    width: "72px", 
                    height: "72px", 
                    borderRadius: "20px", 
                    background: service.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "32px"
                  }}>
                    {service.icon}
                  </div>
                  
                  <Title level={4} style={{ marginBottom: "16px", fontWeight: 900, color: "#001d3d" }}>
                    {service.title}
                  </Title>
                  
                  <Paragraph style={{ color: "#475569", fontSize: "15px", lineHeight: 1.7, marginBottom: "32px" }}>
                    {service.description}
                  </Paragraph>
                  
                  <Button 
                    type="link" 
                    style={{ 
                      padding: 0, 
                      fontWeight: 800, 
                      color: "#1890ff",
                      fontSize: "14px"
                    }}
                  >
                    TÌM HIỂU THÊM <ArrowRightOutlined style={{ marginLeft: "8px" }} />
                  </Button>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </div>

      <style jsx global>{`
        .service-card:hover {
          transform: translateY(-15px) scale(1.02);
          box-shadow: 0 30px 60px rgba(24, 144, 255, 0.15);
        }
      `}</style>
    </div>
  );
};

export default ServicesSection;
