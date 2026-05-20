import PurchaseRequestTable from "@/components/admin/purchase-request/purchase-request.table";
import AdminPageScroll from "@/components/layout/admin.page-scroll";

const PurchaseRequestPage = () => {
    return (
        <AdminPageScroll>
            <PurchaseRequestTable />
        </AdminPageScroll>
    )
}

export default PurchaseRequestPage;
