'use client'

import { Button, Popconfirm, Space, Table, Tag, notification } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import PartnerCreateModal from './partner.create';
import PartnerUpdateModal from './partner.update';

const PartnerTable = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0,
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<any>(null);

  const fetchPartners = async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners`,
      method: 'GET',
      queryParams: {
        current: meta.current,
        pageSize: meta.pageSize,
      },
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      setPartners(res.data.results);
      setMeta({
        current: meta.current,
        pageSize: meta.pageSize,
        pages: res.data.totalPages,
        total: res.data.totalPages * meta.pageSize,
      });
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [meta.current, meta.pageSize]);

  const confirmDelete = async (id: string) => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/partners/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      notification.success({ message: 'Xóa đối tác thành công' });
      fetchPartners();
    } else {
      notification.error({ message: 'Có lỗi xảy ra', description: res.message });
    }
  };

  const columns = [
    { title: 'Tên đối tác', dataIndex: 'name', key: 'name' },
    { title: 'Loại', dataIndex: 'partnerType', key: 'partnerType' },
    { title: 'Người liên hệ', dataIndex: 'contactName', key: 'contactName' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'MST', dataIndex: 'taxCode', key: 'taxCode' },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'blue' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDataUpdate(record);
              setIsUpdateModalOpen(true);
            }}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa không?"
            onConfirm={() => confirmDelete(record._id)}
            okText="Có"
            cancelText="Hủy"
          >
            <Button danger icon={<DeleteOutlined />}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleOnChange = (pagination: any) => {
    if (pagination && pagination.current !== meta.current) {
      setMeta({
        ...meta,
        current: pagination.current,
        pageSize: pagination.pageSize,
      });
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <span>Quản lý Đối tác</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Thêm đối tác
        </Button>
      </div>

      <Table
        rowKey={'_id'}
        bordered
        dataSource={partners}
        columns={columns}
        onChange={handleOnChange}
        pagination={{
          current: meta.current,
          pageSize: meta.pageSize,
          showSizeChanger: true,
          total: meta.total,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
        }}
      />

      <PartnerCreateModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        fetchPartners={fetchPartners}
      />

      <PartnerUpdateModal
        isUpdateModalOpen={isUpdateModalOpen}
        setIsUpdateModalOpen={setIsUpdateModalOpen}
        fetchPartners={fetchPartners}
        dataUpdate={dataUpdate}
        setDataUpdate={setDataUpdate}
      />
    </>
  );
};

export default PartnerTable;