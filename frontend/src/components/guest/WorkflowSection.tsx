/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useRef } from "react";
import { Typography, Row, Col, Space } from "antd";
import { motion, useScroll, useTransform } from "framer-motion";

const { Title, Paragraph, Text } = Typography;

const steps = [
  { num: "01", title: "Khởi tạo Yêu Cầu", desc: "Tự động phân tích nhu cầu và lập kế hoạch." },
  { num: "02", title: "Điều phối Đa phương thức", desc: "Tối ưu hóa chặng đường qua đường biển, hàng không và nội địa." },
  { num: "03", title: "Thông quan Điện tử", desc: "Khai báo hải quan tự động với hệ thống hải quan một cửa." },
  { num: "04", title: "Giao hàng Chặng cuối", desc: "Kiểm soát nhiệt độ và tracking GPS tới tận tay người nhận." }
];

export function WorkflowSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <div ref={containerRef} style={{
      background: "#00050d",
      padding: "160px 0",
      position: "relative",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      borderBottom: "1px solid rgba(255,255,255,0.05)"
    }}>
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 40px" }}>
        
        <div style={{ textAlign: "center", marginBottom: "80px" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
            <Text strong style={{ color: '#1890ff', fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Chuỗi Giá Trị Kín (Closed-Loop Supply Chain)
            </Text>
            <Title style={{ color: "#fff", fontSize: "40px", fontWeight: 900, marginTop: "16px" }}>
              BẢN ĐỒ VẬN HÀNH <span style={{ color: "#1890ff" }}>TOÀN CẦU</span>
            </Title>
            <Paragraph style={{ color: "rgba(255,255,255,0.5)", fontSize: "18px", maxWidth: "700px", margin: "0 auto" }}>
              Từ điểm khởi nguồn đến tay người tiêu dùng cuối, mỗi mắt xích đều được lập trình để đạt độ chính xác hoàn hảo.
            </Paragraph>
          </motion.div>
        </div>

        <Row gutter={[80, 80]} align="middle">
          {/* Text Steps */}
          <Col xs={24} lg={8}>
            <Space orientation="vertical" size={40} style={{ width: "100%" }}>
              {steps.map((step, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true, margin: "-100px" }}
                  style={{
                    position: "relative",
                    paddingLeft: "40px",
                    borderLeft: "2px solid rgba(24, 144, 255, 0.2)"
                  }}
                >
                  <div style={{
                    position: "absolute",
                    left: "-16px",
                    top: "0",
                    width: "30px",
                    height: "30px",
                    background: "#000814",
                    border: "2px solid #1890ff",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1890ff",
                    fontWeight: "bold",
                    fontSize: "12px",
                    boxShadow: "0 0 15px rgba(24, 144, 255, 0.4)"
                  }}>
                    {step.num}
                  </div>
                  <Title level={4} style={{ color: "#fff", margin: 0 }}>{step.title}</Title>
                  <Paragraph style={{ color: "rgba(255,255,255,0.5)", marginTop: "8px", fontSize: "16px" }}>{step.desc}</Paragraph>
                </motion.div>
              ))}
            </Space>
          </Col>

          {/* Diagram Image */}
          <Col xs={24} lg={16}>
            <motion.div style={{ scale: imgScale, opacity }}>
              <div style={{
                borderRadius: "32px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
                position: "relative"
              }}>
                <img 
                  src="/images/Một_hình_ảnh_sơ_đồ_202606280142.jpeg" 
                  alt="Global Network Diagram" 
                  style={{ width: "100%", height: "auto", display: "block" }} 
                />
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to right, rgba(0,5,13,0.8) 0%, transparent 40%, transparent 60%, rgba(0,5,13,0.8) 100%)",
                  pointerEvents: "none"
                }} />
              </div>
            </motion.div>
          </Col>
        </Row>
      </div>
    </div>
  );
}
