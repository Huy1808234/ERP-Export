"use client";

import {
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Divider,
  Typography,
  Switch,
  theme,
} from "antd";
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

const { Text } = Typography;

// Định nghĩa Enum UOM theo chuẩn nghiệp vụ ERP trong features.md
export enum UOM {
  PCS = "PCS",       // Miếng/Cái
  KGS = "KGS",       // Kilogram
  TONS = "TONS",     // Tấn
  CARTONS = "CARTONS", // Thùng
  SETS = "SETS",     // Bộ
  BAGS = "BAGS",     // Túi/Bao
  UNITS = "UNITS",   // Cái (Đơn vị chung)
  BOXES = "BOXES",   // Hộp
}

const ProductForm = ({
  form,
  supplierOptions,
  onFinish, // ✅ Đã thêm prop onFinish
}: {
  form: any;
  supplierOptions: any[];
  onFinish: (values: any) => void; // ✅ Khai báo kiểu cho onFinish
}) => {
  const tUom = useTranslations('UOM');
  
  const uomOptions = useMemo(() => {
    return Object.values(UOM).map((v) => ({ 
      label: tUom(v), 
      value: v 
    }));
  }, [tUom]);

  const calculateCBM = () => {
    const {
      cartonLengthCm: l,
      cartonWidthCm: w,
      cartonHeightCm: h,
    } = form.getFieldsValue();
    if (l && w && h) {
      const cbm = (l * w * h) / 1000000;
      form.setFieldsValue({ cbmPerCarton: Number(cbm.toFixed(4)) });
    }
  };

  const { token } = theme.useToken();

  return (
    <Form 
      form={form} 
      layout="vertical" 
      onValuesChange={calculateCBM}
      onFinish={onFinish} // ✅ Gắn hàm xử lý submit vào Form
      onFinishFailed={(errorInfo) => console.log('Lỗi validate Form:', errorInfo)} // Bắt lỗi im lặng
    >
      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          I. THÔNG TIN HÀNG HÓA & HẢI QUAN
        </Text>
      </Divider>

      <Row gutter={16}>
        <Col span={6}>
          <Form.Item
            label="Mã hàng (SKU)"
            name="sku"
            rules={[{ required: true, message: "Vui lòng nhập SKU!" }]}
          >
            <Input placeholder="Ví dụ: VIN-001" />
          </Form.Item>
        </Col>
        <Col span={9}>
          <Form.Item
            label="Tên tiếng Việt"
            name="vietnameseName"
            rules={[{ required: true, message: "Vui lòng nhập tên tiếng Việt!" }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={9}>
          <Form.Item
            label="Tên tiếng Anh (Export)"
            name="englishName"
            rules={[{ required: true, message: "Vui lòng nhập tên tiếng Anh!" }]}
          >
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <Form.Item label="Mã HS Code" name="hsCode">
            <Input placeholder="Tra cứu biểu thuế" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label="Đơn vị tính"
            name="unitOfMeasure"
            rules={[{ required: true, message: "Vui lòng chọn đơn vị tính!" }]}
          >
            <Select
              options={uomOptions}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Nhà cung cấp mặc định" name="preferredSupplierId">
            <Select
              showSearch
              options={supplierOptions}
              placeholder="Chọn nhà cung cấp"
              allowClear
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          II. THÔNG SỐ LOGISTICS (CBM & WEIGHT)
        </Text>
      </Divider>

      <Row gutter={12}>
        <Col span={4}>
          <Form.Item label="Dài (cm)" name="cartonLengthCm">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label="Rộng (cm)" name="cartonWidthCm">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label="Cao (cm)" name="cartonHeightCm">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label="CBM / Thùng"
            name="cbmPerCarton"
            extra="Tự động tính bằng m³"
          >
            <InputNumber
              style={{ width: "100%", backgroundColor: token.colorFillTertiary }}
              readOnly
              precision={4}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="Gross Weight (kg)" name="grossWeightPerCarton">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item 
            label="Số lượng/Thùng (Pcs/Ctn)" 
            name="piecesPerCarton"
            rules={[{ required: true, message: "Nhập số lượng/thùng!" }]}
          >
            <InputNumber style={{ width: "100%" }} min={1} placeholder="Ví dụ: 24" />
          </Form.Item>
        </Col>
      </Row>

      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          III. CHÍNH SÁCH GIÁ
        </Text>
      </Divider>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="Giá mua (VND)" name="purchasePriceVnd">
            <InputNumber
              style={{ width: "100%" }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, "")) as any}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Giá bán xuất khẩu" name="defaultExportPrice">
            <InputNumber
              style={{ width: "100%" }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, "")) as any}
            />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label="Tiền tệ" name="exportCurrency">
            <Select
              options={[
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
                { value: "VND", label: "VND" },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label="Kích hoạt" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};

export default ProductForm;
