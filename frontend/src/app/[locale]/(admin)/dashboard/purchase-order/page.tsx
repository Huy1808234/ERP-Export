import { redirect } from 'next/navigation';

const PurchaseOrderLegacyPage = async ({
    params,
}: {
    params: Promise<{ locale: string }>;
}) => {
    const { locale } = await params;
    redirect(`/${locale}/dashboard/purchase-orders`);
};

export default PurchaseOrderLegacyPage;
