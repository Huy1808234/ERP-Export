import Login from "@/components/auth/login";
import { auth } from "@/auth";
import { isStaff } from "@/utils/auth-utils";
import { getPostLoginRedirectPath } from "@/utils/auth-redirect";
import { redirect } from "next/navigation";

type LoginPageProps = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

const getFirstSearchParam = (value?: string | string[]): string | undefined => {
    return Array.isArray(value) ? value[0] : value;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
    const [{ locale }, query] = await Promise.all([params, searchParams]);
    const session = await auth();

    if (session) {
        redirect(getPostLoginRedirectPath({
            callbackUrl: getFirstSearchParam(query.callbackUrl),
            locale,
            isStaffUser: isStaff(session.user),
        }));
    }

    return (
        <Login />
    );
}
