"use client";

import React from "react";
import { Row, Col, Typography, Space } from "antd";
import { motion } from "framer-motion";
import { DatabaseOutlined, ClusterOutlined, SafetyCertificateOutlined } from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

import explodedViewImg from "../../../public/images/A_cinematic,_hyper-detailed_exploded_view_202606280142.jpeg";

const hotspots = [
  {
    top: "30%",
    left: "20%",
    icon: <DatabaseOutlined style={{ color: "#1890ff", fontSize: "20px" }} />,
    title: "Kho Dữ Liệu Phân Tán",
    desc: "Đồng bộ hóa realtime trên toàn bộ chuỗi cung ứng toàn cầu."
  },
  {
    top: "60%",
    left: "75%",
    icon: <ClusterOutlined style={{ color: "#1890ff", fontSize: "20px" }} />,
    title: "AI Điều Phối Tự Động",
    desc: "Thuật toán học máy phân tích lộ trình và rủi ro thời tiết."
  },
  {
    top: "45%",
    left: "50%",
    icon: <SafetyCertificateOutlined style={{ color: "#1890ff", fontSize: "20px" }} />,
    title: "Bảo Mật Cấp Quân Sự",
    desc: "Mã hóa end-to-end cho mọi giao dịch và chứng từ xuất nhập khẩu."
  }
];

export function CoreTechSection() {
  return (
    <div style={{
      background: "#000814",
      padding: "120px 0",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Decorative Glows */}
      <div style={{
        position: "absolute",
        top: "-10%",
        right: "-5%",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0) 70%)",
        filter: "blur(60px)",
        zIndex: 0
      }} />

      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 40px", position: "relative", zIndex: 10 }}>
        <Row gutter={[64, 64]} align="middle">
          {/* Text Content */}
          <Col xs={24} lg={10}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Space orientation="vertical" size={24}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(24, 144, 255, 0.05)',
                  padding: '8px 20px',
                  borderRadius: '100px',
                  border: '1px solid rgba(24, 144, 255, 0.2)'
                }}>
                  <Text strong style={{ color: '#1890ff', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Core Technology
                  </Text>
                </div>
                
                <Title style={{ color: "#fff", fontSize: "48px", fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
                  CÔNG NGHỆ BÊN TRONG <br />
                  <span style={{ color: "transparent", WebkitTextStroke: "1px #1890ff" }}>HỆ SINH THÁI</span>
                </Title>
                
                <Paragraph style={{ color: "rgba(255,255,255,0.6)", fontSize: "18px", lineHeight: 1.6, marginTop: "16px" }}>
                  Mọi chuyến hàng đều được kiểm soát bởi một cấu trúc công nghệ tinh vi, đan xen giữa phần cứng IoT và hệ thống trí tuệ nhân tạo dự báo đa chiều. 
                  Chúng tôi không để lại bất kỳ khoảng mù (blind-spot) nào trong chuỗi cung ứng của bạn.
                </Paragraph>
              </Space>
            </motion.div>
          </Col>

          {/* Exploded View Image with Hotspots */}
          <Col xs={24} lg={14}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              viewport={{ once: true }}
              style={{ position: "relative", width: "100%", borderRadius: "24px", overflow: "hidden" }}
            >
              <img 
                src={explodedViewImg.src} 
                alt="Core Technology"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
              
              {/* Overlay Hotspots */}
              {hotspots.map((spot, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.2, type: "spring", stiffness: 200 }}
                  viewport={{ once: true }}
                  style={{
                    position: "absolute",
                    top: spot.top,
                    left: spot.left,
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }}
                  className="tech-hotspot"
                >
                  <div style={{
                    width: "48px",
                    height: "48px",
                    background: "rgba(0, 8, 20, 0.6)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(24, 144, 255, 0.5)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 20px rgba(24, 144, 255, 0.3)",
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 2
                  }}>
                    {spot.icon}
                  </div>
                  
                  {/* Glassmorphism Tooltip - simplified inline for demo */}
                  <div className="hotspot-tooltip" style={{
                    marginTop: "16px",
                    background: "rgba(0, 8, 20, 0.7)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    padding: "16px",
                    borderRadius: "12px",
                    width: "220px",
                    textAlign: "center",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
                  }}>
                    <Text strong style={{ color: "#fff", display: "block", marginBottom: "8px" }}>{spot.title}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>{spot.desc}</Text>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </Col>
        </Row>
      </div>

      <style jsx>{`
        .hotspot-tooltip {
          opacity: 0;
          transform: translateY(-10px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }
        .tech-hotspot:hover .hotspot-tooltip {
          opacity: 1;
          transform: translateY(0);
        }
        .tech-hotspot > div:first-child::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 1px solid rgba(24, 144, 255, 0.5);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
