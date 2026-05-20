"use client";

import React from "react";
import { Typography, Breadcrumb, Space } from "antd";
import { motion } from "framer-motion";
import { Link } from "@/i18n/routing";

const { Title, Text } = Typography;

interface PageBannerProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  height?: string;
  breadcrumbs?: { title: string; href?: string }[];
  children?: React.ReactNode;
  offset?: boolean;
}

const PageBanner: React.FC<PageBannerProps> = ({
  title,
  subtitle,
  imageUrl = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2500",
  height = "320px",
  breadcrumbs,
  children,
  offset = true
}) => {
  return (
    <div
      style={{
        position: "relative",
        height: height,
        width: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: offset ? "100px" : "0",
        background: "#000",
      }}
    >
      {/* Background Image with Parallax-like feel */}
      <motion.div
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.6 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 1,
        }}
      />

      {/* Advanced Gradient Overlay (Mesh Gradient Style) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(135deg, rgba(0, 8, 20, 0.95) 0%, rgba(0, 20, 40, 0.8) 50%, rgba(24, 144, 255, 0.15) 100%)`,
          zIndex: 2,
        }}
      />
      
      {/* Decorative Glow Elements */}
      <div style={{
        position: "absolute",
        top: "-10%",
        right: "10%",
        width: "400px",
        height: "400px",
        background: "radial-gradient(circle, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0) 70%)",
        zIndex: 3,
        filter: "blur(60px)"
      }} />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "1400px",
          width: "100%",
          padding: "0 40px",
          textAlign: "left",
        }}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {breadcrumbs && (
            <Breadcrumb
              separator={<span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>}
              style={{ marginBottom: "24px" }}
              items={breadcrumbs.map((b) => ({
                title: b.href ? (
                  <Link href={b.href} style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                    {b.title}
                  </Link>
                ) : (
                  <span style={{ color: "#1890ff", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                    {b.title}
                  </span>
                ),
              }))}
            />
          )}

          <Title
            style={{
              color: "#fff",
              margin: 0,
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-2px",
              textShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            {title}
          </Title>

          {subtitle && (
            <Paragraph
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "18px",
                marginTop: "16px",
                maxWidth: "600px",
                lineHeight: 1.6,
                fontWeight: 400
              }}
            >
              {subtitle}
            </Paragraph>
          )}

          {children}
        </motion.div>
      </div>
      
      {/* Bottom accent line */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        zIndex: 11
      }} />
    </div>
  );
};

export default PageBanner;

const { Paragraph } = Typography;
