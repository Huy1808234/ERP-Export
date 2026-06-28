"use client";

import React, { useRef } from "react";
import { Typography } from "antd";
import { motion, useScroll, useTransform } from "framer-motion";
import { RightOutlined } from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

export function ShowcaseSection() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);

  return (
    <div style={{ background: "#000814", position: "relative" }}>
      {/* Sticky Horizontal Scroll Container */}
      <div ref={targetRef} style={{ height: "300vh" }}>
        <div style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden"
        }}>
          <motion.div style={{ x, display: "flex", gap: "100px", padding: "0 100px" }}>
            
            {/* Title Slide */}
            <div style={{ width: "100vw", maxWidth: "800px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(24, 144, 255, 0.1)',
                  padding: '10px 24px',
                  borderRadius: '100px',
                  border: '1px solid rgba(24, 144, 255, 0.3)',
                  marginBottom: '24px',
                  width: 'fit-content'
                }}>
                  <Text strong style={{ color: '#1890ff', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    Showcase
                  </Text>
              </div>
              <Title style={{ color: "#fff", fontSize: "72px", fontWeight: 900, lineHeight: 1 }}>
                VƯỢT LÊN TRÊN <br />
                <span style={{ color: "transparent", WebkitTextStroke: "2px #fff" }}>MỌI GIỚI HẠN</span>
              </Title>
              <Paragraph style={{ color: "rgba(255,255,255,0.6)", fontSize: "20px", marginTop: "24px" }}>
                Khám phá hệ thống các trạm luân chuyển và các loại mặt hàng chủ lực mà chúng tôi tự hào cung cấp dịch vụ tốt nhất.
                Cuộn để khám phá quy mô thực sự của hệ sinh thái VinaExport.
              </Paragraph>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '40px', color: '#1890ff' }}>
                <Text style={{ color: '#1890ff', fontSize: '16px', fontWeight: 600, letterSpacing: '2px' }}>CUỘN NGANG ĐỂ XEM TIẾP</Text>
                <motion.div
                  animate={{ x: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <RightOutlined style={{ fontSize: '24px' }} />
                </motion.div>
              </div>
            </div>

            {/* The Series Image */}
            <div style={{ width: "200vw", flexShrink: 0, position: "relative" }}>
              <div style={{
                width: "100%",
                height: "80vh",
                borderRadius: "40px",
                overflow: "hidden",
                boxShadow: "0 20px 80px rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}>
                <img 
                  src="/images/A_series_of_cinematic,_hyper-detailed_202606280220.jpeg" 
                  alt="Cinematic Series Showcase"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                
                {/* Overlay details */}
                <div style={{
                  position: "absolute",
                  bottom: "40px",
                  left: "40px",
                  background: "rgba(0, 8, 20, 0.6)",
                  backdropFilter: "blur(20px)",
                  padding: "40px",
                  borderRadius: "24px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  maxWidth: "500px"
                }}>
                  <Title level={3} style={{ color: "#fff", margin: 0 }}>Cơ sở hạ tầng toàn cầu</Title>
                  <Paragraph style={{ color: "rgba(255,255,255,0.7)", fontSize: "16px", marginTop: "16px" }}>
                    Từ các siêu cảng tại Thượng Hải đến kho lạnh tự động tại Hamburg. Mạng lưới vật lý được thiết kế liền mạch với mạng lưới dữ liệu.
                  </Paragraph>
                </div>
              </div>
            </div>
            
            <div style={{ width: "50vw", flexShrink: 0 }} /> {/* Spacer */}

          </motion.div>
        </div>
      </div>
    </div>
  );
}
