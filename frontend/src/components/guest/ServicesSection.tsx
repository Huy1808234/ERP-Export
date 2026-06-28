"use client";

import React from "react";
import PageBanner from "./PageBanner";

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
      

    </div>
  );
};

export default ServicesSection;
