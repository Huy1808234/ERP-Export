import SalesContractTable from '@/components/admin/sales-contract/sales-contract.table';
import AdminPageScroll from '@/components/layout/admin.page-scroll';

import { useTranslations } from 'next-intl';

const SalesContractPage = () => {
    const t = useTranslations('SalesContract');
    return (
        <AdminPageScroll>
            <SalesContractTable />
        </AdminPageScroll>
    );
};

export default SalesContractPage;
