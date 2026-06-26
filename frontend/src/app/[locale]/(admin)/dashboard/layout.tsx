import AdminContent from '@/components/layout/admin.content';
import AdminFooter from '@/components/layout/admin.footer';
import AdminHeader from '@/components/layout/admin.header';
import AdminSideBar from '@/components/layout/admin.sidebar';
import AdminBreadcrumb from '@/components/layout/admin.breadcrumb';
import { AdminLayoutShell, AdminInnerLayout } from '@/components/layout/admin.layout.shell';
import { AdminContextProvider } from '@/context/admin.context';
import { auth } from '@/auth';

import { redirect } from 'next/navigation';
import { isDashboardUser } from '@/utils/auth-utils';

const AdminLayout = async ({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) => {
    const { locale } = await params;
    const session = await auth();

    // SECURITY CHECK: Must be logged in and have a dashboard-capable role.
    if (!session || session.error === 'RefreshAccessTokenError' || !isDashboardUser(session.user)) {
        redirect(`/${locale}/auth/login`);
    }

    return (
        <AdminContextProvider>
            {/* AdminLayoutShell cung cấp AntD <Layout> để Sider hoạt động đúng */}
            <AdminLayoutShell>
                <AdminSideBar session={session} />
                <AdminInnerLayout>
                    <AdminHeader />
                    <AdminBreadcrumb />
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
