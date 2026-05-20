import React from 'react';
import { Typography, Space, theme } from 'antd';
import { useTheme } from '@/context/theme.context';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, icon, description, extra }) => {
  const { isDark } = useTheme();
  const { token } = theme.useToken();

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 32,
      padding: '20px 24px',
      background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(12px)',
      borderRadius: 24,
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
      border: isDark ? '1px solid #334155' : '1px solid rgba(255, 255, 255, 0.3)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {icon && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 32, 
            color: token.colorPrimary,
            background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.05)',
            width: 56,
            height: 56,
            borderRadius: 16,
            boxShadow: `0 4px 12px ${token.colorPrimary}20`
          }}>
            {icon}
          </div>
        )}
        <div>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 800, 
            margin: 0, 
            color: isDark ? '#f8fafc' : token.colorText, 
            letterSpacing: -0.5 
          }}>
            {title}
          </h1>
          {description && (
            <Space size={8} style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ 
                fontSize: 13, 
                fontWeight: 500, 
                color: isDark ? '#94a3b8' : undefined 
              }}>
                {description}
              </Text>
            </Space>
          )}
        </div>
      </div>
      
      {extra && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {extra}
        </div>
      )}
    </div>
  );
};
