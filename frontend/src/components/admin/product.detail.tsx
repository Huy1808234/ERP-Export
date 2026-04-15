'use client'

import { Descriptions, Modal, Tag } from 'antd';

interface IProps {
  isDetailModalOpen: boolean;
  setIsDetailModalOpen: (v: boolean) => void;
  dataDetail: any;
  setDataDetail: any;
}

const ProductDetailModal = (props: IProps) => {
  const { isDetailModalOpen, setIsDetailModalOpen, dataDetail, setDataDetail } = props;

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setDataDetail(null);
  };

  return (
    <Modal
      title={`Chi tiết sản phẩm: ${dataDetail?.sku ?? ''}`}
      open={isDetailModalOpen}
      onCancel={handleCloseDetailModal}
      onOk={handleCloseDetailModal}
      maskClosable={false}
      width={900}
    >
      <Descriptions bordered column={2} size="middle">
        <Descriptions.Item label="SKU">{dataDetail?.sku ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Tên tiếng Việt">{dataDetail?.vietnameseName ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Tên tiếng Anh">{dataDetail?.englishName ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="HS Code">{dataDetail?.hsCode ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Category">{dataDetail?.category ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Brand">{dataDetail?.brand ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Xuất xứ">{dataDetail?.originCountry ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Đơn vị tính">{dataDetail?.unitOfMeasure ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Kiểu đóng gói">{dataDetail?.packingType ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Số lượng / thùng">{dataDetail?.piecesPerCarton ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Thùng / pallet">{dataDetail?.cartonsPerPallet ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="CBM / thùng">{dataDetail?.cbmPerCarton ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Net weight / thùng">{dataDetail?.netWeightPerCarton ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Gross weight / thùng">{dataDetail?.grossWeightPerCarton ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Số layers/pallet">{dataDetail?.palletLayers ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Thùng / layer">{dataDetail?.cartonsPerLayer ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Nhà cung cấp mặc định" span={2}>
          {dataDetail?.preferredSupplier?.name ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Mô tả" span={2}>{dataDetail?.description ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Ghi chú" span={2}>{dataDetail?.note ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <Tag color={dataDetail?.isActive ? 'blue' : 'default'}>
            {dataDetail?.isActive ? 'Active' : 'Inactive'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Cập nhật lần cuối">
          {dataDetail?.updatedAt ? new Date(dataDetail.updatedAt).toLocaleString('vi-VN') : '-'}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

export default ProductDetailModal;