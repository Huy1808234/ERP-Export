'use client'

import { Button, Popconfirm, Space, Table, Tag, notification } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import ProductCreateModal from './product.create';
import ProductUpdateModal from './product.update';
import ProductDetailModal from './product.detail';

const ProductTable = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [meta, setMeta] = useState({
    current: 1,
    pageSize: 10,
    pages: 0,
    total: 0,
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [dataUpdate, setDataUpdate] = useState<any>(null);
  const [dataDetail, setDataDetail] = useState<any>(null);

  const fetchProducts = async () => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products`,
      method: 'GET',
      queryParams: {
        current: meta.current,
        pageSize: meta.pageSize,
      },
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      setProducts(res.data.results);
      setMeta({
        current: meta.current,
        pageSize: meta.pageSize,
        pages: res.data.totalPages,
        total: res.data.totalPages * meta.pageSize,
      });
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [meta.current, meta.pageSize]);

  const confirmDelete = async (id: string) => {
    const currentSession = await getSession();
    const res = await sendRequest<IBackendRes<any>>({
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/products/${id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${(currentSession as any)?.user?.access_token}` },
    });

    if (res?.data) {
      notification.success({ message: 'Xóa sản phẩm thành công' });
      fetchProducts();
    } else {
      notification.error({ message: 'Có lỗi xảy ra', description: res.message });
    }
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Tên tiếng Việt', dataIndex: 'vietnameseName', key: 'vietnameseName' },
    { title: 'Tên tiếng Anh', dataIndex: 'englishName', key: 'englishName' },
    { title: 'HS Code', dataIndex: 'hsCode', key: 'hsCode' },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'preferredSupplier',
      key: 'preferredSupplier',
      render: (supplier: any) => supplier ? supplier.name : '-',
    },
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
            icon={<EyeOutlined />}
            onClick={() => {
              setDataDetail(record);
              setIsDetailModalOpen(true);
            }}
          >
            Xem
          </Button>
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
        <span>Quản lý Sản phẩm</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Thêm sản phẩm
        </Button>
      </div>

      <Table
        rowKey={'_id'}
        bordered
        dataSource={products}
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

      <ProductCreateModal
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        fetchProducts={fetchProducts}
      />

      <ProductUpdateModal
        isUpdateModalOpen={isUpdateModalOpen}
        setIsUpdateModalOpen={setIsUpdateModalOpen}
        fetchProducts={fetchProducts}
        dataUpdate={dataUpdate}
        setDataUpdate={setDataUpdate}
      />

      <ProductDetailModal
        isDetailModalOpen={isDetailModalOpen}
        setIsDetailModalOpen={setIsDetailModalOpen}
        dataDetail={dataDetail}
        setDataDetail={setDataDetail}
      />
    </>
  );
};

export default ProductTable;