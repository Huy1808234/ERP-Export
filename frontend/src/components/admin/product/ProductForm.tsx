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
  AutoComplete,
  Image,
  Upload,
  Button,
  message,
  Space,
  Alert,
} from "antd";
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { 
  AppstoreOutlined, 
  InfoCircleOutlined, 
  LineChartOutlined, 
  TagsOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import AmountInWords from "@/components/ui/AmountInWords";
import { canReadCostFields } from "@/lib/field-access";

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

interface ProductFormProps {
  form: any;
  supplierOptions: any[];
  categories: any[];
  onFinish: (values: any) => void;
  isUpdate?: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({ form, supplierOptions, categories, onFinish, isUpdate }) => {
  const tUom = useTranslations('UOM');
  const tForm = useTranslations('ProductForm');
  const { token } = theme.useToken();
  const { data: session } = useSession();
  const canViewCost = canReadCostFields(session?.user);
  const [messageApi, contextHolder] = message.useMessage();
  const imageUrl = Form.useWatch('imageUrl', form);
  const purchasePriceVnd = Form.useWatch('purchasePriceVnd', form);
  const defaultExportPrice = Form.useWatch('defaultExportPrice', form);
  const exportCurrency = Form.useWatch('exportCurrency', form) || 'USD';
  
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

  return (
    <Form 
      form={form} 
      layout="vertical" 
      onValuesChange={calculateCBM}
      onFinish={onFinish}
      initialValues={{
        exportCurrency: "USD",
        isActive: true,
      }}
    >
      {contextHolder}
      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          {tForm('sections.info')}
        </Text>
      </Divider>

      <Row gutter={16}>
        <Col span={6}>
          <Form.Item
            label={tForm('fields.sku')}
            name="sku"
            rules={[{ required: true, message: tForm('validations.sku') }]}
          >
            <Input placeholder={tForm('placeholders.sku')} />
          </Form.Item>
        </Col>
        <Col span={9}>
          <Form.Item
            label={tForm('fields.nameVi')}
            name="vietnameseName"
            rules={[{ required: true, message: tForm('validations.nameVi') }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={9}>
          <Form.Item
            label={tForm('fields.nameEn')}
            name="englishName"
            rules={[{ required: true, message: tForm('validations.nameEn') }]}
          >
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <Form.Item label={tForm('fields.hsCode')} name="hsCode">
            <Input placeholder={tForm('placeholders.hsCode')} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={tForm('fields.category')} name="category">
            <Select 
              mode="tags"
              maxCount={1}
              placeholder={tForm('placeholders.category')}
              options={Array.from(new Set(categories
                .filter(c => c && c.name)
                .map(c => c.name)))
                .map(name => ({
                  value: name,
                  label: name
                }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label={tForm('fields.uom')}
            name="unitOfMeasure"
            rules={[{ required: true, message: tForm('validations.uom') }]}
          >
            <Select
              options={uomOptions}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={tForm('fields.supplier')} name="preferredSupplierId">
            <Select
              showSearch
              options={supplierOptions}
              placeholder={tForm('placeholders.supplier')}
              allowClear
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          {tForm('sections.logistics')}
        </Text>
      </Divider>

      <Row gutter={12}>
        <Col span={4}>
          <Form.Item label={tForm('fields.length')} name="cartonLengthCm">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label={tForm('fields.width')} name="cartonWidthCm">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item label={tForm('fields.height')} name="cartonHeightCm">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label={tForm('fields.cbm')}
            name="cbmPerCarton"
            extra={tForm('fields.cbmExtra')}
          >
            <InputNumber
              style={{ width: "100%", backgroundColor: token.colorFillTertiary }}
              readOnly
              precision={4}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={tForm('fields.weight')} name="grossWeightPerCarton">
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item 
            label={tForm('fields.piecesPerCarton')} 
            name="piecesPerCarton"
            rules={[{ required: true, message: tForm('validations.pieces') }]}
          >
            <InputNumber style={{ width: "100%" }} min={1} placeholder={tForm('placeholders.pieces')} />
          </Form.Item>
        </Col>
      </Row>

      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          {tForm('sections.price')}
        </Text>
      </Divider>

      {isUpdate && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Thay đổi giá, HS code, mô tả xuất khẩu hoặc thông số logistics sẽ tạo yêu cầu duyệt"
          description="Dữ liệu nhạy cảm chỉ được áp dụng vào catalog sau khi người có quyền phê duyệt."
        />
      )}

      <Row gutter={16}>
        {canViewCost && (
          <Col span={8}>
            <Form.Item label={tForm('fields.purchasePrice')} name="purchasePriceVnd" style={{ marginBottom: 6 }}>
              <InputNumber
                style={{ width: "100%" }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, "")) as any}
              />
            </Form.Item>
            <AmountInWords amount={purchasePriceVnd} currency="VND" />
          </Col>
        )}
        <Col span={canViewCost ? 8 : 12}>
          <Form.Item label={tForm('fields.exportPrice')} name="defaultExportPrice" style={{ marginBottom: 6 }}>
            <InputNumber
              style={{ width: "100%" }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, "")) as any}
            />
          </Form.Item>
          <AmountInWords amount={defaultExportPrice} currency={exportCurrency} />
        </Col>
        <Col span={canViewCost ? 4 : 6}>
          <Form.Item label={tForm('fields.currency')} name="exportCurrency">
            <Select
              options={[
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" },
                { value: "VND", label: "VND" },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={canViewCost ? 4 : 6}>
          <Form.Item label={tForm('fields.active')} name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Divider titlePlacement="left" plain>
        <Text strong style={{ color: token.colorPrimary }}>
          {tForm('sections.image')}
        </Text>
      </Divider>

      <Row gutter={16} align="top">
        <Col span={18}>
          <Form.Item 
            label={tForm('fields.imageUrl')} 
            help={tForm('fields.imageHelp')}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="imageUrl" noStyle>
                <Input.TextArea 
                  placeholder={tForm('fields.imagePlaceholder')} 
                  autoSize={{ minRows: 2, maxRows: 2 }}
                />
              </Form.Item>
              <Upload
                name="file"
                action="https://api.cloudinary.com/v1_1/dvkyaluhh/image/upload"
                data={{
                  upload_preset: 'ml_default',
                }}
                showUploadList={false}
                onChange={(info) => {
                  const { status, response, name } = info.file;
                  
                  if (status === 'uploading') {
                    form.setFieldsValue({ imageUrl: '...' });
                    return;
                  }
                  
                  if (status === 'done') {
                    const fullUrl = response.secure_url;
                    form.setFieldsValue({ imageUrl: fullUrl });
                    messageApi.success(`${tForm('fields.uploadBtn')} "${name}" OK!`);
                  } else if (status === 'error') {
                    console.error('[Cloudinary] Error Details:', response);
                    form.setFieldsValue({ imageUrl: '' });
                    messageApi.error(`${tForm('fields.uploadBtn')} "${name}" FAIL!`);
                  }
                }}
              >
                <Button icon={<UploadOutlined />} style={{ height: '52px' }}>{tForm('fields.uploadBtn')}</Button>
              </Upload>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={tForm('fields.description')} name="description">
            <Input.TextArea placeholder={tForm('fields.descriptionPlaceholder')} rows={3} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <div style={{ 
            border: `1px dashed ${token.colorBorder}`,
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
            background: token.colorFillAlter,
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' ? (
              <Image
                src={imageUrl}
                alt="Product Preview"
                style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 4 }}
                fallback="https://placehold.co/400?text=No+Image"
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 48, margin: 0 }}>🖼️</p>
                <Text type="secondary">{tForm('fields.noImage')}</Text>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Form>
  );
};

export default ProductForm;
