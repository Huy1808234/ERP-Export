'use client'

import { Form, Input, InputNumber, Modal, Select, Switch, notification } from 'antd';
import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';

interface IProps {
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (v: boolean) => void;
  fetchProducts: () => void;
  dataUpdate: any;
  setDataUpdate: any;
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

const parseOptionalNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

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

const ProductUpdateModal = (props: IProps) => {
  const { isUpdateModalOpen, setIsUpdateModalOpen, fetchProducts, dataUpdate, setDataUpdate } = props;
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
    if (isUpdateModalOpen) {
      loadSuppliers();
    }
  }, [isUpdateModalOpen]);

  useEffect(() => {
    if (dataUpdate) {
      form.setFieldsValue({
        sku: dataUpdate.sku,
        vietnameseName: dataUpdate.vietnameseName,
        englishName: dataUpdate.englishName,
        hsCode: dataUpdate.hsCode,
        category: dataUpdate.category,
        brand: dataUpdate.brand,
        originCountry: dataUpdate.originCountry,
        unitOfMeasure: dataUpdate.unitOfMeasure,
        packingType: dataUpdate.packingType,
        piecesPerCarton: parseOptionalNumber(dataUpdate.piecesPerCarton),
        cartonsPerPallet: parseOptionalNumber(dataUpdate.cartonsPerPallet),
        cbmPerCarton: parseOptionalNumber(dataUpdate.cbmPerCarton),
        netWeightPerCarton: parseOptionalNumber(dataUpdate.netWeightPerCarton),
        grossWeightPerCarton: parseOptionalNumber(dataUpdate.grossWeightPerCarton),
        palletLayers: parseOptionalNumber(dataUpdate.palletLayers),
        cartonsPerLayer: parseOptionalNumber(dataUpdate.cartonsPerLayer),
        description: dataUpdate.description,
        note: dataUpdate.note,
        isActive: dataUpdate.isActive,
        preferredSupplierId: dataUpdate.preferredSupplier?._id ?? dataUpdate.preferredSupplierId,
      });
    }
  }, [dataUpdate]);

  const handleCloseUpdateModal = () => {
    form.resetFields();
    setIsUpdateModalOpen(false);
    setDataUpdate(null);
  };

  const onFinish = async (values: any) => {
    if (!dataUpdate?._id) return;

    const payload = normalizeProductPayload(values);

    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/${dataUpdate._id}`,
      method: 'PATCH',
      body: {
        _id: dataUpdate._id,
        ...payload,
      },
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      handleCloseUpdateModal();
      fetchProducts();
      notification.success({ message: 'Cập nhật sản phẩm thành công!' });
    } else {
      notification.error({ message: 'Có lỗi xảy ra', description: mapErrorMessage(res.message) });
    }
  };

  return (
    <Modal
      title={`Chỉnh sửa: ${dataUpdate?.sku ?? ''}`}
      open={isUpdateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleCloseUpdateModal}
      maskClosable={false}
      width={900}
    >
      <Form name="update-product" onFinish={onFinish} layout="vertical" form={form}>
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

        <Form.Item label="Kích hoạt" name="isActive" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProductUpdateModal;