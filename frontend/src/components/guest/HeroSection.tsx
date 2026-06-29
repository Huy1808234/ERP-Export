"use client";

import React, { useEffect, useRef, useState } from "react";
import { Row, Col, Typography, Button, Input, Card, Space, Modal, Descriptions, Badge, Tag, Empty } from "antd";
import {
  SafetyCertificateOutlined,
  TruckOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ContainerOutlined,
  CheckCircleFilled,
  ThunderboltFilled,
  GlobalOutlined,
  ArrowRightOutlined,
  PlayCircleFilled
} from "@ant-design/icons";
import { motion, useScroll, useTransform } from "framer-motion";
import { guestService, type PublicShipmentTrackingPayload, type PublicSummaryPayload } from "@/services/guest.service";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { CUSTOMER_PORTAL_ENTRY_PATH } from "@/utils/auth-redirect";

const { Title, Paragraph, Text } = Typography;

import deepBlackImg from "../../../public/images/Deep_black_background_with_subtle_202606280142.jpeg";
import explodedViewImg from "../../../public/images/A_cinematic,_hyper-detailed_exploded_view_202606280142.jpeg";

const tickerItems = [
  { label: "PARTNER", value: "MAERSK", status: "ACTIVE" },
  { label: "PARTNER", value: "MSC", status: "ACTIVE" },
  { label: "PARTNER", value: "CMA CGM", status: "ACTIVE" },
  { label: "PARTNER", value: "HAPAG-LLOYD", status: "ACTIVE" },
  { label: "PARTNER", value: "EVERGREEN", status: "ACTIVE" },
  { label: "PARTNER", value: "ONE", status: "ACTIVE" },
  { label: "PARTNER", value: "COSCO", status: "ACTIVE" },
  { label: "PARTNER", value: "ZIM", status: "ACTIVE" },
];

// Real shipping & logistics brand SVG logos
const BRAND_LOGOS: Array<{ name: string; svg: React.ReactNode }> = [
  {
    name: "Maersk",
    svg: (
      <svg width="72" height="28" viewBox="0 0 72 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" fill="currentColor">MAERSK</text>
        <rect x="56" y="4" width="2" height="20" fill="currentColor" opacity="0.5"/>
        <rect x="61" y="7" width="2" height="14" fill="currentColor" opacity="0.35"/>
        <rect x="66" y="10" width="2" height="8" fill="currentColor" opacity="0.2"/>
      </svg>
    )
  },
  {
    name: "MSC",
    svg: (
      <svg width="56" height="28" viewBox="0 0 56 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" fill="currentColor">MSC</text>
        <path d="M44 8 L48 8 L46 20 L44 20 Z" fill="currentColor" opacity="0.6"/>
        <path d="M49 6 L55 6 L53 22 L49 22 Z" fill="currentColor" opacity="0.4"/>
      </svg>
    )
  },
  {
    name: "CMA CGM",
    svg: (
      <svg width="90" height="28" viewBox="0 0 90 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="20" fontWeight="900" fill="currentColor">CMA CGM</text>
      </svg>
    )
  },
  {
    name: "Hapag-Lloyd",
    svg: (
      <svg width="108" height="28" viewBox="0 0 108 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="19" fontWeight="900" fill="currentColor">HAPAG-LLOYD</text>
      </svg>
    )
  },
  {
    name: "Evergreen",
    svg: (
      <svg width="88" height="28" viewBox="0 0 88 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="20" fontWeight="900" fill="currentColor">EVERGREEN</text>
        <circle cx="82" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5"/>
      </svg>
    )
  },
  {
    name: "COSCO",
    svg: (
      <svg width="68" height="28" viewBox="0 0 68 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" fill="currentColor">COSCO</text>
        <rect x="56" y="6" width="8" height="2" fill="currentColor" opacity="0.5"/>
        <rect x="56" y="11" width="8" height="2" fill="currentColor" opacity="0.5"/>
        <rect x="56" y="16" width="8" height="2" fill="currentColor" opacity="0.5"/>
      </svg>
    )
  },
  {
    name: "DHL",
    svg: (
      <svg width="52" height="28" viewBox="0 0 52 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" fill="currentColor">DHL</text>
        <polygon points="42,6 52,14 42,22" fill="currentColor" opacity="0.4"/>
      </svg>
    )
  },
  {
    name: "ONE",
    svg: (
      <svg width="46" height="28" viewBox="0 0 46 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="22" fontFamily="Arial Black, sans-serif" fontSize="22" fontWeight="900" fill="currentColor">ONE</text>
        <circle cx="38" cy="14" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
        <circle cx="38" cy="14" r="3" fill="currentColor" opacity="0.3"/>
      </svg>
    )
  },
];

export function HeroSection() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<PublicShipmentTrackingPayload | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState<PublicSummaryPayload | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const tStatus = useTranslations('ShipmentStatus');
  const customerLoginHref = `/auth/login?callbackUrl=${encodeURIComponent(CUSTOMER_PORTAL_ENTRY_PATH)}`;

  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await guestService.getSummary();
        if (res?.data) setStats(res.data);
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMousePos({ x: x * 30, y: y * 30 });
    };
    const el = heroRef.current;
    if (el) el.addEventListener("mousemove", handleMove);
    return () => { if (el) el.removeEventListener("mousemove", handleMove); };
  }, []);

  const handleTrack = async () => {
    if (!searchValue) return;
    setLoading(true);
    try {
      const res = await guestService.trackShipment(searchValue);
      setTrackingResult(res?.data || null);
      setIsModalOpen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const trackingContainers = trackingResult?.containers ?? [];

  return (
    <div
      ref={heroRef}
      className="hero-container"
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#00050d",
        isolation: "isolate"
      }}
    >
      {/* LAYER 1 — Base deep black background image (subtle parallax) */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-10%",
          backgroundImage: `url('${deepBlackImg.src}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          scale: bgScale,
          y: bgY,
          zIndex: 1
        }}
      />

      {/* LAYER 2 — Cinematic exploded view (mouse-tracked parallax) */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-8%",
          backgroundImage: `url('${explodedViewImg.src}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          x: mousePos.x * 0.6,
          y: mousePos.y * 0.6,
          opacity: 0.92,
          mixBlendMode: "screen",
          zIndex: 2,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, #000 30%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, #000 30%, transparent 90%)"
        }}
      />

      {/* LAYER 3 — Animated radial glow (cyan + violet) */}
      <div className="hero-glow hero-glow--cyan" />
      <div className="hero-glow hero-glow--violet" />

      {/* LAYER 4 — Grid overlay (engineering blueprint feel) */}
      <div className="hero-grid" />

      {/* LAYER 5 — Scanline + grain (cinematic) */}
      <div className="hero-scanlines" />
      <div className="hero-grain" />

      {/* LAYER 6 — Vignette */}
      <div className="hero-vignette" />

      {/* LAYER 7 — Top fade */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(0,5,13,0.55) 0%, rgba(0,5,13,0) 30%, rgba(0,5,13,0) 70%, rgba(0,5,13,1) 100%)",
        zIndex: 8
      }} />

      {/* MAIN CONTENT */}
      <div style={{
        position: "relative",
        zIndex: 10,
        maxWidth: 1440,
        width: "100%",
        margin: "0 auto",
        padding: "160px 40px 80px"
      }}>
        <Row gutter={[48, 48]} align="middle">
          {/* LEFT — Headline + CTA + stats */}
          <Col xs={24} lg={14}>
            <motion.div style={{ y: titleY, opacity: titleOpacity }}>
              {/* Status pill */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  background: "rgba(24, 144, 255, 0.08)",
                  padding: "10px 20px 10px 14px",
                  borderRadius: 100,
                  border: "1px solid rgba(24, 144, 255, 0.35)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 8px 32px rgba(24, 144, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
                }}
              >
                <span className="hero-pulse-dot" />
                <Text strong style={{
                  color: "#bae0ff",
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 700
                }}>
                  Logistics Intelligence · Live Network
                </Text>
              </motion.div>

              {/* Headline */}
              <Title style={{
                color: "#fff",
                fontSize: "clamp(54px, 7vw, 108px)",
                margin: "32px 0 24px",
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "-3px"
              }}>
                <motion.span
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: "inline-block" }}
                >
                  MOVE
                </motion.span>{" "}
                <motion.span
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: "inline-block" }}
                >
                  THE
                </motion.span>
                <br />
                <motion.span
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="hero-gradient-text"
                  style={{ display: "inline-block", fontStyle: "italic", fontWeight: 900 }}
                >
                  FUTURE.
                </motion.span>
              </Title>

              {/* Sub copy */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <Paragraph style={{
                  color: "rgba(220, 235, 255, 0.72)",
                  fontSize: 20,
                  maxWidth: 580,
                  lineHeight: 1.55,
                  marginBottom: 40
                }}>
                  Nền tảng logistics thế hệ mới — kết nối cảng biển, hàng không và kho vận
                  trong một bản đồ vận hành thời gian thực. Minh bạch. Đo lường được. Đáng tin cậy.
                </Paragraph>
              </motion.div>

              {/* CTA Group */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.75 }}
              >
                <Space size={16} wrap>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => router.push(customerLoginHref)}
                    style={{
                      height: 64,
                      padding: "0 36px",
                      fontSize: 15,
                      fontWeight: 800,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
                      border: "none",
                      boxShadow: "0 16px 40px rgba(24, 144, 255, 0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
                      letterSpacing: "0.08em"
                    }}
                    icon={<ThunderboltFilled />}
                  >
                    BẮT ĐẦU NGAY
                  </Button>
                  <Button
                    size="large"
                    style={{
                      height: 64,
                      padding: "0 28px",
                      fontSize: 15,
                      fontWeight: 700,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: "#fff",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)"
                    }}
                    icon={<PlayCircleFilled style={{ color: "#69c0ff" }} />}
                  >
                    XEM DEMO
                  </Button>
                </Space>
              </motion.div>

              {/* Trust strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
                style={{ marginTop: 64 }}
              >
                <Text style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  fontWeight: 600
                }}>
                  Đối tác vận hành
                </Text>
                <div style={{
                  marginTop: 20,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "24px 40px",
                  alignItems: "center"
                }}>
                  {BRAND_LOGOS.map((logo) => (
                    <div
                      key={logo.name}
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        transition: "color 0.35s ease, filter 0.35s ease",
                        cursor: "default",
                        display: "flex",
                        alignItems: "center"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.filter = "drop-shadow(0 0 12px rgba(105,192,255,0.5))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                        e.currentTarget.style.filter = "none";
                      }}
                    >
                      {logo.svg}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </Col>

          {/* RIGHT — Floating glass dashboard mock + stats */}
          <Col xs={24} lg={10}>
            <motion.div
              style={{ y: mockupY, position: "relative" }}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Floating glass dashboard with cross-fade background burst */}
              <div className="hero-glass-card hero-glass-card--floating hero-burst-card">
                {/* Layer 1 — Base image (ship — default) */}
                <div className="hero-burst-layer hero-burst-layer--base" />
                {/* Layer 2 — Exploded view (reveals on hover) */}
                <div className="hero-burst-layer hero-burst-layer--reveal" />
                {/* Center radial flash on hover */}
                <div className="hero-burst-flash" />
                {/* Top fade so text remains readable */}
                <div className="hero-burst-topfade" />
                {/* Bottom fade to keep search bar readable */}
                <div className="hero-burst-botfade" />

                {/* Top bar */}
                <div style={{
                  position: "relative",
                  zIndex: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24
                }}>
                  <Space>
                    <span className="hero-pulse-dot hero-pulse-dot--green" />
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, letterSpacing: "0.15em", fontWeight: 700 }}>
                      GLOBAL CONTROL TOWER
                    </Text>
                  </Space>
                  <Tag color="processing" style={{ borderRadius: 6, fontWeight: 700, letterSpacing: "0.1em" }}>
                    LIVE
                  </Tag>
                </div>

                {/* Stats grid */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24, position: "relative", zIndex: 3 }}>
                  <Col span={12}>
                    <div className="hero-mini-stat">
                      <Text className="hero-mini-stat__label">LÔ HÀNG</Text>
                      <div className="hero-mini-stat__value" suppressHydrationWarning>
                        {(stats?.shipments.inProgress ?? 1500).toLocaleString("en-US")}<span style={{ color: "#69c0ff" }}>+</span>
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="hero-mini-stat">
                      <Text className="hero-mini-stat__label">ĐỐI TÁC</Text>
                      <div className="hero-mini-stat__value" suppressHydrationWarning>
                        {(stats?.partners.active ?? 500).toLocaleString("en-US")}<span style={{ color: "#b37feb" }}>+</span>
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="hero-mini-stat">
                      <Text className="hero-mini-stat__label">HOÀN TẤT</Text>
                      <div className="hero-mini-stat__value">
                        {stats?.shipments.completionRate ?? 98}<span style={{ color: "#52c41a" }}>%</span>
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="hero-mini-stat">
                      <Text className="hero-mini-stat__label">CONTINENTS</Text>
                      <div className="hero-mini-stat__value">
                        06<span style={{ color: "#ffc53d" }}>●</span>
                      </div>
                    </div>
                  </Col>
                </Row>

                {/* Search field */}
                <div style={{
                  position: "relative",
                  zIndex: 3,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                  padding: "6px 6px 6px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)"
                }}>
                  <GlobalOutlined style={{ color: "#69c0ff", fontSize: 18 }} />
                  <Input
                    placeholder="Nhập mã lô hàng: VD-2026-XXXX"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onPressEnter={handleTrack}
                    variant="borderless"
                    style={{
                      background: "transparent",
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 500
                    }}
                  />
                  <Button
                    type="primary"
                    onClick={handleTrack}
                    loading={loading}
                    style={{
                      height: 44,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #1890ff, #722ed1)",
                      border: "none",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      padding: "0 22px"
                    }}
                    icon={<ArrowRightOutlined />}
                  >
                    TRA CỨU
                  </Button>
                </div>
              </div>

              {/* Floating corner badge — top */}
              <motion.div
                className="hero-corner-badge hero-corner-badge--top"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <CheckCircleFilled style={{ color: "#52c41a", fontSize: 16 }} />
                <div>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.15em", display: "block" }}>
                    ON-TIME RATE
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>
                    98.7%
                  </Text>
                </div>
              </motion.div>

              {/* Floating corner badge — bottom */}
              <motion.div
                className="hero-corner-badge hero-corner-badge--bottom"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <SafetyCertificateOutlined style={{ color: "#69c0ff", fontSize: 16 }} />
                <div>
                  <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.15em", display: "block" }}>
                    ISO 27001
                  </Text>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>
                    CERTIFIED
                  </Text>
                </div>
              </motion.div>
            </motion.div>
          </Col>
        </Row>
      </div>

      {/* LIVE TICKER BAR */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9,
        background: "rgba(0, 5, 13, 0.7)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(24, 144, 255, 0.15)",
        borderBottom: "1px solid rgba(24, 144, 255, 0.15)",
        padding: "16px 0",
        overflow: "hidden"
      }}>
        <div className="hero-ticker">
          <div className="hero-ticker__track">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
              <div 
                key={i} 
                className="hero-ticker__item"
                style={{ transition: "all 0.3s ease", display: "inline-flex", cursor: "pointer" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.zIndex = "10";
                  e.currentTarget.style.filter = "drop-shadow(0 0 12px rgba(105, 192, 255, 1))";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.zIndex = "1";
                  e.currentTarget.style.filter = "none";
                  e.currentTarget.style.color = "";
                }}
              >
                <span className="hero-ticker__label">{item.label}</span>
                <span className="hero-ticker__value">{item.value}</span>
                <span className={`hero-ticker__status hero-ticker__status--${item.status.replace(/\s/g, "").toLowerCase()}`}>
                  {item.status}
                </span>
                <span className="hero-ticker__sep" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRACKING MODAL */}
      <Modal
        title={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={800}
        styles={{ body: { padding: 32 } }}
        centered
      >
        {trackingResult ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <TruckOutlined style={{ fontSize: 48, color: "#1890ff", marginBottom: 16 }} />
              <Title level={2}>KẾT QUẢ TRA CỨU</Title>
              <Text type="secondary">Số lô hàng: <Text strong>{trackingResult.shipmentNumber}</Text></Text>
            </div>

            <Row gutter={[32, 32]}>
              <Col span={24}>
                <Card styles={{ body: { padding: 24 } }} style={{ borderRadius: 16, background: "#f0f7ff", border: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space orientation="vertical" size={0}>
                      <Text type="secondary">Trạng thái hiện tại</Text>
                      <Title level={4} style={{ margin: 0, color: "#1890ff" }}>
                        {tStatus(trackingResult.status)}
                      </Title>
                    </Space>
                    <Badge
                      status={trackingResult.status === "CLOSED" ? "success" : "processing"}
                      text={<Text strong>{trackingResult.status}</Text>}
                    />
                  </div>
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Descriptions title="Thông tin vận chuyển" column={1} layout="horizontal">
                  <Descriptions.Item label={<Space><EnvironmentOutlined /> POL</Space>}>
                    <Text strong>{trackingResult.pol}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Space><EnvironmentOutlined /> POD</Space>}>
                    <Text strong>{trackingResult.pod}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Space><CalendarOutlined /> ETD</Space>}>
                    {trackingResult.etd ? new Date(trackingResult.etd).toLocaleDateString("vi-VN") : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label={<Space><CalendarOutlined /> ETA</Space>}>
                    {trackingResult.eta ? new Date(trackingResult.eta).toLocaleDateString("vi-VN") : "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col xs={24} md={12}>
                <Descriptions title="Phương tiện & Đối tác" column={1}>
                  <Descriptions.Item label="Tàu / Chuyến">
                    <Text strong>{trackingResult.vesselName || "-"} / {trackingResult.voyageNumber || "-"}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Booking No.">
                    <Tag color="purple">{trackingResult.bookingNumber || "-"}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Forwarder">
                    {trackingResult.logisticsPartner || "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col span={24}>
                <Title level={5}><ContainerOutlined /> Danh sách Container</Title>
                <div style={{ marginTop: 16 }}>
                  {trackingContainers.length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {trackingContainers.map((container, index) => (
                        <Col xs={24} sm={12} key={index}>
                          <Card size="small" style={{ borderRadius: 8 }}>
                            <Space orientation="vertical" size={0}>
                              <Text type="secondary" style={{ fontSize: 12 }}>Container No.</Text>
                              <Text strong>{container.containerNumber}</Text>
                              <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>Type</Text>
                              <Tag color="blue">{container.type || "-"}</Tag>
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Text type="secondary">Chưa có thông tin container</Text>
                  )}
                </div>
              </Col>
            </Row>

            <div style={{ marginTop: 40, textAlign: "center" }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cập nhật lần cuối: {new Date(trackingResult.updatedAt).toLocaleString("vi-VN")}
              </Text>
            </div>
          </div>
        ) : (
          <Empty
            description="Không tìm thấy thông tin lô hàng này. Vui lòng kiểm tra lại số vận đơn."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Modal>
    </div>
  );
}
