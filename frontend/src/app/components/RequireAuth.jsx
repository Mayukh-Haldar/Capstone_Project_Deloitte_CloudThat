import { Navigate, Outlet, useLocation } from "react-router";
import { useAuthSession } from "../lib/auth-storage";
export function RequireAuth() {
    const session = useAuthSession();
    const location = useLocation();
    if (!session?.accessToken || session.user.active === false) {
        return <Navigate to="/auth" replace state={{ from: location.pathname }}/>;
    }
    return <Outlet />;
}
