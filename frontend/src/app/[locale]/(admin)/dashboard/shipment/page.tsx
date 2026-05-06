import ShipmentTable from "@/components/admin/shipment/shipment.table";
import { auth } from "@/auth";

// Refresh TS Cache

const ShipmentPage = async () => {
    const session = await auth();

    return (
        <div>
            <ShipmentTable session={session} />
        </div>
    )
}

export default ShipmentPage;
