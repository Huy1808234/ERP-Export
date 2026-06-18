"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Row, Col, Card, Typography, Button, Space, Tag, Skeleton, Select, Input, Modal, Form, message } from "antd";
import { 
  ArrowRightOutlined, 
  ShoppingOutlined,
  HeartOutlined,
  EyeOutlined,
  SearchOutlined
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { backendFetch } from "@/lib/api-client";
import { guestService, type PublicCategory, type PublicProduct, type PublicProductQuery } from "@/services/guest.service";
import PageBanner from "./PageBanner";

const { Title, Text } = Typography;

interface InquiryFormValues {
  productId?: string;
  customerName: string;
  customerEmail: string;
  quantity: string;
  customerPhone?: string;
  note?: string;
}

const ProductCatalog = (): React.ReactElement => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const searchRef = useRef(search);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [mounted, setMounted] = useState(false);
  
  // RFQ Modal State
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [form] = Form.useForm<InquiryFormValues>();
  
  const fetchCategories = useCallback(async (): Promise<void> => {
    try {
      const res = await guestService.getCategories();
      setCategories(res.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  const fetchProducts = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const params: PublicProductQuery = {};
      if (category) params.category = category;
      if (searchRef.current) params.search = searchRef.current;
      
      const res = await guestService.getProducts(params);
      setProducts(res.data?.results || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    setMounted(true);
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (): void => {
    fetchProducts();
  };

  const openRfqModal = (product: PublicProduct): void => {
    setSelectedProduct(product);
    setIsRfqModalOpen(true);
    if (session?.user) {
      form.setFieldsValue({
        customerName: session.user.name ?? "",
        customerEmail: session.user.email ?? "",
        productId: product._id
      });
    } else {
      form.setFieldsValue({
        productId: product._id
      });
    }
  };

  const handleRfqSubmit = async (values: InquiryFormValues): Promise<void> => {
    try {
      const res = await backendFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (res.ok) {
        message.success("Yêu cầu báo giá đã được gửi thành công!");
        setIsRfqModalOpen(false);
        form.resetFields();
      }
    } catch (error) {
      console.error("Error submitting RFQ:", error);
      message.error("Có lỗi xảy ra khi gửi yêu cầu.");
    }
  };

  return (
    <div id="products" style={{ background: "linear-gradient(180deg, #001d3d 0%, #000814 100%)", position: "relative" }}>
      <PageBanner 
        title="Mặt hàng chủ lực"
        subtitle="VinaExport cung cấp các sản phẩm nông sản chất lượng cao, đáp ứng các tiêu chuẩn khắt khe nhất của thị trường quốc tế."
        imageUrl="https://images.unsplash.com/photo-1615485290382-441e4d0c9cb5?auto=format&fit=crop&q=80&w=2500"
        height="400px"
        offset={false}
      />
      
      {/* Decorative Glow */}
      <div style={{
        position: "absolute",
        bottom: "10%",
        left: "-5%",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(24, 144, 255, 0.05) 0%, rgba(24, 144, 255, 0) 70%)",
        zIndex: 1,
        filter: "blur(80px)"
      }} />

      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "40px 60px 100px 60px", position: "relative", zIndex: 10 }}>
        {/* Filters and Search */}
        <div style={{ 
          background: "rgba(255,255,255,0.08)", 
          padding: "32px", 
          borderRadius: "24px", 
          marginBottom: "48px",
          backdropFilter: "blur(15px)",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
        }}>
          <Space size="large">
            <Select 
              placeholder="Chọn danh mục" 
              style={{ width: 260 }} 
              size="large"
              allowClear
              onChange={setCategory}
              className="premium-select"
              options={Array.from(new Set(categories
                .filter(c => c && c.name)
                .map(c => c.name)))
                .map(name => ({
                  value: name,
                  label: name
                }))}
            />
          </Space>
          
          <Space.Compact style={{ width: '100%', maxWidth: '450px' }}>
            <Input 
              placeholder="Tìm kiếm sản phẩm..." 
              size="large"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              style={{ 
                borderRadius: "12px 0 0 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff"
              }}
            />
            <Button 
              type="primary" 
              size="large" 
              icon={<SearchOutlined />} 
              onClick={handleSearch}
              style={{ 
                borderRadius: "0 12px 12px 0",
                height: "50px",
                padding: "0 24px"
              }}
            />
          </Space.Compact>
        </div>

        <Row gutter={[40, 40]}>
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <Col xs={24} md={8} key={i}>
                <Card style={{ borderRadius: '24px' }}>
                  <Skeleton active paragraph={{ rows: 4 }} />
                </Card>
              </Col>
            ))
          ) : products.length > 0 ? (
            products.map((product, index) => (
              <Col xs={24} md={8} key={product._id}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card
                    hoverable
                    variant="borderless"
                    cover={
                      <div style={{ position: "relative", overflow: "hidden", height: "300px", borderRadius: "24px 24px 0 0" }}>
                        <img
                          alt={product.vietnameseName}
                          src={product.imageUrl || "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=800"}
                          style={{ 
                            width: "100%", 
                            height: "100%", 
                            objectFit: "cover",
                            transition: "transform 0.6s cubic-bezier(0.33, 1, 0.68, 1)"
                          }}
                          className="product-image"
                        />
                        {(product.isBestseller || product.isNew) && (
                          <div style={{
                            position: "absolute",
                            top: "20px",
                            left: "20px",
                            zIndex: 2
                          }}>
                            <Tag color={product.isBestseller ? "gold" : "blue"} style={{ borderRadius: "6px", fontWeight: 700, padding: "4px 12px", border: "none", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
                              {product.isBestseller ? "BÁN CHẠY" : "MỚI"}
                            </Tag>
                          </div>
                        )}
                        <div className="product-overlay">
                          <Space>
                            <Button shape="circle" icon={<EyeOutlined />} size="large" />
                            <Button shape="circle" icon={<HeartOutlined />} size="large" />
                          </Space>
                        </div>
                      </div>
                    }
                    style={{ 
                      borderRadius: "24px",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      background: "#fff"
                    }}
                    styles={{ body: { padding: "28px" } }}
                  >
                    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px" }}>
                          {product.category || "Chưa phân loại"}
                        </Text>
                        <Title level={4} style={{ margin: "4px 0 0 0", fontWeight: 800, color: "#0f172a", minHeight: "56px" }}>
                          {product.vietnameseName}
                        </Title>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: "12px" }}>Giá tham chiếu</Text>
                          <div style={{ fontSize: "24px", fontWeight: 900, color: "#1890ff" }}>
                            {product.defaultExportPrice?.toLocaleString()} <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 400 }}>{product.exportCurrency} / {product.unitOfMeasure}</span>
                          </div>
                        </div>
                      </div>
 
                      <Button 
                        type="primary" 
                        ghost
                        block 
                        size="large" 
                        icon={<ShoppingOutlined />}
                        onClick={() => openRfqModal(product)}
                        style={{ 
                          height: "52px", 
                          borderRadius: "12px", 
                          fontWeight: 700,
                          border: "2px solid #1890ff",
                          marginTop: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px"
                        }}
                      >
                        NHẬN BÁO GIÁ NGAY
                      </Button>
                    </Space>
                  </Card>
                </motion.div>
              </Col>
            ))
          ) : (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '100px', background: 'rgba(255,255,255,0.02)', borderRadius: '40px' }}>
                <Title level={2} style={{ color: '#fff' }}>Không tìm thấy sản phẩm</Title>
                <Text style={{ color: 'rgba(255,255,255,0.5)' }}>Vui lòng thử lại với danh mục hoặc từ khóa khác.</Text>
              </div>
            </Col>
          )}
        </Row>
        
        <div style={{ textAlign: "center", marginTop: "80px" }}>
          <motion.div whileHover={{ x: 10 }} style={{ display: "inline-block" }}>
            <Button type="link" style={{ fontSize: "16px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "12px" }}>
              KHÁM PHÁ TOÀN BỘ DANH MỤC SẢN PHẨM <ArrowRightOutlined />
            </Button>
          </motion.div>
        </div>
      </div>

      {mounted && (
      <Modal
        title={null}
        open={isRfqModalOpen}
        onCancel={() => setIsRfqModalOpen(false)}
        footer={null}
        centered
        width={600}
        styles={{ body: { padding: '40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <ShoppingOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <Title level={3}>YÊU CẦU BÁO GIÁ</Title>
          <Text type="secondary">Sản phẩm: <Text strong style={{ color: '#1890ff' }}>{selectedProduct?.vietnameseName}</Text></Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleRfqSubmit}
          size="large"
        >
          <Form.Item name="productId" hidden><Input /></Form.Item>
          
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                label="Họ và tên" 
                name="customerName" 
                rules={[{ required: true, message: 'Vui lòng nhập tên của bạn' }]}
              >
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item 
                label="Email liên hệ" 
                name="customerEmail" 
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' }
                ]}
              >
                <Input placeholder="example@gmail.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label="Số lượng dự kiến" 
                name="quantity" 
                rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
              >
                <Input type="number" placeholder="100" suffix={selectedProduct?.unitOfMeasure} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số điện thoại" name="customerPhone">
                <Input placeholder="090..." />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Ghi chú thêm" name="note">
                <Input.TextArea rows={4} placeholder="Ví dụ: Cần báo giá CIF cảng Hamburg..." />
              </Form.Item>
            </Col>
          </Row>

          <Button type="primary" block size="large" htmlType="submit" style={{ height: '56px', borderRadius: '12px', fontWeight: 800, marginTop: '16px' }}>
            GỬI YÊU CẦU NGAY
          </Button>
        </Form>
      </Modal>
      )}

      <style jsx global>{`
        .premium-select .ant-select-selector {
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #fff !important;
          border-radius: 12px !important;
        }
        .premium-select .ant-select-selection-placeholder {
          color: rgba(255,255,255,0.4) !important;
        }
        .ant-card-hoverable:hover .product-image {
          transform: scale(1.1);
        }
        .product-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 8, 20, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.4s;
          backdrop-filter: blur(8px);
        }
        .ant-card-hoverable:hover .product-overlay {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default ProductCatalog;
