import UserTable from "@/components/admin/user/user.table";
import AdminPageScroll from "@/components/layout/admin.page-scroll";

const ManageUserPage = () => {
    return (
        <AdminPageScroll>
            <UserTable />
        </AdminPageScroll>
    )
}

export default ManageUserPage;
