"use client";

import { Modal, Form } from "antd";
import { notification } from "@/providers/antd-static";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { sendRequest } from "@/lib/api-client";
import ProductForm from './ProductForm';
import { IProduct } from "@/types/product";
import { categoryService } from "@/services/category.service";
import { useTranslations } from "next-intl";
import { getAccessToken } from '@/lib/auth-token';
import { canReadCostFields, sanitizeCostPayload } from "@/lib/field-access";

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  fetchData: () => void;
  dataUpdate?: IProduct | null;
  categories: any[];
}

const ProductModal = ({ isOpen, setIsOpen, fetchData, dataUpdate, categories }: IProps) => {
  const t = useTranslations('ProductModal');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const { data: session } = useSession();
  const canViewCost = canReadCostFields(session?.user);
  const router = useRouter();

  const loadSuppliers = useCallback(async () => {
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
      method: "GET",
      queryParams: { pageSize: 100, partnerType: "SUPPLIER" },
      headers: {
        Authorization: `Bearer ${getAccessToken(session)}`,
      },
    });
    if (res?.data) {
      setSuppliers(
        res.data.results.map((s: any) => ({ label: s.name, value: s._id })),
      );
    }
  }, [session]);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      if (dataUpdate) {
        form.setFieldsValue({
          ...dataUpdate,
          category: dataUpdate.category ? [dataUpdate.category] : [],
          imageUrl: (dataUpdate.imageUrl === 'null' || dataUpdate.imageUrl === 'undefined') ? undefined : dataUpdate.imageUrl,
          preferredSupplierId:
            dataUpdate.preferredSupplier?._id || dataUpdate.preferredSupplierId,
        });
      } else {
        form.resetFields();
      }
    }
  }, [isOpen, dataUpdate, form, loadSuppliers]);

  const onFinish = async (values: any) => {
    const token = getAccessToken(session);
    if (!token) return;

    setLoading(true);
    const isUpdate = !!dataUpdate?._id;

    const rawBody = { ...values };
    if (Array.isArray(rawBody.category)) {
      rawBody.category = rawBody.category[0];
    }
    const body = sanitizeCostPayload(rawBody, canViewCost);

    // Senior: Tự động kiểm tra và tạo danh mục mới nếu chưa tồn tại trong DB
    if (body.category) {
      const categoryName = body.category.trim();
      const isExisting = categories.some(c => c.name.toLowerCase() === categoryName.toLowerCase());

      if (!isExisting && categoryName !== "") {
        const catRes = await categoryService.createCategory(categoryName, token);

        if (catRes?.data) {
          notification.success({
            title: t('notifications.newCategoryTitle'),
            description: t('notifications.newCategoryDesc', { name: categoryName }),
          });
          router.refresh();
        } else {
          console.error("[Auto-Sync] Failed to create category:", catRes);
          notification.warning({
            title: t('notifications.categoryWarning'),
            description: t('notifications.categoryWarningDesc', { name: categoryName, error: catRes?.message || '---' }),
          });
        }
      }
    }

    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products${isUpdate ? `/${dataUpdate._id}` : ""}`,
      method: isUpdate ? "PATCH" : "POST",
      body,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res?.data) {
      if (res.data.requiresApproval) {
        notification.info({
          title: "Đã tạo yêu cầu duyệt thay đổi sản phẩm",
          description: `Các thay đổi nhạy cảm sẽ được áp dụng sau khi duyệt: ${res.data.changeRequest?.requestNumber || values.sku}`,
        });
      } else {
      notification.success({
        title: isUpdate ? t('notifications.updateSuccess') : t('notifications.createSuccess'),
        description: t('notifications.saveDesc', { sku: values.sku }),
      });
      }
      setIsOpen(false);
      fetchData();
      router.refresh(); // Đảm bảo danh mục mới xuất hiện ở mọi nơi
    } else {
      notification.error({
        title: t('notifications.errorTitle'),
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
            ? t('titleEdit')
            : t('titleCreate')}
        </span>
      }
      open={isOpen}
      onOk={() => form.submit()}
      onCancel={() => setIsOpen(false)}
      confirmLoading={loading}
      width={1000}
      destroyOnHidden
      mask={{ closable: false }}
      okText={dataUpdate ? t('update') : t('save')}
      cancelText={t('cancel')}
    >
      {/* ✅ Đã truyền onFinish và categories vào ProductForm */}
      <ProductForm
        form={form}
        supplierOptions={suppliers}
        categories={categories}
        onFinish={onFinish}
        isUpdate={!!dataUpdate}
      />
    </Modal>
  );
};

export default ProductModal;
