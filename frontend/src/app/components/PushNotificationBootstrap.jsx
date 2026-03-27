import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ensurePushToken, subscribeToForegroundPush } from "../lib/firebase-push";
import { notificationApi } from "../lib/notification-api";
import { useAuthSession } from "../lib/auth-storage";
export function PushNotificationBootstrap() {
    const session = useAuthSession();
    const lastTokenRef = useRef(null);
    useEffect(() => {
        if (!session?.accessToken) {
            return;
        }
        let cancelled = false;
        const register = async () => {
            try {
                const token = await ensurePushToken();
                if (!token || cancelled || lastTokenRef.current === token) {
                    return;
                }
                await notificationApi.registerPushToken(token, "web");
                lastTokenRef.current = token;
            }
            catch {
                // Silent fallback: push stays optional if Firebase is not configured or permission is denied.
            }
        };
        void register();
        const unsubscribe = subscribeToForegroundPush((payload) => {
            const notification = (payload.notification || {});
            const title = notification.title || "New notification";
            const body = notification.body || "You have a new EventZen update.";
            if ("Notification" in window && Notification.permission === "granted") {
                const browserNotification = new Notification(title, {
                    body,
                    data: payload.data || {}
                });
                browserNotification.onclick = () => {
                    window.focus();
                    browserNotification.close();
                };
            }
            toast(title, { description: body });
        });
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [session?.accessToken]);
    return null;
}
