'use client'

import { Form, Input, Modal, Select, Switch, notification } from 'antd';
import { useEffect } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';

interface IProps {
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (v: boolean) => void;
  fetchPartners: () => void;
  dataUpdate: any;
  setDataUpdate: any;
}

const partnerTypeOptions = [
  { value: 'CUSTOMER', label: 'CUSTOMER' },
  { value: 'SUPPLIER', label: 'SUPPLIER' },
  { value: 'LOGISTICS', label: 'LOGISTICS' },
];

const PartnerUpdateModal = (props: IProps) => {
  const { isUpdateModalOpen, setIsUpdateModalOpen, fetchPartners, dataUpdate, setDataUpdate } = props;
  const [form] = Form.useForm();

  useEffect(() => {
    if (dataUpdate) {
      form.setFieldsValue({
        name: dataUpdate.name,
        partnerType: dataUpdate.partnerType,
        contactName: dataUpdate.contactName,
        email: dataUpdate.email,
        phone: dataUpdate.phone,
        address: dataUpdate.address,
        taxCode: dataUpdate.taxCode,
        website: dataUpdate.website,
        note: dataUpdate.note,
        isActive: dataUpdate.isActive,
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

    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${dataUpdate._id}`,
      method: 'PATCH',
      body: { _id: dataUpdate._id, ...values },
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      handleCloseUpdateModal();
      fetchPartners();
      notification.success({ message: 'Cập nhật đối tác thành công!' });
    } else {
      notification.error({ message: 'Có lỗi xảy ra', description: res.message });
    }
  };

  return (
    <Modal
      title={`Chỉnh sửa: ${dataUpdate?.name ?? ''}`}
      open={isUpdateModalOpen}
      onOk={() => form.submit()}
      onCancel={handleCloseUpdateModal}
      maskClosable={false}
      width={800}
    >
      <Form name="update-partner" onFinish={onFinish} layout="vertical" form={form}>
        <Form.Item
          label="Tên đối tác"
          name="name"
          rules={[{ required: true, message: 'Vui lòng nhập tên đối tác!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Loại đối tác"
          name="partnerType"
          rules={[{ required: true, message: 'Vui lòng chọn loại đối tác!' }]}
        >
          <Select options={partnerTypeOptions} />
        </Form.Item>

        <Form.Item label="Người liên hệ" name="contactName">
          <Input />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <Form.Item label="Email" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="Số điện thoại" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="Mã số thuế" name="taxCode">
            <Input />
          </Form.Item>
          <Form.Item label="Website" name="website">
            <Input />
          </Form.Item>
        </div>

        <Form.Item label="Địa chỉ" name="address">
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

export default PartnerUpdateModal;