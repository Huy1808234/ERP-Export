'use client'
import React from 'react';
import { Layout, theme, Typography } from 'antd';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

const { Title, Text } = Typography;

const PortalLayout = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations('Portal');
  const { data: session } = useSession();
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: 'calc(100vh - 100px)', background: '#f8fafc' }}>
      <div style={{ 
        width: '100%',
        marginTop: '100px', // Adjusted for standardized header
        padding: '40px'
      }}>
        {/* Main Content Area - Now full width on Light Gray background */}
        <div style={{ minHeight: '700px' }}>
          {children}
        </div>
      </div>

      <style jsx global>{`
        /* Custom scrollbar for better UX */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Premium AntD Table Overrides */
        .ant-table {
          background: transparent !important;
        }
        .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #475569 !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          font-size: 12px !important;
          letter-spacing: 0.5px !important;
          border-bottom: 2px solid #f1f5f9 !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f8fafc !important;
          padding: 16px 24px !important;
          transition: all 0.3s !important;
        }
        .ant-table-tbody > tr:hover > td {
          background: #f1f5f9 !important;
        }
        
        /* Modern Card Styling */
        .ant-card {
          border-radius: 16px !important;
          border: 1px solid #f1f5f9 !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02) !important;
        }
      `}</style>
    </Layout>
  );
};

export default PortalLayout;
