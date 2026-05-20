'use client'
import React, { useState } from 'react';
import { Row, Col, Card, Typography, Tag, Input, Select, Button, Space } from 'antd';
import { 
  SearchOutlined, 
  FilterOutlined, 
  ShoppingCartOutlined,
  InfoCircleOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import PageBanner from '@/components/guest/PageBanner';

const { Title, Text, Paragraph } = Typography;

interface CatalogProduct {
  _id: string;
  name: string;
  category: string;
  hsCode: string;
  origin: string;
  image: string;
  description: string;
  tags: string[];
}

const productsData: CatalogProduct[] = [
  {
    _id: 'demo-jasmine-rice',
    name: 'Gạo Jasmine Thượng Hạng',
    category: 'Nông sản',
    hsCode: '1006.30',
    origin: 'Đồng bằng sông Cửu Long',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=800',
    description: 'Hạt gạo dài, trắng trong, mùi thơm hoa nhài đặc trưng. Đạt tiêu chuẩn xuất khẩu EU và Mỹ.',
    tags: ['Best Seller', 'Organic'],
  },
  {
    _id: 'demo-robusta-coffee',
    name: 'Cà phê Robusta Đắk Lắk',
    category: 'Nông sản',
    hsCode: '0901.11',
    origin: 'Tây Nguyên, Việt Nam',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=800',
    description: 'Hương vị đậm đà, hàm lượng cafein cao. Sơ chế khô hoặc ướt tùy yêu cầu khách hàng.',
    tags: ['Strong', 'Premium'],
  },
  {
    _id: 'demo-dell-ultrasharp-24',
    name: 'Màn hình Dell UltraSharp 24',
    category: 'Điện tử',
    hsCode: '8528.52',
    origin: 'Nhập khẩu/Lắp ráp',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800',
    description: 'Độ phân giải Full HD, tấm nền IPS cao cấp. Bảo hành chính hãng 3 năm.',
    tags: ['Office', '4K Ready'],
  },
];

const ProductCatalog = (): React.ReactElement => {
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredProducts = productsData.filter((product) => {
    if (!normalizedSearchTerm) return true;
    return `${product.name} ${product.category} ${product.hsCode}`
      .toLowerCase()
      .includes(normalizedSearchTerm);
  });

  return (
    <div style={{ background: '#fff' }}>
      <PageBanner 
        title="Danh Mục Sản Phẩm"
        subtitle="Khám phá nguồn hàng chất lượng cao từ VinaExport với đầy đủ chứng nhận quốc tế và hồ sơ hải quan minh bạch."
        breadcrumbs={[{ title: 'Sản phẩm' }]}
        imageUrl="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2500"
      />

      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px' }}>


        {/* Filter Section */}
        <div style={{ 
          background: '#f8fafc', 
          padding: '24px', 
          borderRadius: '16px', 
          marginBottom: '48px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={10}>
              <Input 
                size="large" 
                placeholder="Tìm kiếm tên sản phẩm, HS Code..." 
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} 
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderRadius: '12px' }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Select 
                size="large" 
                placeholder="Danh mục" 
                style={{ width: '100%' }}
                options={[
                  { value: 'agri', label: 'Nông sản' },
                  { value: 'elec', label: 'Điện tử' },
                  { value: 'textile', label: 'Dệt may' },
                ]}
              />
            </Col>
            <Col xs={12} md={6}>
              <Button size="large" block icon={<FilterOutlined />} style={{ borderRadius: '12px' }}>Bộ lọc nâng cao</Button>
            </Col>
            <Col xs={24} md={2}>
              <Button type="primary" size="large" block style={{ borderRadius: '12px' }}>TÌM</Button>
            </Col>
          </Row>
        </div>

        {/* Product Grid */}
        <Row gutter={[32, 32]}>
          {filteredProducts.map((product) => (
            <Col xs={24} sm={12} lg={8} key={product._id}>
              <motion.div
                whileHover={{ y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  hoverable
                  cover={
                    <div style={{ height: '240px', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                      <img 
                        alt={product.name} 
                        src={product.image} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  }
                  style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #f1f5f9' }}
                  bodyStyle={{ padding: '24px' }}
                >
                  <Space style={{ marginBottom: '12px' }}>
                    {product.tags.map(tag => (
                      <Tag key={tag} color="blue" style={{ borderRadius: '4px' }}>{tag}</Tag>
                    ))}
                  </Space>
                  <Title level={4} style={{ marginBottom: '8px' }}>{product.name}</Title>
                  <Space orientation="vertical" size={2} style={{ marginBottom: '16px' }}>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      <GlobalOutlined /> Xuất xứ: {product.origin}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      <InfoCircleOutlined /> HS Code: <Text strong>{product.hsCode}</Text>
                    </Text>
                  </Space>
                  <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#64748b', marginBottom: '24px' }}>
                    {product.description}
                  </Paragraph>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button type="primary" block icon={<ShoppingCartOutlined />} style={{ borderRadius: '8px', height: '40px' }}>
                      YÊU CẦU BÁO GIÁ
                    </Button>
                    <Button icon={<InfoCircleOutlined />} style={{ borderRadius: '8px', width: '45px', height: '40px' }} />
                  </div>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default ProductCatalog;
