'use client'

import { Button, Form, Input, InputNumber, Modal, Select, Switch, notification } from 'antd';
import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';

interface IProps {
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (v: boolean) => void;
  fetchProducts: () => void;
}

const numericFields = [
  'piecesPerCarton',
  'cartonsPerPallet',
  'cbmPerCarton',
  'netWeightPerCarton',
  'grossWeightPerCarton',
  'palletLayers',
  'cartonsPerLayer',
];

const normalizeProductPayload = (values: any) => {
  const payload = { ...values };

  for (const field of numericFields) {
    const value = payload[field];

    if (value === '' || value === null || value === undefined) {
      delete payload[field];
      continue;
    }

    const normalizedValue = Number(value);
    payload[field] = Number.isNaN(normalizedValue) ? undefined : normalizedValue;
  }

  return payload;
};

const mapErrorMessage = (message: any) => {
  if (Array.isArray(message)) return message.join('\n');
  return `${message ?? 'Có lỗi xảy ra'}`;
};

const ProductCreateModal = (props: IProps) => {
  const { isCreateModalOpen, setIsCreateModalOpen, fetchProducts } = props;
  const [form] = Form.useForm();
  const [supplierOptions, setSupplierOptions] = useState<Array<{ label: string; value: string }>>([]);

  const loadSuppliers = async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
      method: 'GET',
      queryParams: {
        current: 1,
        pageSize: 100,
        partnerType: 'SUPPLIER',
      },
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data?.results) {
      setSupplierOptions(
        res.data.results.map((item: any) => ({
          label: `${item.name}${item.taxCode ? ` - ${item.taxCode}` : ''}`,
          value: item._id,
        })),
      );
    }
  };

  useEffect(() => {
    if (isCreateModalOpen) {
      loadSuppliers();
    }
  }, [isCreateModalOpen]);

  const handleCloseCreateModal = () => {
    form.resetFields();
    setIsCreateModalOpen(false);
  };

  const onFinish = async (values: any) => {
    const payload = normalizeProductPayload(values);
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
      method: 'POST',
      body: payload,
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      handleCloseCreateModal();
      fetchProducts();
      notification.success({ message: 'Tạo mới sản phẩm thành công!' });
    } else {
      notification.error({ message: 'Có lỗi xảy ra', description: mapErrorMessage(res.message) });
    }
  };

  return (
    <Modal
      title="Thêm Mới Sản Phẩm"
      open={isCreateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleCloseCreateModal}
      maskClosable={false}
      width={900}
    >
      <Form name="create-product" onFinish={onFinish} layout="vertical" form={form}>
        <Form.Item label="SKU" name="sku" rules={[{ required: true, message: 'Vui lòng nhập SKU!' }]}>
          <Input />
        </Form.Item>

        <Form.Item
          label="Tên tiếng Việt"
          name="vietnameseName"
          rules={[{ required: true, message: 'Vui lòng nhập tên tiếng Việt!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item label="Tên tiếng Anh" name="englishName">
          <Input />
        </Form.Item>

        <Form.Item label="Nhà cung cấp mặc định" name="preferredSupplierId">
          <Select allowClear showSearch options={supplierOptions} placeholder="Chọn nhà cung cấp" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <Form.Item label="HS Code" name="hsCode">
            <Input />
          </Form.Item>
          <Form.Item label="Category" name="category">
            <Input />
          </Form.Item>
          <Form.Item label="Brand" name="brand">
            <Input />
          </Form.Item>
          <Form.Item label="Xuất xứ" name="originCountry">
            <Input />
          </Form.Item>
          <Form.Item label="Đơn vị tính" name="unitOfMeasure">
            <Input />
          </Form.Item>
          <Form.Item label="Kiểu đóng gói" name="packingType">
            <Input />
          </Form.Item>
          <Form.Item label="Số lượng / thùng" name="piecesPerCarton">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Thùng / pallet" name="cartonsPerPallet">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="CBM / thùng" name="cbmPerCarton">
            <InputNumber style={{ width: '100%' }} min={0} step={0.001} />
          </Form.Item>
          <Form.Item label="Net weight / thùng" name="netWeightPerCarton">
            <InputNumber style={{ width: '100%' }} min={0} step={0.001} />
          </Form.Item>
          <Form.Item label="Gross weight / thùng" name="grossWeightPerCarton">
            <InputNumber style={{ width: '100%' }} min={0} step={0.001} />
          </Form.Item>
          <Form.Item label="Số layers/pallet" name="palletLayers">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Thùng / layer" name="cartonsPerLayer">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </div>

        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item label="Kích hoạt" name="isActive" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProductCreateModal;