'use client';

import React from 'react';
import { Modal, Descriptions, Tag, Typography, Divider, Space, Card, Row, Col, Statistic, theme, Button } from 'antd';
import { useTranslations } from 'next-intl';
import { 
  FileDoneOutlined, CalendarOutlined, 
  UserOutlined, DollarOutlined, 
  NumberOutlined, InfoCircleOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  FilePdfOutlined, PaperClipOutlined,
  TagsOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { IVendorInvoice } from '@/types/vendor-invoice';
import { formatDate, formatVND } from '@/utils/format';
import { useTheme } from '@/context/theme.context';

const { Text, Title } = Typography;

interface IProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  data: IVendorInvoice | null;
}

const VendorInvoiceDetailModal = (props: IProps) => {
  const t = useTranslations('VendorInvoice');
  const { isDark } = useTheme();
  const { isOpen, setIsOpen, data } = props;

  const getStatusTag = (status: string | undefined) => {
      if (status === 'PAID') return <Tag icon={<CheckCircleOutlined />} color="success">{t('status.PAID')}</Tag>;
      if (status === 'CANCELLED') return <Tag icon={<CheckCircleOutlined />} color="error">{t('status.CANCELLED')}</Tag>;
      return <Tag icon={<ClockCircleOutlined />} color="warning">{t('status.PENDING')}</Tag>;
  };

  return (
    <Modal
      title={
        <Space size="middle">
          <div style={{ 
            width: 40, height: 40, borderRadius: 12, 
            background: 'linear-gradient(135deg, #001529 0%, #002140 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <FileDoneOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: isDark ? '#fff' : '#262626', lineHeight: 1.2 }}>
                Chi Tiết Hóa Đơn Nhà Cung Cấp
            </div>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Số HĐ: <Text strong>{data?.invoiceNumber}</Text> | Tham chiếu PO: <Text strong>{data?.purchaseOrder?.poNumber}</Text></Text>
          </div>
        </Space>
      }
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      footer={null}
      width={700}
      style={{ top: 60 }}
      styles={{
        header: { padding: '20px 24px', borderBottom: '1px solid #f0f0f0' },
        body: { padding: '24px', background: isDark ? '#141414' : '#f8f9fa' }
      }}
    >
      <Row gutter={[24, 24]}>
          <Col span={24}>
              <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ 
                        padding: '24px', 
                        background: isDark ? '#001529' : 'linear-gradient(135deg, #001529 0%, #003a8c 100%)', 
                        color: '#fff',
                        borderRadius: 12,
                        marginBottom: 24,
                        textAlign: 'center'
                    }}>
                        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Tổng tiền thanh toán</Text>
                        <div style={{ fontSize: 42, fontWeight: 900, marginTop: 8 }}>{formatVND(data?.totalAmount || 0)}</div>
                        <div style={{ marginTop: 12 }}>
                            {getStatusTag(data?.status)}
                        </div>
                    </div>

                   <Descriptions 
                        column={2} 
                        size="middle" 
                        bordered={false} 
                        styles={{ label: { color: '#8c8c8c', fontWeight: 500 } }}
                     >
                        <Descriptions.Item label={<Space><CalendarOutlined />Ngày hóa đơn</Space>}>
                            <Text strong>{formatDate(data?.invoiceDate || '')}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label={<Space><ClockCircleOutlined />Hạn thanh toán</Space>}>
                            <Text strong style={{ color: '#f5222d' }}>{data?.dueDate ? formatDate(data.dueDate) : '---'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label={<Space><UserOutlined />Nhà cung cấp</Space>} span={2}>
                            <Text strong style={{ fontSize: 16 }}>{data?.vendor?.name}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label={<Space><TagsOutlined />Ký hiệu hóa đơn</Space>}>
                            <Text strong>{data?.invoiceSeries || '---'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label={<Space><NumberOutlined />Số hóa đơn GTGT</Space>}>
                            <Text strong>{data?.invoiceNumber}</Text>
                        </Descriptions.Item>
                   </Descriptions>
              </Card>

              <Card 
                variant="borderless" 
                title={<Space><PaperClipOutlined /> Chứng từ đính kèm</Space>} 
                style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: 24 }}
              >
                  {data?.attachments && data.attachments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data.attachments.map((item, index) => (
                          <div
                            key={index}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: isDark ? '#1f1f1f' : '#f5f5f5',
                              borderRadius: 8,
                            }}
                          >
                            <Space>
                                <FilePdfOutlined style={{ color: '#f5222d' }} />
                                <Text style={{ fontSize: 13 }}>{item.split('/').pop()}</Text>
                            </Space>
                            <Button type="link" size="small" icon={<EyeOutlined />}>Xem</Button>
                          </div>
                        ))}
                      </div>
                  ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
                          <Text type="secondary" italic>Không có tệp đính kèm nào.</Text>
                      </div>
                  )}
              </Card>

              {data?.note && (
                  <Card variant="borderless" style={{ borderRadius: 16, background: '#fffbe6', border: '1px solid #ffe58f', marginTop: 24 }}>
                      <Space align="start">
                        <InfoCircleOutlined style={{ color: '#faad14', marginTop: 4 }} />
                        <div>
                            <Text strong>Ghi chú:</Text>
                            <div style={{ color: '#595959', marginTop: 4 }}>{data.note}</div>
                        </div>
                      </Space>
                  </Card>
              )}
          </Col>
      </Row>
    </Modal>
  );
};

export default VendorInvoiceDetailModal;
