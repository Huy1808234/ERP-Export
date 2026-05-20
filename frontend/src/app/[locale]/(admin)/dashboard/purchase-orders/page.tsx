import PurchaseOrderTable from "@/components/admin/purchase-order/purchase-order.table";
import AdminPageScroll from "@/components/layout/admin.page-scroll";

const PurchaseOrdersPage = () => {
    return (
        <AdminPageScroll>
            <PurchaseOrderTable />
        </AdminPageScroll>
    );
};

export default PurchaseOrdersPage;
