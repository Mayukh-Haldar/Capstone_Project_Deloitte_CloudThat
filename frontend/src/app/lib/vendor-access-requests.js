const STORAGE_KEY = "eventzen.vendor-access-requests.v1";
const readRequests = () => {
    if (typeof window === "undefined") {
        return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        window.localStorage.removeItem(STORAGE_KEY);
        return [];
    }
};
const writeRequests = (requests) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    window.dispatchEvent(new Event("eventzen-vendor-request-change"));
};
export const listVendorAccessRequests = () => readRequests().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
export const listMyVendorAccessRequests = (userId) => listVendorAccessRequests().filter((request) => request.userId === userId);
export const submitVendorAccessRequest = (user, note) => {
    const requests = readRequests();
    const existing = requests.find((request) => request.userId === user.id && request.status === "PENDING");
    if (existing) {
        return existing;
    }
    const now = new Date().toISOString();
    const next = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${user.id}-${Date.now()}`,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userEmail: user.email,
        note: note.trim(),
        status: "PENDING",
        createdAt: now,
        updatedAt: now
    };
    writeRequests([next, ...requests]);
    return next;
};
export const reviewVendorAccessRequest = (requestId, status, reviewedBy) => {
    const now = new Date().toISOString();
    const updated = readRequests().map((request) => request.id === requestId
        ? {
            ...request,
            status,
            updatedAt: now,
            reviewedAt: now,
            reviewedBy
        }
        : request);
    writeRequests(updated);
    return updated.find((request) => request.id === requestId) || null;
};
