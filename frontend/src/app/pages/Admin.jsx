import { AlertTriangle, CalendarRange, CheckCheck, RefreshCcw, Search, Shield, Store, Ticket, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { authApi } from "../lib/auth-api";
import { eventApi } from "../lib/event-api";
import { ApiClientError } from "../lib/http-client";
import { toBackendRolesForPortal } from "../lib/roles";
import { ticketingApi } from "../lib/ticketing-api";
import { venueVendorApi } from "../lib/venue-vendor-api";
const vendorServiceCategories = ["CATERING", "AV", "DECOR", "SECURITY", "PHOTOGRAPHY"];
const portalOptions = ["ADMIN", "VENDOR", "CUSTOMER"];
const rowLimitOptions = ["5", "10", "20", "ALL"];
const statusTone = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
    CANCELED: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"
};
const vendorStatusTone = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
};
const rolesToPortal = (roles) => {
    if (roles.includes("ADMIN")) {
        return "ADMIN";
    }
    if (roles.includes("ORGANIZER") || roles.includes("VENDOR")) {
        return "VENDOR";
    }
    return "CUSTOMER";
};
const applyLimit = (items, limit) => limit === "ALL" ? items : items.slice(0, Number(limit));
const profilePhotoStorageKey = "eventzen.profile.photos.v1";
const hashString = (value) => value.split("").reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
const getAvatarFallback = (firstName, lastName) => `${firstName[0] ?? ""}${lastName[0] ?? ""}`.trim().toUpperCase() || "EZ";
const buildAvatarDataUri = (seed, fallback) => {
    const hash = Math.abs(hashString(seed || fallback));
    const hueA = hash % 360;
    const hueB = (hash + 48) % 360;
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hueA} 72% 68%)" />
          <stop offset="100%" stop-color="hsl(${hueB} 68% 52%)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#bg)" />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="white">${fallback}</text>
    </svg>
  `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
const getStoredProfilePhoto = (userId) => {
    if (typeof window === "undefined") {
        return null;
    }
    const raw = window.localStorage.getItem(profilePhotoStorageKey);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed[userId] || null;
    }
    catch {
        return null;
    }
};
const resolveAvatarSource = (user) => {
    const fallback = getAvatarFallback(user.firstName, user.lastName);
    return getStoredProfilePhoto(user.id) || buildAvatarDataUri(`${user.id}-${user.email}`, fallback);
};
const activeEventStatuses = ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"];
const directActionCopy = {
    DEACTIVATE: {
        title: "Deactivate user",
        button: "Deactivate",
        warning: "This will immediately mark the account inactive and revoke refresh tokens.",
        confirm: "Deactivate User"
    },
    REACTIVATE: {
        title: "Reactivate user",
        button: "Reactivate",
        warning: "This restores access for an inactive account so the user can sign in again.",
        confirm: "Reactivate User"
    },
    GDPR_DELETE: {
        title: "GDPR delete user",
        button: "GDPR Delete",
        warning: "This anonymizes the account for GDPR erasure, removes roles, and revokes active tokens.",
        confirm: "GDPR Delete User"
    }
};
const isGdprDeletedUser = (user) => Boolean(user.deletedAt);
export function Admin() {
    const [currentUserId, setCurrentUserId] = useState(null);
    const [users, setUsers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [events, setEvents] = useState([]);
    const [ticketsSold, setTicketsSold] = useState(0);
    const [portalDrafts, setPortalDrafts] = useState({});
    const [reviewComments, setReviewComments] = useState({});
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState("");
    const [vendorSearch, setVendorSearch] = useState("");
    const [vendorStatusFilter, setVendorStatusFilter] = useState("ALL");
    const [vendorLimit, setVendorLimit] = useState("5");
    const [userSearch, setUserSearch] = useState("");
    const [portalFilter, setPortalFilter] = useState("ALL");
    const [userLimit, setUserLimit] = useState("5");
    const [requestSearch, setRequestSearch] = useState("");
    const [requestStatusFilter, setRequestStatusFilter] = useState("PENDING");
    const [requestTypeFilter, setRequestTypeFilter] = useState("ALL");
    const [requestLimit, setRequestLimit] = useState("5");
    const [pendingDirectAction, setPendingDirectAction] = useState(null);
    const [vendorCatalogPending, setVendorCatalogPending] = useState(null);
    const [catalogServiceType, setCatalogServiceType] = useState("");
    const [catalogPhone, setCatalogPhone] = useState("");
    const [catalogSubmitting, setCatalogSubmitting] = useState(false);
    const handleError = (err) => {
        if (err instanceof ApiClientError) {
            setError(err.message);
            return;
        }
        setError("Something went wrong. Please try again.");
    };
    const loadDashboard = async () => {
        setLoading(true);
        setError("");
        try {
            const [userResult, requestResult, eventResult] = await Promise.allSettled([
                authApi.listUsers(0, 100),
                authApi.listAdminAccountRequests(),
                eventApi.listEvents({ size: 100 })
            ]);
            const failedReasons = [userResult, requestResult, eventResult]
                .filter((result) => result.status === "rejected")
                .map((result) => result.reason);
            const userPage = userResult.status === "fulfilled" ? userResult.value : null;
            const requestItems = requestResult.status === "fulfilled" ? requestResult.value : null;
            const eventPage = eventResult.status === "fulfilled" ? eventResult.value : null;
            const fallbackCurrentUser = !userPage ? await authApi.me().catch(() => null) : null;
            const hasAnyDashboardData = Boolean(userPage || requestItems || eventPage || fallbackCurrentUser);
            if (userPage) {
                setUsers(userPage.content);
                setPortalDrafts(Object.fromEntries(userPage.content.map((user) => [user.id, rolesToPortal(user.roles)])));
                const currentUser = await authApi.me().catch(() => null);
                setCurrentUserId(currentUser?.id || null);
            }
            else if (fallbackCurrentUser) {
                setUsers([fallbackCurrentUser]);
                setPortalDrafts({ [fallbackCurrentUser.id]: rolesToPortal(fallbackCurrentUser.roles) });
                setCurrentUserId(fallbackCurrentUser.id);
            }
            else {
                setUsers([]);
                setPortalDrafts({});
                setCurrentUserId(null);
            }
            if (requestItems) {
                setRequests(requestItems);
            }
            else {
                setRequests([]);
            }
            if (eventPage) {
                setEvents(eventPage.content);
                const ticketTypes = await Promise.all(eventPage.content.map((event) => ticketingApi.listTicketTypes(event.id).catch(() => [])));
                const soldCount = ticketTypes
                    .flat()
                    .reduce((sum, ticketType) => sum + Math.max(ticketType.totalQuantity - ticketType.availableQuantity, 0), 0);
                setTicketsSold(soldCount);
            }
            else {
                setEvents([]);
                setTicketsSold(0);
            }
            const shouldShowError = !hasAnyDashboardData && failedReasons.length > 0;
            if (shouldShowError) {
                handleError(failedReasons[0]);
            }
            else {
                failedReasons.forEach((reason) => {
                    console.error("Admin dashboard partial load failure:", reason);
                });
            }
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadDashboard();
    }, []);
    const summary = useMemo(() => ({
        users: users.length,
        activeEvents: events.filter((event) => activeEventStatuses.includes(event.status)).length,
        ticketsSold,
        pendingTotal: requests.filter((request) => request.status === "PENDING").length,
        pendingRequests: requests.filter((request) => request.status === "PENDING" && request.type !== "VENDOR_ACCESS").length,
        pendingVendorRequests: requests.filter((request) => request.status === "PENDING" && request.type === "VENDOR_ACCESS").length,
        vendorUsers: users.filter((user) => rolesToPortal(user.roles) === "VENDOR").length
    }), [events, requests, ticketsSold, users]);
    const filteredVendorRequests = useMemo(() => {
        const query = vendorSearch.trim().toLowerCase();
        return requests.filter((request) => request.type === "VENDOR_ACCESS").filter((request) => {
            const matchesSearch = !query ||
                `${request.user.firstName} ${request.user.lastName}`.toLowerCase().includes(query) ||
                request.user.email.toLowerCase().includes(query) ||
                (request.reason || "").toLowerCase().includes(query);
            const matchesStatus = vendorStatusFilter === "ALL" || request.status === vendorStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [requests, vendorSearch, vendorStatusFilter]);
    const filteredUsers = useMemo(() => {
        const query = userSearch.trim().toLowerCase();
        return users.filter((user) => {
            const portal = rolesToPortal(user.roles);
            const matchesSearch = !query ||
                `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query);
            const matchesPortal = portalFilter === "ALL" || portal === portalFilter;
            return matchesSearch && matchesPortal;
        });
    }, [users, userSearch, portalFilter]);
    const filteredRequests = useMemo(() => {
        const query = requestSearch.trim().toLowerCase();
        return requests.filter((request) => request.type !== "VENDOR_ACCESS").filter((request) => {
            const matchesSearch = !query ||
                `${request.user.firstName} ${request.user.lastName}`.toLowerCase().includes(query) ||
                request.user.email.toLowerCase().includes(query) ||
                request.type.toLowerCase().includes(query) ||
                (request.reason || "").toLowerCase().includes(query);
            const matchesStatus = requestStatusFilter === "ALL" || request.status === requestStatusFilter;
            const matchesType = requestTypeFilter === "ALL" || request.type === requestTypeFilter;
            return matchesSearch && matchesStatus && matchesType;
        });
    }, [requests, requestSearch, requestStatusFilter, requestTypeFilter]);
    const visibleVendorRequests = applyLimit(filteredVendorRequests, vendorLimit);
    const visibleUsers = applyLimit(filteredUsers, userLimit);
    const visibleRequests = applyLimit(filteredRequests, requestLimit);
    const requestQueueCards = [
        { label: "Managed Users", value: summary.users, icon: Users },
        { label: "Active Events", value: summary.activeEvents, icon: CalendarRange },
        { label: "Tickets Sold", value: summary.ticketsSold.toLocaleString(), icon: Ticket },
        { label: "Pending Requests", value: summary.pendingTotal, icon: AlertTriangle },
        { label: "Pending Account Requests", value: summary.pendingRequests, icon: CheckCheck },
        { label: "Pending Vendor Requests", value: summary.pendingVendorRequests, icon: Store },
        { label: "Vendor Users", value: summary.vendorUsers, icon: Shield }
    ];
    const savePortalRole = async (user) => {
        const nextPortal = portalDrafts[user.id];
        if (!nextPortal) {
            return;
        }
        setBusyKey(`portal-${user.id}`);
        setError("");
        setMessage("");
        try {
            const updated = await authApi.assignRoles(user.id, toBackendRolesForPortal(nextPortal));
            setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
            setMessage(`Role updated for ${updated.firstName} ${updated.lastName}.`);
            if (nextPortal === "VENDOR") {
                setVendorCatalogPending({ name: `${updated.firstName} ${updated.lastName}`, email: updated.email });
                setCatalogServiceType("");
                setCatalogPhone("");
            }
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setBusyKey("");
        }
    };
    const runDirectUserAction = async (user, action) => {
        setBusyKey(`direct-${action}-${user.id}`);
        setError("");
        setMessage("");
        try {
            const response = action === "DEACTIVATE"
                ? await authApi.deactivateUser(user.id)
                : action === "REACTIVATE"
                    ? await authApi.reactivateUser(user.id)
                    : await authApi.gdprDeleteUser(user.id);
            await loadDashboard();
            setMessage(`${response.message} for ${user.firstName} ${user.lastName}.`);
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setBusyKey("");
            setPendingDirectAction(null);
        }
    };
    const reviewVendorRequest = async (request, status) => {
        setBusyKey(`${status}-${request.id}`);
        setError("");
        setMessage("");
        try {
            const updated = status === "APPROVED"
                ? await authApi.approveAccountRequest(request.id, "Approved for vendor onboarding")
                : await authApi.rejectAccountRequest(request.id, "Vendor access request rejected");
            setRequests((current) => current.map((item) => (item.id === request.id ? updated : item)));
            if (status === "APPROVED") {
                await loadDashboard();
                setVendorCatalogPending({ name: `${request.user.firstName} ${request.user.lastName}`, email: request.user.email });
                setCatalogServiceType("");
                setCatalogPhone("");
            }
            setMessage(`Vendor request ${status.toLowerCase()} successfully.`);
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setBusyKey("");
        }
    };
    const reviewAccountRequest = async (request, action) => {
        setBusyKey(`${action}-${request.id}`);
        setError("");
        setMessage("");
        try {
            const adminComment = reviewComments[request.id]?.trim() || undefined;
            const updated = action === "approve"
                ? await authApi.approveAccountRequest(request.id, adminComment)
                : await authApi.rejectAccountRequest(request.id, adminComment);
            setRequests((current) => current.map((item) => (item.id === request.id ? updated : item)));
            setMessage(`Account request ${action}d successfully.`);
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setBusyKey("");
        }
    };
    return (<main className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-200/55 via-blue-100/25 to-transparent dark:from-[#0d1942]/55 dark:via-[#070d1f]/25 dark:to-transparent"/>
      <div className="relative mx-auto max-w-[1500px] space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">ADMIN PORTAL</p>
            <h1 className="eventzen-page-title mt-2">Admin Dashboard</h1>
            <p className="mt-2 text-lg text-slate-500 dark:text-slate-300">
              Full access across compliance, event operations, venue management, vendor approvals, finance, and reporting.
            </p>
          </div>
          <button type="button" onClick={() => void loadDashboard()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold dark:border-white/20 dark:bg-[#111a33]">
            <RefreshCcw className="size-4"/>
            Refresh
          </button>
        </div>

        {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {message && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}

        {summary.pendingTotal > 0 && (<section className="rounded-[1.75rem] border border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/80 p-5 shadow-sm dark:border-amber-500/30 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertTriangle className="size-5"/>
                </div>
                <div>
                  <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                    {summary.pendingTotal} pending requests require your attention
                  </p>
                  <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-100/70">
                    Vendor onboarding and system account requests are ready for review.
                  </p>
                </div>
              </div>
              <a href="#request-review-queue" className="inline-flex items-center rounded-2xl border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 dark:border-amber-500/30 dark:bg-[#111a33] dark:text-amber-100">
                Review
              </a>
            </div>
          </section>)}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {requestQueueCards.map((card) => (<article key={card.label} className="flex min-h-[11.25rem] flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111a33]">
              <div className="flex items-center justify-between gap-3">
                <p className="min-h-[3.5rem] text-base text-slate-500 dark:text-slate-300">{card.label}</p>
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-white/10">
                  <card.icon className="size-5 text-[#1132d4]"/>
                </div>
              </div>
              <p className="mt-auto pt-3 text-3xl font-black">{card.value}</p>
            </article>))}
        </div>

        <section className="grid gap-4 xl:grid-cols-4">
          {[
            { title: "Event creation and management", to: "/admin/events" },
            { title: "Venue creation and bookings", to: "/admin/venues" },
            { title: "Customer check-in command center", to: "/admin/check-in" },
            { title: "Admin finance and reports", to: "/admin/finance" }
        ].map((item) => (<Link key={item.to} to={item.to} className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm transition hover:border-[#1132d4]/40 dark:border-white/10 dark:bg-[#111a33]">
              <p className="font-semibold">{item.title}</p>
            </Link>))}
        </section>

        <section id="request-review-queue" className="grid gap-6 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111a33]">
            <div className="mb-4">
              <h2 className="text-xl font-bold sm:text-2xl">Manage Becoming a Vendor Requests</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">Compact queue with search, status filtering, and row limits.</p>
            </div>

            <div className="mb-4 space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                <input value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Search name, email, or note" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={vendorStatusFilter} onChange={(event) => setVendorStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select value={vendorLimit} onChange={(event) => setVendorLimit(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  {rowLimitOptions.map((option) => <option key={option} value={option}>Show {option === "ALL" ? "all" : option}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Showing {visibleVendorRequests.length} of {filteredVendorRequests.length} requests.</p>
            </div>

            <div className="space-y-4">
              {visibleVendorRequests.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20 dark:text-slate-300">
                  No vendor requests match the current filters.
                </div>) : (visibleVendorRequests.map((request) => (<article key={request.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-12 border border-slate-200 bg-slate-100 shadow-sm dark:border-white/15 dark:bg-[#13244c]">
                          <AvatarImage src={resolveAvatarSource(request.user)} alt={`${request.user.firstName} ${request.user.lastName}`} className="object-cover"/>
                          <AvatarFallback className="bg-[#1132d4]/10 text-xs font-semibold text-[#1132d4]">
                            {getAvatarFallback(request.user.firstName, request.user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1132d4]">Vendor Access</p>
                          <h3 className="mt-1 text-lg font-semibold">{request.user.firstName} {request.user.lastName}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-300">{request.user.email}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendorStatusTone[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{request.reason || "No note provided."}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Submitted {new Date(request.createdAt).toLocaleString()}</p>
                    {request.status === "PENDING" && (<div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void reviewVendorRequest(request, "APPROVED")} disabled={busyKey === `APPROVED-${request.id}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                          Approve
                        </button>
                        <button type="button" onClick={() => void reviewVendorRequest(request, "REJECTED")} disabled={busyKey === `REJECTED-${request.id}`} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:text-rose-300">
                          Reject
                        </button>
                      </div>)}
                  </article>)))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111a33]">
            <div className="mb-4">
              <h2 className="text-xl font-bold sm:text-2xl">Access and Compliance</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">One role per user, with searchable role assignment controls.</p>
            </div>

            <div className="mb-4 space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search user name or email" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={portalFilter} onChange={(event) => setPortalFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  <option value="ALL">All roles</option>
                  {portalOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={userLimit} onChange={(event) => setUserLimit(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  {rowLimitOptions.map((option) => <option key={option} value={option}>Show {option === "ALL" ? "all" : option}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Showing {visibleUsers.length} of {filteredUsers.length} users.</p>
            </div>

            <div className="space-y-4">
              {visibleUsers.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20 dark:text-slate-300">
                  No users match the current filters.
                </div>) : (visibleUsers.map((user) => {
                    const isOwnAdminAccount = currentUserId === user.id && user.roles.includes("ADMIN");
                    return (<article key={user.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-12 border border-slate-200 bg-slate-100 shadow-sm dark:border-white/15 dark:bg-[#13244c]">
                          <AvatarImage src={resolveAvatarSource(user)} alt={`${user.firstName} ${user.lastName}`} className="object-cover"/>
                          <AvatarFallback className="bg-[#1132d4]/10 text-xs font-semibold text-[#1132d4]">
                            {getAvatarFallback(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-lg font-semibold">{user.firstName} {user.lastName}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-300">{user.email}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {portalOptions.map((portal) => (<button key={portal} type="button" onClick={() => {
                                if (isOwnAdminAccount) {
                                    return;
                                }
                                setPortalDrafts((current) => ({ ...current, [user.id]: portal }));
                            }} disabled={isOwnAdminAccount} title={isOwnAdminAccount ? "Admins cannot change their own role" : undefined} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${portalDrafts[user.id] === portal ? "bg-[#1132d4] text-white" : "border border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300"} ${isOwnAdminAccount ? "cursor-not-allowed opacity-45" : ""}`}>
                          {portal}
                        </button>))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-500 dark:text-slate-300">
                        Current role: {user.roles.length > 0 ? rolesToPortal(user.roles) : "None"}
                      </p>
                      <button type="button" onClick={() => void savePortalRole(user)} disabled={busyKey === `portal-${user.id}` || isGdprDeletedUser(user) || isOwnAdminAccount} title={isOwnAdminAccount ? "Admins cannot change their own role" : undefined} className="rounded-xl bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                        Save Role
                      </button>
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          <AlertTriangle className="size-4"/>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Direct Account Actions</h4>
                          <p className="mt-1 text-xs text-amber-800 dark:text-amber-100/80">
                            {isGdprDeletedUser(user)
                ? "This account has already been anonymized for GDPR erasure."
                : isOwnAdminAccount
                    ? "You can view your own admin account status here, but another admin must manage role, deactivation, reactivation, or deletion changes."
                : "Sensitive actions require confirmation before they are applied."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isGdprDeletedUser(user) ? (<span className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                            GDPR Deleted
                          </span>) : user.active ? (<button type="button" onClick={() => setPendingDirectAction({ user, action: "DEACTIVATE" })} disabled={busyKey === `direct-DEACTIVATE-${user.id}` || isOwnAdminAccount} title={isOwnAdminAccount ? "Admins cannot deactivate their own account" : undefined} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60 dark:border-amber-500/30 dark:text-amber-200">
                            {busyKey === `direct-DEACTIVATE-${user.id}` ? "Working..." : directActionCopy.DEACTIVATE.button}
                          </button>) : (<button type="button" onClick={() => setPendingDirectAction({ user, action: "REACTIVATE" })} disabled={busyKey === `direct-REACTIVATE-${user.id}` || isOwnAdminAccount} title={isOwnAdminAccount ? "Admins cannot reactivate their own account" : undefined} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            {busyKey === `direct-REACTIVATE-${user.id}` ? "Working..." : directActionCopy.REACTIVATE.button}
                          </button>)}
                        <button type="button" onClick={() => setPendingDirectAction({ user, action: "GDPR_DELETE" })} disabled={busyKey === `direct-GDPR_DELETE-${user.id}` || isGdprDeletedUser(user) || isOwnAdminAccount} title={isOwnAdminAccount ? "Admins cannot GDPR delete their own account" : undefined} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300">
                          {busyKey === `direct-GDPR_DELETE-${user.id}` ? "Working..." : directActionCopy.GDPR_DELETE.button}
                        </button>
                      </div>
                    </div>
                  </article>);
                }))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#111a33]">
            <div className="mb-4">
              <h2 className="text-xl font-bold sm:text-2xl">System Account Requests</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">Review deactivate, reactivate, and GDPR delete requests with compact filters.</p>
            </div>

            <div className="mb-4 space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                <input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="Search user, email, type, or reason" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <select value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELED">Canceled</option>
                </select>
                <select value={requestTypeFilter} onChange={(event) => setRequestTypeFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  <option value="ALL">All request types</option>
                  <option value="DEACTIVATE">Deactivate</option>
                  <option value="REACTIVATE">Reactivate</option>
                  <option value="GDPR_DELETE">GDPR Delete</option>
                </select>
                <select value={requestLimit} onChange={(event) => setRequestLimit(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none dark:border-white/20 dark:bg-[#0d1429]">
                  {rowLimitOptions.map((option) => <option key={option} value={option}>Show {option === "ALL" ? "all" : option}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Showing {visibleRequests.length} of {filteredRequests.length} requests.</p>
            </div>

            <div className="space-y-4">
              {visibleRequests.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20 dark:text-slate-300">
                  No system account requests match the current filters.
                </div>) : (visibleRequests.map((request) => (<article key={request.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-12 border border-slate-200 bg-slate-100 shadow-sm dark:border-white/15 dark:bg-[#13244c]">
                          <AvatarImage src={resolveAvatarSource(request.user)} alt={`${request.user.firstName} ${request.user.lastName}`} className="object-cover"/>
                          <AvatarFallback className="bg-[#1132d4]/10 text-xs font-semibold text-[#1132d4]">
                            {getAvatarFallback(request.user.firstName, request.user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1132d4]">{request.type.replaceAll("_", " ")}</p>
                          <h3 className="mt-1 text-lg font-semibold">{request.user.firstName} {request.user.lastName}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-300">{request.user.email}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p>Submitted: {new Date(request.createdAt).toLocaleString()}</p>
                      {request.reason && <p>Reason: {request.reason}</p>}
                      {request.adminComment && <p>Admin note: {request.adminComment}</p>}
                    </div>
                    {request.status === "PENDING" && (<div className="mt-4 space-y-3">
                        <textarea value={reviewComments[request.id] || ""} onChange={(event) => setReviewComments((current) => ({ ...current, [request.id]: event.target.value }))} rows={3} placeholder="Optional admin review note" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void reviewAccountRequest(request, "approve")} disabled={busyKey === `approve-${request.id}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            Approve
                          </button>
                          <button type="button" onClick={() => void reviewAccountRequest(request, "reject")} disabled={busyKey === `reject-${request.id}`} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:text-rose-300">
                            Reject
                          </button>
                        </div>
                      </div>)}
                  </article>)))}
            </div>
          </article>
        </section>
      </div>

      {vendorCatalogPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111a33]">
            <h2 className="text-lg font-bold">Register in Vendor Catalog</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{vendorCatalogPending.name}</span> ({vendorCatalogPending.email}) has been granted vendor access. Complete their catalog profile to make them discoverable.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setCatalogSubmitting(true);
              try {
                await venueVendorApi.createVendor({
                  vendorName: vendorCatalogPending.name,
                  serviceType: catalogServiceType,
                  email: vendorCatalogPending.email,
                  phone: catalogPhone
                });
                setMessage(`${vendorCatalogPending.name} has been registered in the vendor catalog.`);
                setVendorCatalogPending(null);
              } catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Catalog registration failed.");
                setVendorCatalogPending(null);
              } finally {
                setCatalogSubmitting(false);
              }
            }} className="mt-4 space-y-3">
              <label className="block space-y-1 text-sm font-medium">
                <span>Vendor Name</span>
                <input readOnly value={vendorCatalogPending.name} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-slate-400"/>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>Email</span>
                <input readOnly value={vendorCatalogPending.email} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-white/20 dark:bg-white/5 dark:text-slate-400"/>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>Service Type <span className="text-rose-500">*</span></span>
                <select required value={catalogServiceType} onChange={(e) => setCatalogServiceType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-[#0f172e]">
                  <option value="">Select a service type</option>
                  {vendorServiceCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>Phone <span className="text-rose-500">*</span></span>
                <input required value={catalogPhone} onChange={(e) => setCatalogPhone(e.target.value)} placeholder="+91-90000-XXXXX" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 dark:bg-[#0f172e]"/>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={catalogSubmitting} className="flex-1 rounded-xl bg-[#1132d4] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {catalogSubmitting ? "Registering..." : "Register in Catalog"}
                </button>
                <button type="button" onClick={() => setVendorCatalogPending(null)} disabled={catalogSubmitting} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-white/20">
                  Skip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(pendingDirectAction)} onOpenChange={(open) => !open && setPendingDirectAction(null)}>
        <AlertDialogContent className="border-slate-200 bg-white dark:border-white/10 dark:bg-[#111a33]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDirectAction ? directActionCopy[pendingDirectAction.action].title : "Confirm account action"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {pendingDirectAction && (<>
                  <span className="block">
                    You are about to update <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {pendingDirectAction.user.firstName} {pendingDirectAction.user.lastName}
                    </span> ({pendingDirectAction.user.email}).
                  </span>
                  <span className="block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                    Warning: {directActionCopy[pendingDirectAction.action].warning}
                  </span>
                </>)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(pendingDirectAction && busyKey === `direct-${pendingDirectAction.action}-${pendingDirectAction.user.id}`)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={(event) => {
            event.preventDefault();
            if (!pendingDirectAction) {
                return;
            }
            void runDirectUserAction(pendingDirectAction.user, pendingDirectAction.action);
        }} className={pendingDirectAction?.action === "GDPR_DELETE" ? "bg-rose-600 hover:bg-rose-700" : undefined}>
              {pendingDirectAction ? directActionCopy[pendingDirectAction.action].confirm : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>);
}
