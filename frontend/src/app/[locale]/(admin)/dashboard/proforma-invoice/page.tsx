import ProformaInvoiceTable from '@/components/admin/proforma-invoice/pi.table';
import AdminPageScroll from '@/components/layout/admin.page-scroll';

const ProformaInvoicePage = () => {
  return (
    <AdminPageScroll>
      <ProformaInvoiceTable />
    </AdminPageScroll>
  );
};

export default ProformaInvoicePage;
