import InventoryLedgerTable from "@/components/admin/inventory/InventoryLedgerTable";
import AdminPageScroll from "@/components/layout/admin.page-scroll";

const InventoryLedgerPage = () => {
    return (
        <AdminPageScroll>
            <InventoryLedgerTable />
        </AdminPageScroll>
    )
}

export default InventoryLedgerPage;
