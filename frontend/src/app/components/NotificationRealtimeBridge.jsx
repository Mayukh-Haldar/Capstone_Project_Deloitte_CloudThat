import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAuthSession } from "../lib/auth-storage";
import { NOTIFICATION_SERVICE_BASE_URL } from "../lib/api-config";
import { emitNotificationReceived, emitNotificationStateChanged } from "../lib/notification-events";

const SOCKET_PATH = "/socket.io";

export function NotificationRealtimeBridge() {
    const session = useAuthSession();
    const userId = session?.user?.id;

    useEffect(() => {
        if (!userId) {
            return undefined;
        }

        const socket = io(NOTIFICATION_SERVICE_BASE_URL || undefined, {
            path: SOCKET_PATH,
            transports: ["websocket", "polling"]
        });

        const joinUserRoom = () => {
            socket.emit("notification.join", userId);
        };

        socket.on("connect", joinUserRoom);
        socket.on("notification.received", (notification) => {
            emitNotificationReceived(notification);
            emitNotificationStateChanged({
                id: notification?.id,
                received: true,
                read: false
            });
        });

        if (socket.connected) {
            joinUserRoom();
        }

        return () => {
            socket.off("connect", joinUserRoom);
            socket.disconnect();
        };
    }, [userId]);

    return null;
}
