import UserManagementTabs from "@/components/admin/user/user-management.tabs";
import AdminPageScroll from "@/components/layout/admin.page-scroll";

const ManageUserPage = () => {
    return (
        <AdminPageScroll>
            <UserManagementTabs />
        </AdminPageScroll>
    )
}

export default ManageUserPage;
