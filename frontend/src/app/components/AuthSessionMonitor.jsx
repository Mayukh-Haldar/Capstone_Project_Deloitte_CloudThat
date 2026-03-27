import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { authApi } from "../lib/auth-api";
import { ApiClientError } from "../lib/http-client";
import { clearAuthSession, updateAuthSessionUser, useAuthSession } from "../lib/auth-storage";
export function AuthSessionMonitor() {
    const session = useAuthSession();
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        if (!session?.accessToken || location.pathname === "/auth") {
            return;
        }
        let cancelled = false;
        const redirectToInactiveLogin = () => {
            if (cancelled) {
                return;
            }
            clearAuthSession();
            navigate("/auth?mode=signin&reason=inactive", {
                replace: true,
                state: { from: location.pathname }
            });
        };
        const validateSession = async () => {
            try {
                const freshUser = await authApi.me();
                if (cancelled) {
                    return;
                }
                if (!freshUser.active) {
                    redirectToInactiveLogin();
                    return;
                }
                updateAuthSessionUser(freshUser);
            }
            catch (err) {
                if (err instanceof ApiClientError &&
                    (err.status === 401 || (err.status === 403 && err.code === "AUTH-1002"))) {
                    redirectToInactiveLogin();
                }
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void validateSession();
            }
        };
        void validateSession();
        window.addEventListener("focus", validateSession);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            cancelled = true;
            window.removeEventListener("focus", validateSession);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [location.pathname, navigate, session?.accessToken]);
    return null;
}
