'use client'

import { App, Button, Card, Col, Divider, Form, Input, Row, Space, Tabs, Typography, Spin, Badge } from 'antd';
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
  ReloadOutlined
} from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getAllSettings } from '@/utils/settings';
import { sendRequest } from '@/utils/api';

const { Title, Text } = Typography;

/**
 * PREMIUM DESIGN UPGRADE:
 * - Implementation of Glassmorphism & Depth
 * - Vibrant Gradient Accents
 * - Modern Sidebar Navigation with Micro-animations
 * - Optimized Visual Hierarchy
 */

interface ISetting {
  key: string;
  value: string;
  description?: string;
}

const SystemSettingsPage = () => {
  const { notification } = App.useApp();
  const { data: session } = useSession();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const fetchSettings = useCallback(async () => {
    const accessToken = session?.user?.access_token;
    if (!accessToken) return;

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
        description: 'Không thể tải cấu hình. Vui lòng kiểm tra lại kết nối.' 
      });
    } finally {
      setLoading(false);
    }
  }, [session, form, notification]);

  useEffect(() => {
    if (session) fetchSettings();
  }, [session, fetchSettings]);

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
          description: 'Hệ thống đã được đồng bộ hóa với cấu hình mới.' 
        });
        fetchSettings();
      } else {
        throw new Error(res?.message || 'API Error');
      }
    } catch (error: any) {
      notification.error({ 
        title: 'Lỗi lưu trữ', 
        description: error.message || 'Không thể áp dụng các thay đổi.' 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ 
      padding: '32px 48px', 
      minHeight: 'calc(100vh - 64px)', 
      background: 'radial-gradient(circle at 10% 20%, rgba(216, 241, 230, 0.46) 0%, rgba(233, 226, 226, 0.28) 90.1%)' 
    }}>
      {/* Premium Header Section */}
      <div style={{ 
        marginBottom: 40, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end',
        position: 'relative'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 14, 
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)'
            }}>
              <SettingOutlined style={{ color: '#fff', fontSize: 24 }} />
            </div>
            <Title level={1} style={{ margin: 0, fontWeight: 900, fontSize: 32, letterSpacing: -1.5, background: 'linear-gradient(90deg, #1e293b, #64748b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Cấu Hình Hệ Thống
            </Title>
          </div>
          <Text style={{ fontSize: 16, color: '#64748b', fontWeight: 500 }}>
            <RocketOutlined style={{ marginRight: 8 }} />
            Nâng cấp doanh nghiệp của bạn với các tham số vận hành chuẩn mực
          </Text>
        </div>

        <Space size="middle">
          <Button 
            size="large" 
            onClick={() => fetchSettings()} 
            disabled={saving || loading}
            icon={<ReloadOutlined />}
            style={{ borderRadius: 12, height: 48, fontWeight: 600, border: '1px solid #e2e8f0', background: '#fff' }}
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
              boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            Áp Dụng Thay Đổi
          </Button>
        </Space>
      </div>

      <Spin spinning={loading} description="Đang đồng bộ hóa dữ liệu từ đám mây...">
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <div style={{ display: 'flex', gap: 32 }}>
            
            {/* Left Sidebar Navigation */}
            <div style={{ width: 300, flexShrink: 0 }}>
              <Card 
                style={{ 
                  borderRadius: 24, 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.03)', 
                  border: '1px solid rgba(255,255,255,0.7)',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px)',
                  padding: 8
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'general', icon: <GlobalOutlined />, label: 'Thông tin chung', color: '#6366f1' },
                    { key: 'banking', icon: <BankOutlined />, label: 'Tài khoản Ngân hàng', color: '#10b981' },
                    { key: 'security', icon: <UnlockOutlined />, label: 'Bảo mật & Phân quyền', color: '#f59e0b' },
                    { key: 'advanced', icon: <SettingOutlined />, label: 'Tùy chọn nâng cao', color: '#64748b' },
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
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: activeTab === item.key ? `linear-gradient(135deg, ${item.color}15 0%, ${item.color}05 100%)` : 'transparent',
                        color: activeTab === item.key ? item.color : '#64748b',
                        border: `1px solid ${activeTab === item.key ? `${item.color}30` : 'transparent'}`,
                        transform: activeTab === item.key ? 'translateX(8px)' : 'none'
                      }}
                    >
                      <div style={{ 
                        fontSize: 20, 
                        display: 'flex',
                        transition: 'all 0.3s',
                        transform: activeTab === item.key ? 'scale(1.2)' : 'scale(1)'
                      }}>
                        {item.icon}
                      </div>
                      <span style={{ fontWeight: activeTab === item.key ? 700 : 500, fontSize: 15 }}>{item.label}</span>
                      {activeTab === item.key && <CheckCircleFilled style={{ marginLeft: 'auto', fontSize: 14 }} />}
                    </div>
                  ))}
                </div>
              </Card>

              <div style={{ marginTop: 24, padding: '0 12px' }}>
                <Card style={{ borderRadius: 20, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: 'none' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Badge status="processing" color="#10b981" />
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>Server Status: Operational</Text>
                   </div>
                   <div style={{ marginTop: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Phiên bản ERP: 2.0.4-Premium</Text>
                   </div>
                </Card>
              </div>
            </div>

            {/* Right Content Area */}
            <div style={{ flex: 1 }}>
              <Card 
                style={{ 
                  borderRadius: 32, 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.04)', 
                  border: '1px solid rgba(255,255,255,0.7)',
                  background: 'rgba(255, 255, 255, 0.6)',
                  backdropFilter: 'blur(30px)',
                  minHeight: 650,
                  padding: '16px 24px'
                }}
              >
                {activeTab === 'general' && (
                  <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                    <Title level={3} style={{ marginBottom: 4, fontWeight: 800 }}>Định danh Doanh nghiệp</Title>
                    <Text type="secondary">Cấu hình thông tin pháp lý được sử dụng cho tất cả chứng từ xuất khẩu.</Text>
                    <Divider style={{ margin: '24px 0' }} />
                    
                    <Row gutter={[32, 32]}>
                      <Col span={24}>
                        <Form.Item 
                          label={<Text strong style={{ fontSize: 15, color: '#334155' }}>Tên công ty (Pháp lý/Tiếng Anh)</Text>} 
                          name="COMPANY_NAME"
                          rules={[{ required: true, message: 'Vui lòng không để trống' }]}
                        >
                          <Input 
                            size="large" 
                            prefix={<GlobalOutlined style={{ color: '#6366f1', marginRight: 8 }} />}
                            placeholder="e.g. ANTIGRAVITY EXPORT CO., LTD" 
                            style={{ 
                              height: 56, 
                              borderRadius: 16, 
                              fontSize: 16,
                              fontWeight: 600,
                              boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
                              border: '1px solid #e2e8f0'
                            }} 
                          />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item 
                          label={<Text strong style={{ fontSize: 15, color: '#334155' }}>Địa chỉ trụ sở chính</Text>} 
                          name="COMPANY_ADDRESS"
                        >
                          <Input.TextArea 
                            rows={4} 
                            placeholder="Nhập địa chỉ đăng ký kinh doanh đầy đủ..." 
                            style={{ 
                              borderRadius: 20, 
                              fontSize: 15,
                              padding: '16px 20px',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
                            }} 
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                )}

                {activeTab === 'banking' && (
                  <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                    <Title level={3} style={{ marginBottom: 4, fontWeight: 800 }}>Tài khoản Thụ hưởng</Title>
                    <Text type="secondary">Thông tin ngân hàng mặc định cho các giao dịch chuyển khoản quốc tế (T/T, L/C).</Text>
                    <Divider style={{ margin: '24px 0' }} />
                    
                    <div style={{ 
                      marginBottom: 24, 
                      padding: '20px 24px', 
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)', 
                      border: '1px solid #bbf7d0', 
                      borderRadius: 20,
                      display: 'flex',
                      gap: 16
                    }}>
                       <div style={{ 
                          width: 40, height: 40, borderRadius: 12, background: '#10b981', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                       }}>
                          <InfoCircleOutlined style={{ color: '#fff', fontSize: 20 }} />
                       </div>
                       <div>
                          <Text strong style={{ color: '#065f46', fontSize: 15 }}>Lưu ý chuyên môn:</Text><br />
                          <Text style={{ color: '#047857' }}>Dữ liệu này sẽ tự động xuất hiện tại chân trang Báo giá & PI. Hãy chia thông tin Bank Name, Account, Swift thành các dòng riêng biệt.</Text>
                       </div>
                    </div>

                    <Form.Item 
                      label={<Text strong style={{ fontSize: 15, color: '#334155' }}>Chi tiết Tài khoản Swift/Bank</Text>} 
                      name="COMPANY_BANK_INFO"
                    >
                      <Input.TextArea 
                        rows={12} 
                        style={{ 
                          borderRadius: 24, 
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
                          fontSize: 14, 
                          padding: 24,
                          lineHeight: 1.8,
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                          background: '#fafafa'
                        }} 
                        placeholder="BANK NAME: ...&#10;BENEFICIARY: ...&#10;ACC NO: ...&#10;SWIFT CODE: ..." 
                      />
                    </Form.Item>
                  </div>
                )}

                {(activeTab === 'security' || activeTab === 'advanced') && (
                  <div style={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    paddingBottom: 100,
                    animation: 'fadeIn 0.5s ease-out'
                  }}>
                    <div style={{ 
                      width: 120, height: 120, borderRadius: 60, background: '#f1f5f9', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24
                    }}>
                      <UnlockOutlined style={{ fontSize: 48, color: '#94a3b8' }} />
                    </div>
                    <Title level={3} style={{ color: '#1e293b', marginBottom: 8 }}>Tính năng đang nâng cấp</Title>
                    <Text style={{ color: '#64748b', fontSize: 16 }}>Phân hệ quản trị nâng cao sẽ khả dụng trong phiên bản Enterprise sắp tới.</Text>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </Form>
      </Spin>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .settings-tabs .ant-tabs-nav {
          display: none !important;
        }

        .ant-form-item-label {
          padding-bottom: 12px !important;
        }

        .ant-input:focus, .ant-input-focused {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1) !important;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default SystemSettingsPage;
