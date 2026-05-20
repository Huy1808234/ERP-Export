"use client";

import React from "react";
import { Modal, Row, Col, Typography, Tag, Divider, Descriptions, Button, Badge } from "antd";
import { 
  GlobalOutlined, 
  BoxPlotOutlined, 
  InfoCircleOutlined, 
  ShoppingCartOutlined,
  ColumnWidthOutlined,
  DashboardOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

interface ProductDetailModalProps {
  product: any;
  open: boolean;
  onCancel: () => void;
}

export function ProductDetailModal({ product, open, onCancel }: ProductDetailModalProps) {
  if (!product) return null;

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return "N/A";
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1000}
      centered
      style={{ borderRadius: '24px' }}
      styles={{ body: { padding: '32px' } }}
    >
      <Row gutter={[48, 32]}>
        {/* Left Column: Image */}
        <Col xs={24} md={10}>
          <div style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: '#f0f7ff' }}>
            <img 
              src={product.imageUrl || `https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800`}
              alt={product.vietnameseName}
              style={{ width: '100%', height: '400px', objectFit: 'cover' }}
            />
          </div>
          <div style={{ marginTop: '24px' }}>
            <Button 
              type="primary" 
              size="large" 
              block 
              icon={<ShoppingCartOutlined />}
              style={{ height: '56px', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold' }}
            >
              LIÊN HỆ BÁO GIÁ NGAY
            </Button>
          </div>
        </Col>

        {/* Right Column: Info */}
        <Col xs={24} md={14}>
          <div style={{ marginBottom: '16px' }}>
            <Tag color="blue" style={{ borderRadius: '4px', marginBottom: '8px' }}>{product.category || 'Sản phẩm tiêu biểu'}</Tag>
            <Title level={2} style={{ margin: '0 0 8px' }}>{product.vietnameseName}</Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>{product.englishName}</Text>
          </div>

          <div style={{ margin: '24px 0' }}>
            <Text strong style={{ fontSize: '28px', color: '#1890ff' }}>
              {product.defaultExportPrice ? `${formatNumber(product.defaultExportPrice)} ${product.exportCurrency || 'VND'}` : 'Liên hệ để có giá tốt nhất'}
            </Text>
          </div>

          <Divider />

          <Descriptions title={<Text strong style={{ fontSize: '18px' }}><InfoCircleOutlined /> Thông tin cơ bản</Text>} column={2}>
            <Descriptions.Item label="HS Code">
              <Tag color="cyan">{product.hsCode || 'N/A'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="SKU">
              <Text code>{product.sku || 'N/A'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Xuất xứ">
              <Tag icon={<GlobalOutlined />} color="gold">{product.originCountry || 'Việt Nam'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Thương hiệu">
              {product.brand || 'VinaExport'}
            </Descriptions.Item>
            <Descriptions.Item label="Đơn vị tính">
              {product.unitOfMeasure || 'Thùng (Carton)'}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <Descriptions title={<Text strong style={{ fontSize: '18px' }}><BoxPlotOutlined /> Quy cách đóng gói</Text>} column={2}>
            <Descriptions.Item label="Đóng gói">
              {product.packingType || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Số lượng/Thùng">
              {product.piecesPerCarton || 'N/A'} PCS
            </Descriptions.Item>
            <Descriptions.Item label="Kích thước thùng">
              <Text type="secondary">
                {product.cartonLengthCm && product.cartonWidthCm && product.cartonHeightCm 
                  ? `${product.cartonLengthCm}x${product.cartonWidthCm}x${product.cartonHeightCm} cm` 
                  : 'N/A'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Khối lượng (G/N)">
              {formatNumber(product.grossWeightPerCarton)} / {formatNumber(product.netWeightPerCarton)} kg
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <div>
            <Text strong style={{ fontSize: '18px', display: 'block', marginBottom: '12px' }}>Mô tả sản phẩm</Text>
            <Paragraph style={{ color: '#595959', fontSize: '15px', lineHeight: '1.8' }}>
              {product.description || 'Sản phẩm xuất khẩu chất lượng cao, đáp ứng đầy đủ các tiêu chuẩn an toàn và kiểm định quốc tế. Vui lòng liên hệ với bộ phận kinh doanh để nhận catalog chi tiết và bảng giá sỉ mới nhất cho thị trường mục tiêu của bạn.'}
            </Paragraph>
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
