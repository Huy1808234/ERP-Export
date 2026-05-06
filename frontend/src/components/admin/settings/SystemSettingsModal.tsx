'use client'

import { App, Button, Card, Col, Divider, Form, Input, Row, Space, Tabs, Typography, Spin, Badge, Modal } from 'antd';
import { 
  SettingOutlined, 
  BankOutlined, 
  EnvironmentOutlined, 
  SaveOutlined, 
  GlobalOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  UnlockOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getAllSettings } from '@/utils/settings';
import { sendRequest } from '@/utils/api';

const { Title, Text } = Typography;

/**
 * PREMIUM SYSTEM SETTINGS MODAL
 * A full-screen, high-end management interface triggered globally.
 */

interface IProps {
    open: boolean;
    onClose: () => void;
}

interface ISetting {
  key: string;
  value: string;
  description?: string;
}

const SystemSettingsModal = ({ open, onClose }: IProps) => {
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const fetchSettings = useCallback(async () => {
    const accessToken = session?.user?.access_token;
    if (!accessToken || !open) return;

    setLoading(true);
    try {
      const data = await getAllSettings(accessToken);
      const formData: Record<string, string> = {};
      data.forEach((s: ISetting) => {
        formData[s.key] = s.value;
      });
      form.setFieldsValue(formData);
    } catch (error) {
      notification.error({ 
        title: 'Lỗi hệ thống', 
        description: 'Không thể tải cấu hình.' 
      });
    } finally {
      setLoading(false);
    }
  }, [session, form, notification, open]);

  useEffect(() => {
    if (open) fetchSettings();
  }, [open, fetchSettings]);

  const onFinish = async (values: Record<string, string>) => {
    const accessToken = session?.user?.access_token;
    if (!accessToken) return;

    setSaving(true);
    try {
      const settingsToUpdate = Object.entries(values).map(([key, value]) => ({
        key,
        value: value || ''
      }));

      const res = await sendRequest<IBackendRes<any>>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/settings/bulk`,
        method: 'POST',
        body: { settings: settingsToUpdate },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res?.data) {
        notification.success({ 
          title: 'Cập nhật thành công', 
          description: 'Cấu hình hệ thống đã được đồng bộ.' 
        });
        fetchSettings();
      } else {
        throw new Error(res?.message || 'API Error');
      }
    } catch (error: any) {
      notification.error({ 
        title: 'Lỗi lưu trữ', 
        description: error.message || 'Không thể áp dụng thay đổi.' 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width="100%"
        centered
        closeIcon={null}
        styles={{ 
            mask: { backdropFilter: 'blur(20px)', background: 'rgba(15, 23, 42, 0.4)' },
            body: { padding: 0, height: '90vh', overflow: 'hidden' },
        }}
        style={{ borderRadius: 32, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', padding: 0 }}
        transitionName="ant-zoom-big"
    >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Modal Header */}
            <div style={{ 
                padding: '24px 40px', 
                background: '#fff', 
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ 
                        width: 44, height: 44, borderRadius: 12, 
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.3)'
                    }}>
                        <SettingOutlined style={{ color: '#fff', fontSize: 22 }} />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Cấu Hình Hệ Thống</Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>Quản trị vận hành Premium ERP</Text>
                    </div>
                </div>
                
                <Space size="middle">
                    <Button 
                        size="large" 
                        onClick={() => fetchSettings()} 
                        disabled={saving || loading}
                        icon={<ReloadOutlined />}
                        style={{ borderRadius: 12, border: 'none', background: '#f8fafc' }}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<SaveOutlined />} 
                        loading={saving}
                        onClick={() => form.submit()}
                        style={{ 
                            borderRadius: 12, 
                            height: 48, 
                            padding: '0 32px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)'
                        }}
                    >
                        Lưu Thay Đổi
                    </Button>
                    <Divider orientation="vertical" style={{ height: 32, margin: '0 8px' }} />
                    <Button 
                        icon={<CloseOutlined />} 
                        onClick={onClose} 
                        style={{ 
                            borderRadius: 12, 
                            width: 44, height: 44, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none', background: '#fee2e2', color: '#ef4444'
                        }} 
                    />
                </Space>
            </div>

            {/* Modal Body with Sidebar */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} style={{ display: 'flex', width: '100%' }}>
                    
                    {/* Left Sidebar */}
                    <div style={{ 
                        width: 300, 
                        background: '#f8fafc', 
                        borderRight: '1px solid #f1f5f9',
                        padding: '32px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                    }}>
                        {[
                            { key: 'general', icon: <GlobalOutlined />, label: 'Thông tin chung', color: '#6366f1' },
                            { key: 'banking', icon: <BankOutlined />, label: 'Tài khoản Ngân hàng', color: '#10b981' },
                            { key: 'security', icon: <UnlockOutlined />, label: 'Bảo mật', color: '#f59e0b' },
                            { key: 'advanced', icon: <SettingOutlined />, label: 'Nâng cao', color: '#64748b' },
                        ].map(item => (
                            <div 
                                key={item.key}
                                onClick={() => setActiveTab(item.key)}
                                style={{ 
                                    padding: '16px 20px', 
                                    borderRadius: 16, 
                                    cursor: 'pointer',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 14,
                                    transition: 'all 0.3s',
                                    background: activeTab === item.key ? '#fff' : 'transparent',
                                    color: activeTab === item.key ? item.color : '#64748b',
                                    boxShadow: activeTab === item.key ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                    transform: activeTab === item.key ? 'translateX(10px)' : 'none'
                                }}
                            >
                                <div style={{ fontSize: 18 }}>{item.icon}</div>
                                <span style={{ fontWeight: activeTab === item.key ? 700 : 500 }}>{item.label}</span>
                                {activeTab === item.key && <Badge status="processing" color={item.color} style={{ marginLeft: 'auto' }} />}
                            </div>
                        ))}
                        
                        <div style={{ marginTop: 'auto', padding: '16px', background: '#1e293b', borderRadius: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <RocketOutlined style={{ color: '#3b82f6' }} />
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>ERP Premium v2.0</Text>
                            </div>
                        </div>
                    </div>

                    {/* Right Content */}
                    <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto', background: '#fff' }}>
                        <Spin spinning={loading}>
                            {activeTab === 'general' && (
                                <div style={{ animation: 'fadeIn 0.4s' }}>
                                    <Title level={3} style={{ fontWeight: 800 }}>Thông tin Doanh nghiệp</Title>
                                    <Text type="secondary">Cập nhật tên pháp lý và địa chỉ trụ sở chính của công ty bạn.</Text>
                                    <Divider style={{ margin: '32px 0' }} />
                                    
                                    <Row gutter={[24, 24]}>
                                        <Col span={24}>
                                            <Form.Item label={<Text strong>Tên công ty (Official Name)</Text>} name="COMPANY_NAME">
                                                <Input size="large" style={{ borderRadius: 12, height: 50 }} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={24}>
                                            <Form.Item label={<Text strong>Địa chỉ trụ sở chính</Text>} name="COMPANY_ADDRESS">
                                                <Input.TextArea rows={4} style={{ borderRadius: 16 }} />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            )}

                            {activeTab === 'banking' && (
                                <div style={{ animation: 'fadeIn 0.4s' }}>
                                    <Title level={3} style={{ fontWeight: 800 }}>Tài khoản Ngân hàng</Title>
                                    <Text type="secondary">Dùng cho các chứng từ xuất khẩu (Quotation, PI, CI).</Text>
                                    <Divider style={{ margin: '32px 0' }} />
                                    
                                    <Form.Item label={<Text strong>Chi tiết Swift / Bank / Account</Text>} name="COMPANY_BANK_INFO">
                                        <Input.TextArea 
                                            rows={14} 
                                            style={{ 
                                                borderRadius: 20, 
                                                background: '#f8fafc', 
                                                padding: 24, 
                                                fontFamily: 'monospace',
                                                fontSize: 14,
                                                lineHeight: 1.8
                                            }} 
                                        />
                                    </Form.Item>
                                </div>
                            )}

                            {(activeTab === 'security' || activeTab === 'advanced') && (
                                <div style={{ 
                                    height: '50vh', display: 'flex', flexDirection: 'column', 
                                    alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.4s' 
                                }}>
                                    <UnlockOutlined style={{ fontSize: 64, color: '#e2e8f0', marginBottom: 24 }} />
                                    <Title level={4} style={{ color: '#cbd5e1' }}>Đang phát triển...</Title>
                                </div>
                            )}
                        </Spin>
                    </div>
                </Form>
            </div>
        </div>

        <style jsx global>{`
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .ant-modal-mask {
                backdrop-filter: blur(20px) !important;
            }
        `}</style>
    </Modal>
  );
};

export default SystemSettingsModal;
