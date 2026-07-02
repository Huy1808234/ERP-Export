'use client';

import { OverviewPage } from '@/components/admin/portal/pages/OverviewPage';
import { OrdersPage } from '@/components/admin/portal/pages/OrdersPage';
import { ProductsPage } from '@/components/admin/portal/pages/ProductsPage';
import { FinancePage } from '@/components/admin/portal/pages/FinancePage';
import { ShipmentsPage } from '@/components/admin/portal/pages/ShipmentsPage';
import type { CustomerPortalPageProps } from '@/components/admin/portal/_shared/constants';

const CustomerPortalPage = ({ view }: CustomerPortalPageProps) => {
  if (view === 'products') return <ProductsPage />;
  if (view === 'orders') return <OrdersPage />;
  if (view === 'finance') return <FinancePage />;
  if (view === 'shipments') return <ShipmentsPage />;
  if (view === 'settings') return <OverviewPage />;
  if (view === 'tickets') return <OverviewPage />;
  return <OverviewPage />;
};

export default CustomerPortalPage;