"use client";

import { Modal, Form } from "antd";
import { notification } from "@/library/antd.static";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { sendRequest } from "@/utils/api";
import ProductForm from './ProductForm';
import { IProduct } from "@/types/product";

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  fetchData: () => void;
  dataUpdate?: IProduct | null;
}

const ProductModal = ({ isOpen, setIsOpen, fetchData, dataUpdate }: IProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const { data: session } = useSession();

  const loadSuppliers = useCallback(async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
      method: "GET",
      queryParams: { pageSize: 100, partnerType: "SUPPLIER" },
      headers: {
        Authorization: `Bearer ${session?.user?.access_token}`,
      },
    });
    if (res?.data) {
      setSuppliers(
        res.data.results.map((s: any) => ({ label: s.name, value: s.id })),
      );
    }
  }, [session]);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      if (dataUpdate) {
        form.setFieldsValue({
          ...dataUpdate,
          preferredSupplierId:
            dataUpdate.preferredSupplier?.id || dataUpdate.preferredSupplierId,
        });
      } else {
        form.resetFields();
      }
    }
  }, [isOpen, dataUpdate, form, loadSuppliers]);

  const onFinish = async (values: any) => {
    const token = session?.user?.access_token;
    if (!token) return;

    setLoading(true);
    const isUpdate = !!dataUpdate?.id;

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products${isUpdate ? `/${dataUpdate.id}` : ""}`,
      method: isUpdate ? "PATCH" : "POST",
      body: { ...values },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res?.data) {
      notification.success({
        title: isUpdate ? "Cập nhật thành công" : "Khởi tạo thành công",
        description: `Sản phẩm ${values.sku} đã được lưu vào hệ thống.`,
      });
      setIsOpen(false);
      fetchData();
    } else {
      notification.error({
        title: "Lỗi xử lý",
        description: Array.isArray(res.message)
          ? res.message.join(", ")
          : res.message,
      });
    }
    setLoading(false);
  };

  return (
    <Modal
      title={
        <span style={{ fontWeight: 700, color: "#1d39c4" }}>
          {dataUpdate
            ? "CHỈNH SỬA THÔNG TIN SẢN PHẨM"
            : "THÊM MỚI SẢN PHẨM ERP"}
        </span>
      }
      open={isOpen}
      onOk={() => form.submit()}
      onCancel={() => setIsOpen(false)}
      confirmLoading={loading}
      width={1000}
      destroyOnHidden
      mask={{ closable: false }}
      okText={dataUpdate ? "Lưu thay đổi" : "Tạo sản phẩm"}
      cancelText="Hủy bỏ"
    >
      {/* ✅ Đã truyền onFinish vào ProductForm */}
      <ProductForm 
        form={form} 
        supplierOptions={suppliers} 
        onFinish={onFinish} 
      />
    </Modal>
  );
};

export default ProductModal;
