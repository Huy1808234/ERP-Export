import ShipmentTable from "@/components/admin/shipment/shipment.table";
import AdminPageScroll from "@/components/layout/admin.page-scroll";
import { auth } from "@/auth";

// Refresh TS Cache

const ShipmentPage = async () => {
    const session = await auth();

    return (
        <AdminPageScroll>
            <ShipmentTable session={session} />
        </AdminPageScroll>
    )
}

export default ShipmentPage;
