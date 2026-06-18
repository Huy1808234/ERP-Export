import PartnerTable from '@/components/admin/partner/partner.table';
import AdminPageScroll from '@/components/layout/admin.page-scroll';

type ManagePartnerSearchParams = {
  partner_ref?: string | string[];
  partner_type?: string | string[];
};

type ManagePartnerPageProps = {
  searchParams: Promise<ManagePartnerSearchParams>;
};

const getFirstSearchValue = (value?: string | string[]): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const ManagePartnerPage = async ({ searchParams }: ManagePartnerPageProps) => {
  const query = await searchParams;

  return (
    <AdminPageScroll>
      <PartnerTable
        linkedPartnerRef={getFirstSearchValue(query.partner_ref)}
        linkedPartnerType={getFirstSearchValue(query.partner_type)}
      />
    </AdminPageScroll>
  );
};

export default ManagePartnerPage;
