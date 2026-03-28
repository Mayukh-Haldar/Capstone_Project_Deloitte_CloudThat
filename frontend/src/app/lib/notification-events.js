export const NOTIFICATION_STATE_CHANGED_EVENT = "eventzen:notification-state-changed";

export function emitNotificationStateChanged(detail = {}) {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent(NOTIFICATION_STATE_CHANGED_EVENT, { detail }));
}
