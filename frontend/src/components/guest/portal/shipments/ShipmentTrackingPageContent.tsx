'use client';

import React, { useEffect } from 'react';
import { Button, Empty, Input, Space, Skeleton, Card } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import PageBanner from '@/components/guest/PageBanner';
import { useGuestShipments } from '@/hooks/useShipments';
import ShipmentCard from './ShipmentCard';

export default function ShipmentTrackingPageContent() {
  const t = useTranslations('PortalShipments');
  const {
    shipments,
    isLoading,
    search,
    setSearch,
    fetchShipments,
  } = useGuestShipments();

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return (
    <div>
      <div style={{ margin: '-40px -40px 32px -40px', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
        <PageBanner
          title={t('title')}
          subtitle={t('subtitle')}
          height="200px"
          breadcrumbs={[{ title: t('breadcrumb_portal'), href: '/portal' }, { title: t('breadcrumb_shipments') }]}
        >
          <Space style={{ marginTop: 20 }} wrap>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder={t('search_placeholder')}
              style={{ width: 360, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            />
            <Button type="primary" icon={<ReloadOutlined />} onClick={fetchShipments} loading={isLoading} style={{ height: 44, borderRadius: 12 }}>
              {t('refresh_btn')}
            </Button>
          </Space>
        </PageBanner>
      </div>

      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        {isLoading ? (
          <Space orientation="vertical" size={24} style={{ width: '100%' }}>
            {[1, 2].map((i) => (
              <Card key={`skeleton-${i}`} variant="borderless" style={{ background: '#111827', borderRadius: 16 }}>
                <Skeleton active avatar={{ shape: 'square', size: 64 }} paragraph={{ rows: 3 }} />
              </Card>
            ))}
          </Space>
        ) : shipments.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="borderless" style={{ background: '#111827', borderRadius: 16, textAlign: 'center', padding: '60px 20px' }}>
              <Empty 
                description={<span style={{ color: '#9ca3af', fontSize: 16 }}>{t('empty_state')}</span>} 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          </motion.div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}>
            {shipments.map((shipment) => (
              <ShipmentCard key={shipment._id} shipment={shipment} />
            ))}
          </motion.div>
        )}
      </Space>
    </div>
  );
}
