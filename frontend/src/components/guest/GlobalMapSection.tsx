"use client";

import React from "react";
import { Typography, Row, Col } from "antd";
import { motion } from "framer-motion";
import { GlobalOutlined } from "@ant-design/icons";
import mapBg from "../../../public/images/Một_hình_ảnh_sơ_đồ_202606280142.jpeg";

const { Title, Text, Paragraph } = Typography;

// Simulated global hubs
const hubs = [
  { top: "35%", left: "20%", name: "Los Angeles", delay: 0 },
  { top: "30%", left: "28%", name: "New York", delay: 0.2 },
  { top: "45%", left: "48%", name: "Rotterdam", delay: 0.4 },
  { top: "60%", left: "55%", name: "Dubai", delay: 0.6 },
  { top: "65%", left: "75%", name: "Singapore", delay: 0.8 },
  { top: "50%", left: "85%", name: "Shanghai", delay: 1.0 },
  { top: "75%", left: "88%", name: "Sydney", delay: 1.2 }
];

export const GlobalMapSection = () => {
  return (
    <div style={{
      background: "#000814",
      padding: "120px 0",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background Glow */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "800px",
        height: "800px",
        background: "radial-gradient(circle, rgba(24,144,255,0.05) 0%, rgba(0,8,20,0) 70%)",
        pointerEvents: "none"
      }} />

      <div style={{ width: '100%', margin: "0 auto", padding: "0 40px", position: "relative", zIndex: 10 }}>
        <Row justify="center" style={{ textAlign: "center", marginBottom: "80px" }}>
          <Col xs={24} md={16} lg={12}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div style={{ display: "inline-block", padding: "8px 16px", background: "rgba(24,144,255,0.1)", borderRadius: "100px", marginBottom: "24px" }}>
                <Text style={{ color: "#1890ff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontSize: "12px" }}>
                  <GlobalOutlined style={{ marginRight: "8px" }} />
                  Mạng lưới kết nối
                </Text>
              </div>
              <Title style={{ color: "#fff", fontSize: "48px", fontWeight: 900, marginBottom: "24px" }}>
                Kết Nối Mọi Điểm Đến <br />
                <span style={{ color: "rgba(255,255,255,0.3)" }}>Trên Bản Đồ Thế Giới</span>
              </Title>
              <Paragraph style={{ color: "rgba(255,255,255,0.5)", fontSize: "18px" }}>
                Với hệ thống đối tác vận tải chiến lược trải dài trên 50+ quốc gia, chúng tôi đảm bảo hàng hóa của bạn luôn lưu thông liên tục, an toàn và đúng hẹn.
              </Paragraph>
            </motion.div>
          </Col>
        </Row>

        {/* Map Container */}
        <motion.div 
          initial="rest"
          whileHover="hover"
          style={{ position: "relative", height: "60vh", minHeight: "500px", width: "100%", cursor: "crosshair", borderRadius: "40px", overflow: "hidden" }}
        >
          <motion.div 
            variants={{
              rest: { 
                scale: 1.05,
                rotate: 0,
                filter: "contrast(110%) brightness(1)",
                transition: { duration: 0.8, ease: "easeOut" }
              },
              hover: { 
                scale: 1.25, 
                rotate: 2,
                filter: "contrast(120%) brightness(1.2)",
                transition: { duration: 0.6, type: "spring", stiffness: 40 }
              }
            }}
            style={{
              position: "absolute",
              inset: "-10%", // increased inset to allow for scale
              backgroundImage: `url('${mapBg.src}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.4,
              borderRadius: "40px",
              maskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)"
            }} 
          />

          {/* Flash Overlay on Hover */}
          <motion.div
            variants={{
              rest: { opacity: 0 },
              hover: { opacity: [0, 0.4, 0], transition: { duration: 1 } }
            }}
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(135deg, rgba(24,144,255,0) 0%, rgba(24,144,255,0.4) 50%, rgba(24,144,255,0) 100%)",
              mixBlendMode: "overlay",
              pointerEvents: "none"
            }}
          />

          {/* Glowing Hubs */}
          {hubs.map((hub, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: hub.delay, duration: 0.5, type: "spring" }}
              style={{
                position: "absolute",
                top: hub.top,
                left: hub.left,
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <div style={{ position: "relative", width: "16px", height: "16px" }}>
                <div style={{ position: "absolute", inset: 0, background: "#1890ff", borderRadius: "50%", opacity: 0.8 }} />
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: hub.delay }}
                  style={{ position: "absolute", inset: 0, background: "#1890ff", borderRadius: "50%" }}
                />
              </div>
              <Text style={{ color: "#fff", fontWeight: 700, fontSize: "12px", letterSpacing: "1px", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                {hub.name}
              </Text>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
