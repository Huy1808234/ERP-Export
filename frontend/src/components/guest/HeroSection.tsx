"use client";

import React, { useEffect, useState } from "react";
import { Row, Col, Typography, Button, Input, Card, Space, Statistic, Modal, Descriptions, Badge, Tag, Empty } from "antd";
import { SafetyCertificateOutlined, RightOutlined, TruckOutlined, EnvironmentOutlined, CalendarOutlined, ContainerOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { guestService, type PublicShipmentTrackingPayload, type PublicSummaryPayload } from "@/services/guest.service";
import { useTranslations } from "next-intl";

const { Title, Paragraph, Text } = Typography;

export function HeroSection() {
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<PublicShipmentTrackingPayload | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState<PublicSummaryPayload | null>(null);
  const tStatus = useTranslations('ShipmentStatus');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await guestService.getSummary();
        if (res?.data) {
          setStats(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };
    fetchStats();
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
    <div style={{
      position: 'relative',
      minHeight: '900px',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: '#000814'
    }}>
      {/* Background Image with Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url("https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&q=80&w=2500")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.3,
        filter: 'grayscale(100%)'
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, #000814 30%, transparent 100%)'
      }} />

      <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '0 40px', position: 'relative', zIndex: 10 }}>
        <Row gutter={[80, 40]} align="middle">

          {/* Text Content with Framer Motion */}
          <Col xs={24} lg={13}>
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Space orientation="vertical" size={32} style={{ width: '100%' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(24, 144, 255, 0.1)',
                  padding: '10px 24px',
                  borderRadius: '100px',
                  border: '1px solid rgba(24, 144, 255, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span style={{ width: '8px', height: '8px', background: '#1890ff', borderRadius: '50%', boxShadow: '0 0 10px #1890ff' }} />
                  <Text strong style={{ color: '#1890ff', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    Logistics Intelligence 4.0
                  </Text>
                </div>

                <Title style={{
                  color: '#fff',
                  fontSize: 'clamp(48px, 6vw, 90px)',
                  margin: 0,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-2px'
                }}>
                  MOVE THE <br />
                  <span style={{
                    background: 'linear-gradient(90deg, #1890ff, #69c0ff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>FUTURE.</span>
                </Title>

                <Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: '20px', maxWidth: '550px', lineHeight: '1.6' }}>
                  VinaExport không chỉ vận chuyển hàng hóa, chúng tôi vận chuyển niềm tin và giá trị cốt lõi đến khắp nơi trên thế giới.
                </Paragraph>

                <Space size="large" style={{ marginTop: '20px' }}>
                  <Button type="primary" size="large" style={{
                    height: '64px',
                    padding: '0 48px',
                    fontSize: '18px',
                    fontWeight: 900,
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(24, 144, 255, 0.3)'
                  }}>
                    BẮT ĐẦU NGAY <RightOutlined />
                  </Button>
                  <Button type="link" size="large" style={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}>
                    Xem dịch vụ →
                  </Button>
                </Space>

                <Row gutter={64} style={{ marginTop: '60px' }}>
                  <Col>
                    <Statistic
                      title={<Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 900 }}>LÔ HÀNG</Text>}
                      value={stats?.shipments.inProgress || 1500}
                      suffix="+"
                      styles={{ content: { color: '#fff', fontWeight: 900, fontSize: '32px' } }}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title={<Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 900 }}>ĐỐI TÁC</Text>}
                      value={stats?.partners.active || 500}
                      suffix="+"
                      styles={{ content: { color: '#fff', fontWeight: 900, fontSize: '32px' } }}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      title={<Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 900 }}>HOÀN TẤT</Text>}
                      value={stats?.shipments.completionRate || 98}
                      suffix="%"
                      styles={{ content: { color: '#fff', fontWeight: 900, fontSize: '32px' } }}
                    />
                  </Col>
                </Row>
              </Space>
            </motion.div>
          </Col>

          {/* Glass Card Tracking */}
          <Col xs={24} lg={11}>
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Card
                id="tracking"
                style={{
                  borderRadius: '40px',
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
                  padding: '20px'
                }}
                styles={{ body: { padding: '32px' } }}
              >
                <div style={{ marginBottom: '40px' }}>
                  <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 900 }}>TRA CỨU VẬN ĐƠN</Title>
                  <Paragraph style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', marginTop: '8px' }}>
                    Nhập mã vận đơn để bắt đầu theo dõi thời gian thực.
                  </Paragraph>
                </div>

                <Space orientation="vertical" size={24} style={{ width: '100%' }}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      size="large"
                      placeholder="Mã vận đơn (VD: VNX-789)"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      onPressEnter={handleTrack}
                      style={{
                        height: '72px',
                        borderRadius: '20px',
                        fontSize: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        paddingLeft: '30px'
                      }}
                      className="premium-input"
                    />
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={loading}
                    onClick={handleTrack}
                    style={{
                      height: '72px',
                      borderRadius: '20px',
                      fontSize: '22px',
                      fontWeight: 900,
                      background: '#fff',
                      color: '#000',
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(255,255,255,0.1)'
                    }}
                  >
                    KIỂM TRA NGAY
                  </Button>

                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(24,144,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SafetyCertificateOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                    </div>
                    <div>
                      <Text strong style={{ color: '#fff', display: 'block' }}>Hệ thống bảo mật AES-256</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Dữ liệu của bạn được bảo vệ tuyệt đối</Text>
                    </div>
                  </div>
                </Space>
              </Card>
            </motion.div>
          </Col>

        </Row>
      </div>

      <Modal
        title={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={800}
        styles={{ body: { padding: '32px' } }}
        centered
      >
        {trackingResult ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <TruckOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
              <Title level={2}>KẾT QUẢ TRA CỨU</Title>
              <Text type="secondary">Số lô hàng: <Text strong>{trackingResult.shipmentNumber}</Text></Text>
            </div>

            <Row gutter={[32, 32]}>
              <Col span={24}>
                <Card styles={{ body: { padding: '24px' } }} style={{ borderRadius: '16px', background: '#f0f7ff', border: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space orientation="vertical" size={0}>
                      <Text type="secondary">Trạng thái hiện tại</Text>
                      <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {tStatus(trackingResult.status)}
                      </Title>
                    </Space>
                    <Badge
                      status={trackingResult.status === 'CLOSED' ? 'success' : 'processing'}
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
                    {trackingResult.etd ? new Date(trackingResult.etd).toLocaleDateString('vi-VN') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={<Space><CalendarOutlined /> ETA</Space>}>
                    {trackingResult.eta ? new Date(trackingResult.eta).toLocaleDateString('vi-VN') : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col xs={24} md={12}>
                <Descriptions title="Phương tiện & Đối tác" column={1}>
                  <Descriptions.Item label="Tàu / Chuyến">
                    <Text strong>{trackingResult.vesselName || '-'} / {trackingResult.voyageNumber || '-'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Booking No.">
                    <Tag color="purple">{trackingResult.bookingNumber || '-'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Forwarder">
                    {trackingResult.logisticsPartner || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>

              <Col span={24}>
                <Title level={5}><ContainerOutlined /> Danh sách Container</Title>
                <div style={{ marginTop: '16px' }}>
                  {trackingContainers.length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {trackingContainers.map((container, index) => (
                        <Col xs={24} sm={12} key={index}>
                          <Card size="small" style={{ borderRadius: '8px' }}>
                            <Space orientation="vertical" size={0}>
                              <Text type="secondary" style={{ fontSize: '12px' }}>Container No.</Text>
                              <Text strong>{container.containerNumber}</Text>
                              <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px' }}>Type</Text>
                              <Tag color="blue">{container.type || '-'}</Tag>
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

            <div style={{ marginTop: '40px', textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Cập nhật lần cuối: {new Date(trackingResult.updatedAt).toLocaleString('vi-VN')}
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
