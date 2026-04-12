import Login from "@/components/auth/login";
import { auth } from "@/auth";
const LoginPage = async() => {
    const session = await auth();
    console.log("Session in LoginPage:", session);
    return (
        <Login />
    )
}

export default LoginPage;