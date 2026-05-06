import Login from "@/components/auth/login";
import { auth } from "@/auth";

export default async function LoginPage() {
    const session = await auth();
    return (
        <Login />
    );
}
