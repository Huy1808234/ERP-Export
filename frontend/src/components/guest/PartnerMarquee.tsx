"use client";

import React from "react";
import { Typography } from "antd";
import { motion } from "framer-motion";

const { Text } = Typography;

const partners = [
  "MAERSK",
  "MSC",
  "CMA CGM",
  "COSCO",
  "HAPAG-LLOYD",
  "ONE",
  "EVERGREEN",
  "YANG MING",
  "ZIM",
  "HMM"
];

// Duplicate the array to create a seamless infinite scrolling effect
const marqueeItems = [...partners, ...partners];

export const PartnerMarquee = () => {
  return (
    <div style={{
      background: "#000814",
      padding: "60px 0",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Left/Right fading gradient masks */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, bottom: 0, width: "150px",
        background: "linear-gradient(to right, #000814, transparent)",
        zIndex: 2
      }} />
      <div style={{
        position: "absolute",
        top: 0, right: 0, bottom: 0, width: "150px",
        background: "linear-gradient(to left, #000814, transparent)",
        zIndex: 2
      }} />

      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700 }}>
          Đối tác chiến lược toàn cầu
        </Text>
      </div>

      <div style={{ display: "flex", width: "fit-content" }}>
        <motion.div
          animate={{ x: "-50%" }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{ display: "flex", gap: "100px", paddingRight: "100px", whiteSpace: "nowrap" }}
        >
          {marqueeItems.map((partner, index) => (
            <div key={index} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.3,
              filter: "grayscale(100%)",
              transition: "all 0.3s",
              cursor: "pointer"
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.filter = "drop-shadow(0 0 10px rgba(24,144,255,0.5))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.3";
                e.currentTarget.style.filter = "grayscale(100%)";
              }}
            >
              <span style={{ fontSize: "28px", fontWeight: 900, color: "#fff", letterSpacing: "2px" }}>
                {partner}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
