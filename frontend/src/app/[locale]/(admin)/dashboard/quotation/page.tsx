import QuotationTable from '@/components/admin/quotation/quotation.table';
import AdminPageScroll from '@/components/layout/admin.page-scroll';

const ManageQuotationPage = () => {
  return (
    <AdminPageScroll>
      <QuotationTable />
    </AdminPageScroll>
  );
};

export default ManageQuotationPage;
