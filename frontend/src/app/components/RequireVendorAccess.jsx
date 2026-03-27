import { Navigate, Outlet, useLocation } from "react-router";
import { useAuthSession } from "../lib/auth-storage";
import { getPortalHomePath, getPrimaryPortal } from "../lib/roles";
export function RequireVendorAccess() {
    const session = useAuthSession();
    const location = useLocation();
    if (!session?.accessToken) {
        return <Navigate to="/auth" replace state={{ from: location.pathname }}/>;
    }
    const portal = getPrimaryPortal(session);
    if (portal !== "VENDOR") {
        return <Navigate to={getPortalHomePath(portal)} replace/>;
    }
    return <Outlet />;
}
