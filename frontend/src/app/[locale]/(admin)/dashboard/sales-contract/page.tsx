import SalesContractTable from '@/components/admin/sales-contract/sales-contract.table';

import { useTranslations } from 'next-intl';

const SalesContractPage = () => {
    const t = useTranslations('SalesContract');
    return (
        <div style={{ padding: '24px' }}>
            <SalesContractTable />
        </div>
    );
};

export default SalesContractPage;
