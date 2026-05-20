import VendorInvoiceTable from "@/components/admin/vendor-invoice/vendor-invoice.table";
import AdminPageScroll from "@/components/layout/admin.page-scroll";

const VendorInvoicePage = () => {
    return (
        <AdminPageScroll>
            <VendorInvoiceTable />
        </AdminPageScroll>
    )
}

export default VendorInvoicePage;
