import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, ExternalLink, Mail, MessageSquare, Smartphone, Trash2, X } from "lucide-react";
import { PageNavigation } from "../components/PageNavigation";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ApiClientError } from "../lib/http-client";
import { notificationApi } from "../lib/notification-api";
import { emitNotificationStateChanged, NOTIFICATION_RECEIVED_EVENT } from "../lib/notification-events";

const channelMeta = {
    EMAIL: { label: "Email", icon: Mail },
    SMS: { label: "SMS", icon: MessageSquare },
    PUSH: { label: "Push", icon: Smartphone },
    IN_APP: { label: "In-App", icon: Bell },
    WEBHOOK: { label: "Webhook", icon: BellOff }
};

const channelPreferenceMap = {
    EMAIL: "email",
    PUSH: "push",
    IN_APP: "inApp",
    WEBHOOK: "webhook"
};

const preferenceChannels = ["EMAIL", "PUSH", "IN_APP", "WEBHOOK"];
const PAGE_SIZE = 10;
const NOTIFICATION_FETCH_SIZE = 100;
const eventTypeLabels = {
    "user.registered": "Account created",
    "user.password.reset": "Password reset",
    "registration.confirmed": "Registration confirmed",
    "registration.cancelled": "Registration cancelled",
    "event.published": "Event published",
    "event.reminder.24h": "Event reminder: 24 hours",
    "event.reminder.1h": "Event reminder: 1 hour",
    "event.cancelled": "Event cancelled",
    "event.updated": "Event update"
};

const statusLabels = {
    READ: "Read",
    UNREAD: "Unread",
    SUCCESS: "Delivered",
    FAILED: "Delivery failed",
    PENDING: "Pending",
    SENT: "Sent"
};

const deliveryMessageLabels = {
    "In-app notification stored and emitted": "The in-app notification was delivered successfully.",
    "Accepted by provider": "The delivery provider accepted this notification.",
    "Queued for delivery": "The notification is queued for delivery.",
    "Delivered to provider": "The notification was handed off to the delivery provider."
};

function isNotificationRead(notification) {
    return Boolean(notification?.readAt) || notification?.status === "READ";
}

function toTitleCase(value) {
    return value
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function formatNotificationEventType(eventType) {
    if (!eventType) {
        return "General notification";
    }

    if (eventTypeLabels[eventType]) {
        return eventTypeLabels[eventType];
    }

    return toTitleCase(eventType.replace(/[._-]+/g, " "));
}

function formatStatusLabel(status) {
    if (!status) {
        return "Unknown";
    }

    if (statusLabels[status]) {
        return statusLabels[status];
    }

    return toTitleCase(status.replace(/_/g, " "));
}

function formatDeliveryProvider(provider, channel) {
    if (provider === "SocketIO") {
        return channel === "IN_APP" ? "In-app delivery" : "Socket delivery";
    }

    if (!provider) {
        return "Delivery service";
    }

    return provider;
}

function formatDeliveryMessage(log) {
    if (log?.responseMessage && deliveryMessageLabels[log.responseMessage]) {
        return deliveryMessageLabels[log.responseMessage];
    }

    if (log?.responseMessage) {
        return log.responseMessage;
    }

    if (log?.status === "SUCCESS") {
        return "This notification was delivered successfully.";
    }

    if (log?.status === "FAILED") {
        return "This notification could not be delivered.";
    }

    return "Delivery details are not available.";
}

function getNotificationHtmlDocument(notification) {
    if (!notification?.html) {
        return "";
    }

    if (/<html[\s>]/i.test(notification.html)) {
        return notification.html;
    }

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 24px;
        background: #ffffff;
        color: #0f172a;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      img, svg, video, canvas { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      a { color: #1d4ed8; }
    </style>
  </head>
  <body>${notification.html}</body>
</html>`;
}

export function Notifications() {
    const [items, setItems] = useState([]);
    const [preferences, setPreferences] = useState(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [allItems, setAllItems] = useState([]);
    const [pageMeta, setPageMeta] = useState({ totalElements: 0, totalPages: 0 });
    const selectedNotificationHtml = useMemo(() => getNotificationHtmlDocument(selectedNotification), [selectedNotification]);
    const visibleItems = useMemo(() => {
        const filteredItems = showUnreadOnly ? allItems.filter((item) => !isNotificationRead(item)) : allItems;
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
    }, [allItems, currentPage, showUnreadOnly]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [page, prefs] = await Promise.all([
                notificationApi.list({ page: 0, size: NOTIFICATION_FETCH_SIZE }),
                notificationApi.getPreferences()
            ]);

            const nextItems = page.content;
            const filteredItems = showUnreadOnly ? nextItems.filter((item) => !isNotificationRead(item)) : nextItems;
            const nextTotalElements = filteredItems.length;
            const nextTotalPages = nextTotalElements === 0 ? 0 : Math.ceil(nextTotalElements / PAGE_SIZE);

            setAllItems(nextItems);
            setItems(filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));
            setPageMeta({
                totalElements: nextTotalElements,
                totalPages: nextTotalPages
            });
            setPreferences(prefs);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load notifications right now.");
        }
        finally {
            setLoading(false);
        }
    }, [currentPage, showUnreadOnly]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [showUnreadOnly]);

    useEffect(() => {
        const filteredItems = showUnreadOnly ? allItems.filter((item) => !isNotificationRead(item)) : allItems;
        const nextTotalElements = filteredItems.length;
        const nextTotalPages = nextTotalElements === 0 ? 0 : Math.ceil(nextTotalElements / PAGE_SIZE);
        const safePage = nextTotalPages === 0 ? 1 : Math.min(currentPage, nextTotalPages);
        const startIndex = (safePage - 1) * PAGE_SIZE;

        if (safePage !== currentPage) {
            setCurrentPage(safePage);
            return;
        }

        setItems(filteredItems.slice(startIndex, startIndex + PAGE_SIZE));
        setPageMeta({
            totalElements: nextTotalElements,
            totalPages: nextTotalPages
        });
    }, [allItems, currentPage, showUnreadOnly]);

    useEffect(() => {
        const handleNotificationReceived = (event) => {
            const notification = event.detail;
            if (!notification?.id) {
                return;
            }

            const normalizedNotification = {
                ...notification,
                _id: notification.id,
                channel: notification.channel || "IN_APP",
                status: notification.status || "SENT",
                readAt: notification.readAt || null
            };

            setAllItems((current) => {
                const withoutExisting = current.filter((item) => item._id !== normalizedNotification._id);
                return [normalizedNotification, ...withoutExisting];
            });
        };

        window.addEventListener(NOTIFICATION_RECEIVED_EVENT, handleNotificationReceived);
        return () => {
            window.removeEventListener(NOTIFICATION_RECEIVED_EVENT, handleNotificationReceived);
        };
    }, []);

    const handleMarkRead = async (id, read) => {
        try {
            const updated = await notificationApi.markRead(id, read);
            setAllItems((current) => current.map((item) => (item._id === id ? updated : item)));
            setSelectedNotification((current) => (current && current._id === id ? { ...current, ...updated } : current));
            emitNotificationStateChanged({ id, read });
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to update notification.");
        }
    };

    const handleDelete = async (id) => {
        try {
            const deletedNotification = allItems.find((item) => item._id === id) || null;
            await notificationApi.remove(id);

            setAllItems((current) => current.filter((item) => item._id !== id));
            emitNotificationStateChanged({
                id,
                deleted: true,
                read: Boolean(deletedNotification?.readAt)
            });

            setSelectedNotification((current) => (current?._id === id ? null : current));
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to delete notification.");
        }
    };

    const handleOpenNotification = async (item) => {
        setDetailLoading(true);
        setError("");
        setSelectedNotification(item);

        try {
            const detail = await notificationApi.getById(item._id);
            setSelectedNotification(detail);
            setAllItems((current) => current.map((entry) => (entry._id === item._id ? { ...entry, ...detail } : entry)));

            if (!isNotificationRead(item)) {
                const updated = await notificationApi.markRead(item._id, true);
                setAllItems((current) => current.map((entry) => (entry._id === item._id ? { ...entry, ...updated } : entry)));
                setSelectedNotification((current) => (current ? { ...current, ...updated } : current));
                emitNotificationStateChanged({ id: item._id, read: true });
            }
        }
        catch {
            // Fall back to the list payload so the user can still read the message
            // even if the detail endpoint is temporarily unavailable.
        }
        finally {
            setDetailLoading(false);
        }
    };

    const handlePreferenceToggle = async (channel, enabled) => {
        if (!preferences) {
            return;
        }

        const key = channelPreferenceMap[channel];

        try {
            const updated = await notificationApi.updatePreferences({
                [key]: {
                    ...preferences[key],
                    enabled
                }
            });
            setPreferences(updated);
            setMessage(`${channelMeta[channel].label} notifications updated.`);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to update preferences.");
        }
    };

    return (
        <section className="relative min-h-screen text-slate-900 dark:text-slate-100">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-200/80 via-blue-100/40 to-transparent dark:from-[#0d1942]/90 dark:via-[#070d1f]/50 dark:to-transparent" />

            <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">NOTIFICATIONS</p>
                        <h1 className="eventzen-page-title mt-2">Inbox & Preferences</h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            Review notification history from the new notification service and control which channels stay active.
                        </p>
                    </div>

                    <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
                        <input type="checkbox" checked={showUnreadOnly} onChange={(event) => setShowUnreadOnly(event.target.checked)} />
                        Show unread only
                    </label>
                </header>

                {error && <p className="mt-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                {message && <p className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

                <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                    <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-[#1132d4]/10 p-3 text-[#1132d4]">
                                <Bell className="size-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Channel Preferences</h2>
                                    <p className="text-sm text-slate-500">Choose which notification channels stay active for your account.</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {preferences && preferenceChannels.map((channel) => {
                                const Icon = channelMeta[channel].icon;
                                const key = channelPreferenceMap[channel];
                                const value = preferences[key];

                                return (
                                    <label key={channel} className="flex items-center justify-between rounded-2xl border border-black/10 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-[#0d1429]/80">
                                        <span className="flex items-center gap-3">
                                            <span className="rounded-xl bg-white p-2 text-[#1132d4] shadow-sm dark:bg-[#13244c]">
                                                <Icon className="size-4" />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-semibold">{channelMeta[channel].label}</span>
                                                <span className="block text-xs text-slate-500">
                                                    {value.enabled ? "Enabled" : "Muted"}
                                                    {value.eventTypes.length ? ` for ${value.eventTypes.length} event types` : " for all event types"}
                                                </span>
                                            </span>
                                        </span>
                                        <input type="checkbox" checked={value.enabled} onChange={(event) => handlePreferenceToggle(channel, event.target.checked)} />
                                    </label>
                                );
                            })}

                            {!preferences && !loading && <p className="text-sm text-slate-500">Preferences are not available yet.</p>}
                        </div>
                    </article>

                    <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold">Recent Notifications</h2>
                                <p className="text-sm text-slate-500">Review your latest alerts and track recent delivery activity.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void loadData()}
                                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm shadow-sm dark:border-white/10 dark:bg-[#13244c]"
                            >
                                Refresh
                            </button>
                        </div>

                        <div className="mt-5 space-y-3">
                            {loading && <p className="text-sm text-slate-500">Loading notifications...</p>}
                            {!loading && items.length === 0 && <p className="text-sm text-slate-500">No notifications found for this view.</p>}
                            {!loading && items.map((item) => {
                                const Icon = channelMeta[item.channel]?.icon || Bell;
                                const read = isNotificationRead(item);

                                return (
                                    <article
                                        key={item._id}
                                        className={`rounded-2xl border px-4 py-4 ${read ? "border-black/10 bg-slate-50/70 dark:border-white/10 dark:bg-[#0d1429]/70" : "border-blue-200 bg-blue-50/80 dark:border-blue-400/20 dark:bg-[#13244c]/80"}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <button type="button" onClick={() => handleOpenNotification(item)} className="flex min-w-0 flex-1 gap-3 text-left">
                                                <div className="rounded-xl bg-white p-2 text-[#1132d4] shadow-sm dark:bg-[#0b1738]">
                                                    <Icon className="size-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-sm font-semibold">{item.title}</h3>
                                                        <span className="rounded-full bg-slate-900/5 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                                            {channelMeta[item.channel]?.label || item.channel}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        {new Date(item.createdAt).toLocaleString()} · {formatNotificationEventType(item.eventType)}
                                                    </p>
                                                </div>
                                            </button>

                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMarkRead(item._id, !read)}
                                                    className="rounded-xl border border-black/10 bg-white p-2 text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#13244c] dark:text-slate-200"
                                                    title={read ? "Mark unread" : "Mark read"}
                                                >
                                                    <CheckCheck className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item._id)}
                                                    className="rounded-xl border border-black/10 bg-white p-2 text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#13244c] dark:text-slate-200"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </article>
                </div>

                {!loading && pageMeta.totalElements > 0 && (
                    <>
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75 dark:text-slate-300">
                            <span className="font-semibold text-slate-700 dark:text-slate-100">
                                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, pageMeta.totalElements)} of {pageMeta.totalElements} notifications
                            </span>
                            <span>Scroll to the bottom or use pagination to move through your inbox.</span>
                        </div>
                        <div className="mt-4">
                            <PageNavigation currentPage={currentPage} totalPages={Math.max(1, pageMeta.totalPages)} onPageChange={setCurrentPage} />
                        </div>
                    </>
                )}
            </div>

            <Dialog open={Boolean(selectedNotification)} onOpenChange={(open) => !open && setSelectedNotification(null)}>
                <DialogContent showCloseButton={false} className="max-h-[92vh] max-w-4xl overflow-hidden border-white/10 bg-[#0f1e3d] p-0 text-slate-100">
                    <div className="flex max-h-[92vh] flex-col">
                        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <DialogTitle className="pr-0 text-xl">{selectedNotification?.title || "Notification"}</DialogTitle>
                                    <DialogDescription className="mt-2 text-slate-300">
                                        {selectedNotification ? `${channelMeta[selectedNotification.channel]?.label || selectedNotification.channel} · ${new Date(selectedNotification.createdAt).toLocaleString()}` : "Loading notification..."}
                                    </DialogDescription>
                                </div>
                                <DialogClose asChild>
                                    <button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10">
                                        <X className="size-4" />
                                        Close
                                    </button>
                                </DialogClose>
                            </div>
                        </DialogHeader>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                            {detailLoading && <p className="text-sm text-slate-300">Loading notification...</p>}

                            {!detailLoading && selectedNotification && (
                                <div className="space-y-5">
                                    <div className="rounded-2xl border border-white/10 bg-[#0b1738] p-4">
                                        <p className="text-sm leading-7 text-slate-100">{selectedNotification.body}</p>
                                    </div>

                                    {selectedNotificationHtml && (
                                        <div className="rounded-2xl border border-white/10 bg-[#0b1738] p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rendered Message</p>
                                                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                    <ExternalLink className="size-3.5" />
                                                    Scroll inside the preview
                                                </span>
                                            </div>
                                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
                                                <iframe
                                                    title={`Notification preview ${selectedNotification._id}`}
                                                    srcDoc={selectedNotificationHtml}
                                                    sandbox=""
                                                    className="h-[420px] w-full bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-white/10 bg-[#0b1738] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Event Type</p>
                                            <p className="mt-2 text-sm text-slate-100">{formatNotificationEventType(selectedNotification.eventType)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-[#0b1738] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                                            <p className="mt-2 text-sm text-slate-100">{formatStatusLabel(selectedNotification.status)}</p>
                                        </div>
                                    </div>

                                    {selectedNotification.deliveryLogs && selectedNotification.deliveryLogs.length > 0 && (
                                        <div className="rounded-2xl border border-white/10 bg-[#0b1738] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery Logs</p>
                                            <div className="mt-3 space-y-3">
                                                {selectedNotification.deliveryLogs.map((log, index) => (
                                                    <div key={`${log.channel}-${log.sentAt}-${index}`} className="rounded-xl border border-white/10 bg-[#08122d] p-3">
                                                        <p className="text-sm font-semibold text-slate-100">
                                                            {channelMeta[log.channel]?.label || log.channel} · {formatStatusLabel(log.status)}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {formatDeliveryProvider(log.provider, log.channel)} · {new Date(log.sentAt).toLocaleString()}
                                                        </p>
                                                        <p className="mt-2 text-sm text-slate-200">{formatDeliveryMessage(log)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
