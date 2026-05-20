'use client'
import React from 'react';
import { Card, Descriptions, Tag, Typography, Row, Col, Divider, Space, Button } from 'antd';
import { EditOutlined, SafetyCertificateOutlined, VerifiedOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ProfilePage = () => {
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Hồ sơ Công ty</Title>
          <Text type="secondary">Quản lý thông tin doanh nghiệp và trạng thái xác thực</Text>
        </div>
        <Button icon={<EditOutlined />}>Cập nhật thông tin</Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={16}>
          <Card variant="borderless" title="Thông tin chung" style={{ height: '100%' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Tên công ty" span={2}>
                <Text strong>CÔNG TY TNHH XUẤT NHẬP KHẨU AN VÕ</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế">0102345678</Descriptions.Item>
              <Descriptions.Item label="Ngày thành lập">12/08/2015</Descriptions.Item>
              <Descriptions.Item label="Người đại diện">Võ Phan An</Descriptions.Item>
              <Descriptions.Item label="Chức vụ">Giám đốc điều hành</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>
                Số 123, Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh, Việt Nam
              </Descriptions.Item>
              <Descriptions.Item label="Lĩnh vực">Thương mại Nông sản & Logistics</Descriptions.Item>
              <Descriptions.Item label="Quy mô">50 - 100 nhân sự</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={8}>
          <Card variant="borderless" title="Trạng thái xác thực" style={{ height: '100%', textAlign: 'center' }}>
            <div style={{ padding: '20px 0' }}>
              <VerifiedOutlined style={{ fontSize: 64, color: '#10b981' }} />
              <Title level={4} style={{ marginTop: 16, color: '#10b981' }}>ĐÃ XÁC THỰC</Title>
              <Text type="secondary">Tài khoản đối tác cấp Gold</Text>
            </div>
            <Divider />
            <Space orientation="vertical" style={{ width: '100%', textAlign: 'left' }}>
              <Space><SafetyCertificateOutlined style={{ color: '#3b82f6' }} /> Giấy phép kinh doanh: <Tag color="green">Hợp lệ</Tag></Space>
              <Space><SafetyCertificateOutlined style={{ color: '#3b82f6' }} /> Chứng nhận ISO 9001: <Tag color="green">Hợp lệ</Tag></Space>
              <Space><SafetyCertificateOutlined style={{ color: '#3b82f6' }} /> Hồ sơ năng lực: <Tag color="green">Đã duyệt</Tag></Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" title="Thông tin liên hệ kinh doanh">
        <Descriptions column={2}>
          <Descriptions.Item label="Email doanh nghiệp">contact@anvo-export.com</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">(+84) 28 3823 4567</Descriptions.Item>
          <Descriptions.Item label="Website">www.anvo-export.com</Descriptions.Item>
          <Descriptions.Item label="Phòng ban phụ trách">Phòng Thu mua Quốc tế</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
};

export default ProfilePage;
