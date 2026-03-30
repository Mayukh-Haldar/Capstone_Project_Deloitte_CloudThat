export const NOTIFICATION_STATE_CHANGED_EVENT = "eventzen:notification-state-changed";
export const NOTIFICATION_RECEIVED_EVENT = "eventzen:notification-received";

export function emitNotificationStateChanged(detail = {}) {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent(NOTIFICATION_STATE_CHANGED_EVENT, { detail }));
}

export function emitNotificationReceived(detail = {}) {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent(NOTIFICATION_RECEIVED_EVENT, { detail }));
}
