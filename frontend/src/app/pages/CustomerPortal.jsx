import { Bell, CheckCircle2, ClipboardList, CreditCard, Sparkles, Store } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import { useAuthSession } from "../lib/auth-storage";
import { authApi } from "../lib/auth-api";
import { financeApi } from "../lib/finance-api";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
import { hasVendorRole } from "../lib/roles";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
export function CustomerPortal() {
    const location = useLocation();
    const session = useAuthSession();
    const [registrations, setRegistrations] = useState([]);
    const [requests, setRequests] = useState([]);
    const [payments, setPayments] = useState([]);
    const [requestNote, setRequestNote] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const vendorRequestRef = useRef(null);
    const pendingActionsRef = useRef(null);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const [registrationsResult, requestsResult, paymentsResult] = await Promise.allSettled([
                    ticketingApi.listMyRegistrations(),
                    authApi.listMyAccountRequests(),
                    financeApi.listMyPayments()
                ]);
                if (registrationsResult.status === "fulfilled") {
                    setRegistrations(registrationsResult.value);
                }
                else {
                    setRegistrations([]);
                }
                if (requestsResult.status === "fulfilled") {
                    setRequests(requestsResult.value.filter((request) => request.type === "VENDOR_ACCESS"));
                }
                else {
                    setRequests([]);
                }
                if (paymentsResult.status === "fulfilled") {
                    setPayments(paymentsResult.value);
                }
                else {
                    setPayments([]);
                    console.error("Unable to load customer payments:", paymentsResult.reason);
                }
                if (registrationsResult.status === "rejected" && requestsResult.status === "rejected") {
                    throw registrationsResult.reason;
                }
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load customer portal data.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, []);
    useEffect(() => {
        if (location.hash !== "#become-vendor") {
            return;
        }
        const target = vendorRequestRef.current;
        if (!target) {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            target.focus({ preventScroll: true });
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [location.hash]);
    const totalSpent = useMemo(() => payments
        .filter((payment) => payment.status === "SUCCEEDED")
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [payments]);
    // Filter out cancelled and pending (failed payment) registrations
    const activeRegistrations = registrations.filter((item) => item.status !== "CANCELED" && item.status !== "PENDING");
    const checkedInCount = registrations.filter((item) => item.status === "CHECKED_IN").length;
    const pendingVendorRequest = requests.find((request) => request.status === "PENDING");
    const pendingActions = [
        session?.user.emailVerified ? 0 : 1,
        session?.user.mfaEnabled ? 0 : 1,
        pendingVendorRequest ? 1 : 0
    ].reduce((sum, item) => sum + item, 0);
    const pendingActionItems = [
        !session?.user.emailVerified
            ? {
                id: "email-verification",
                title: "Verify your email address",
                description: "Email verification is still pending in your account security settings.",
                ctaLabel: "Open settings",
                onClick: () => {
                    window.location.href = "/account/settings";
                }
            }
            : null,
        !session?.user.mfaEnabled
            ? {
                id: "mfa",
                title: "Enable multi-factor authentication",
                description: "MFA is not enabled yet for your account.",
                ctaLabel: "Open settings",
                onClick: () => {
                    window.location.href = "/account/settings";
                }
            }
            : null,
        pendingVendorRequest
            ? {
                id: "vendor-request",
                title: "Vendor access request under review",
                description: `Submitted ${new Date(pendingVendorRequest.createdAt).toLocaleString()}.`,
                ctaLabel: "View request",
                onClick: () => {
                    vendorRequestRef.current?.focus({ preventScroll: true });
                    vendorRequestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
            : null
    ].filter(Boolean);
    const handleVendorRequest = async () => {
        if (!session?.user) {
            return;
        }
        setError("");
        setMessage("");
        setSubmitting(true);
        try {
            const request = await authApi.submitAccountRequest("VENDOR_ACCESS", requestNote.trim() || undefined);
            setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
            setRequestNote("");
            setMessage("Vendor access request submitted for admin review.");
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to submit vendor access request.");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (<section className="relative min-h-screen text-slate-900 dark:text-slate-100">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">CUSTOMER PORTAL</p>
          <h1 className="eventzen-page-title mt-2">Your event workspace</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Track registrations, spending, notifications, and account actions from one customer-friendly dashboard.
          </p>
        </header>

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active Registrations", value: activeRegistrations.length, icon: ClipboardList },
            { label: "Total Spent", value: formatCurrency(totalSpent), icon: CreditCard },
            { label: "Checked In", value: checkedInCount, icon: CheckCircle2 },
            {
                label: "Pending Actions",
                value: pendingActions,
                icon: Bell,
                onClick: () => pendingActionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                interactive: pendingActions > 0
            }
        ].map((item) => {
            const Tag = item.interactive ? "button" : "article";
            return (<Tag key={item.label} {...(item.interactive
                ? {
                    type: "button",
                    onClick: item.onClick
                }
                : {})} className={`rounded-3xl border border-black/10 bg-white/85 p-5 text-left shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75 ${item.interactive ? "transition hover:border-[#1132d4]/30 hover:shadow-md" : ""}`}>
                <item.icon className="size-5 text-[#1132d4]"/>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-black">{item.value}</p>
              </Tag>);
        })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#1132d4]/10 p-3 text-[#1132d4]">
                <Sparkles className="size-5"/>
              </div>
              <div>
                <h2 className="text-2xl font-black">Overview</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">Quick health check for your customer account.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div ref={pendingActionsRef} className="rounded-2xl border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-semibold">Pending actions</p>
                {pendingActionItems.length === 0 ? (<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No pending follow-ups right now.</p>) : (<div className="mt-3 space-y-3">
                    {pendingActionItems.map((item) => (<div key={item.id} className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-[#0d1429]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                          </div>
                          <button type="button" onClick={item.onClick} className="rounded-xl border border-[#1132d4]/20 px-3 py-2 text-sm font-semibold text-[#1132d4]">
                            {item.ctaLabel}
                          </button>
                        </div>
                      </div>))}
                  </div>)}
              </div>
              <div className="rounded-2xl border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-semibold">Upcoming event activity</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {loading ? "Loading your latest registrations..." : activeRegistrations.length > 0 ? `You have ${activeRegistrations.length} live registrations ready for entry.` : "You have no live registrations yet. Explore events and reserve your next ticket."}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-semibold">Security checklist</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Email verification: {session?.user.emailVerified ? "Complete" : "Pending"}.
                  MFA: {session?.user.mfaEnabled ? " Enabled" : " Not enabled"}.
                </p>
                <Link to="/account/settings" className="mt-3 inline-flex text-sm font-semibold text-[#1132d4]">
                  Open settings
                </Link>
              </div>
            </div>
          </article>

          <article id="become-vendor" ref={vendorRequestRef} tabIndex={-1} className="scroll-mt-24 rounded-3xl border border-black/10 bg-white/85 p-6 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1132d4] dark:border-white/10 dark:bg-[#0f1e3d]/75">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Store className="size-5"/>
              </div>
              <div>
                <h2 className="text-2xl font-black">Request Becoming a Vendor</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">Submit your request to unlock the vendor portal.</p>
              </div>
            </div>

            {hasVendorRole(session?.user.roles || []) ? (<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                Your account already has vendor access.
              </div>) : pendingVendorRequest ? (<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                Pending since {new Date(pendingVendorRequest.createdAt).toLocaleString()}.
              </div>) : (<div className="mt-5 space-y-3">
                <textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} rows={4} placeholder="Tell the admin what kinds of events you plan to manage." className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
                <button type="button" onClick={() => void handleVendorRequest()} disabled={submitting} className="rounded-2xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {submitting ? "Submitting..." : "Submit Vendor Request"}
                </button>
              </div>)}

            {requests.length > 0 && (<div className="mt-5 space-y-3">
                {requests.map((request) => (<div key={request.id} className="rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10">
                    <p className="font-semibold">{request.status}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{request.reason || "No note provided."}</p>
                  </div>))}
              </div>)}
          </article>
        </div>
      </div>
    </section>);
}
