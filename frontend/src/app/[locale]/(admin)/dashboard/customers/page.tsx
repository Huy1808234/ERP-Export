import PartnerTable from '@/components/admin/partner/partner.table';
import AdminPageScroll from '@/components/layout/admin.page-scroll';

type ManageCustomerSearchParams = {
  partner_ref?: string | string[];
};

type ManageCustomerPageProps = {
  searchParams: Promise<ManageCustomerSearchParams>;
};

const getFirstSearchValue = (value?: string | string[]): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const ManageCustomerPage = async ({ searchParams }: ManageCustomerPageProps) => {
  const query = await searchParams;

  return (
    <AdminPageScroll>
      <PartnerTable
        linkedPartnerRef={getFirstSearchValue(query.partner_ref)}
        linkedPartnerType="CUSTOMER"
      />
    </AdminPageScroll>
  );
};

export default ManageCustomerPage;
