import AdminContent from '@/components/layout/admin.content';
import AdminFooter from '@/components/layout/admin.footer';
import AdminHeader from '@/components/layout/admin.header';
import AdminSideBar from '@/components/layout/admin.sidebar';
import { AdminLayoutShell, AdminInnerLayout } from '@/components/layout/admin.layout.shell';
import { AdminContextProvider } from '@/library/admin.context';
import { auth } from '@/auth';

const AdminLayout = async ({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) => {
    const session = await auth();
    return (
        <AdminContextProvider>
            {/* AdminLayoutShell cung cấp AntD <Layout> để Sider hoạt động đúng */}
            <AdminLayoutShell>
                <AdminSideBar />
                <AdminInnerLayout>
                    <AdminHeader session={session} />
                    <AdminContent>
                        {children}
                    </AdminContent>
                    <AdminFooter />
                </AdminInnerLayout>
            </AdminLayoutShell>
        </AdminContextProvider>
    )
}

export default AdminLayout