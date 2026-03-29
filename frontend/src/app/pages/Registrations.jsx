import { Calendar, ChevronDown, CircleCheck, Clock3, Download, Search, Ticket, Eye, EyeOff, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { PageNavigation } from "../components/PageNavigation";
import { financeApi } from "../lib/finance-api";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
const PAGE_SIZE = 8;
const formatDate = (value) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export function Registrations() {
    const location = useLocation();
    const navigate = useNavigate();
    const [allRegistrations, setAllRegistrations] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [showCancelled, setShowCancelled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [invoiceLink, setInvoiceLink] = useState(null);
    const [paymentIndex, setPaymentIndex] = useState({});
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [searchDraft, setSearchDraft] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("latest");
    const downloadInvoice = async (paymentId, label) => {
        if (!paymentId) {
            return;
        }
        setError("");
        setDownloadingInvoiceId(paymentId);
        try {
            await financeApi.downloadInvoice(paymentId, `${label || "Invoice"}.pdf`);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to download invoice.");
        }
        finally {
            setDownloadingInvoiceId("");
        }
    };
    // Clean up failed registrations (PENDING status from payment failures)
    const cleanupFailedRegistrations = async () => {
        try {
            const allRegistrations = await ticketingApi.listMyRegistrations();
            const failedRegistrations = allRegistrations.filter((reg) => reg.status === "PENDING");
            // Auto-cancel registrations that are older than 1 hour and still PENDING
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const oldFailedRegs = failedRegistrations.filter((reg) => new Date(reg.createdAt) < oneHourAgo);
            for (const reg of oldFailedRegs) {
                try {
                    await ticketingApi.cancelRegistration(reg.registrationId, "MANUAL_CANCEL");
                }
                catch (cancelErr) {
                    console.error("Error cleaning up failed registration:", cancelErr);
                }
            }
            if (oldFailedRegs.length > 0) {
                console.log(`Cleaned up ${oldFailedRegs.length} failed registration(s)`);
            }
        }
        catch (err) {
            console.error("Error during cleanup:", err);
        }
    };
    useEffect(() => {
        const state = location.state;
        if (!state?.actionMessage && !state?.invoicePaymentId) {
            return;
        }
        setActionMessage(state?.actionMessage || "");
        setInvoiceLink(state?.invoicePaymentId ? { paymentId: state.invoicePaymentId, label: state.invoiceNumber || "Invoice" } : null);
        void navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                // Clean up old failed registrations first
                await cleanupFailedRegistrations();
                const [registrationsResult, paymentsResult] = await Promise.allSettled([
                    ticketingApi.listMyRegistrations(),
                    financeApi.listMyPayments()
                ]);
                if (registrationsResult.status !== "fulfilled") {
                    throw registrationsResult.reason;
                }
                // Store all registrations, filter out only PENDING (failed payments)
                setAllRegistrations(registrationsResult.value.filter((item) => item.status !== "PENDING"));
                if (paymentsResult.status === "fulfilled") {
                    const indexedPayments = {};
                    paymentsResult.value.forEach((payment) => {
                        if (payment.registrationId && payment.status === "SUCCEEDED") {
                            indexedPayments[payment.registrationId] = {
                                ...payment,
                                invoiceLabel: payment.invoiceNumber || "Invoice"
                            };
                        }
                    });
                    setPaymentIndex(indexedPayments);
                }
                else {
                    setPaymentIndex({});
                    console.error("Unable to load payments for registrations page:", paymentsResult.reason);
                }
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load registrations.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, []);
    // Filter registrations based on showCancelled toggle
    useEffect(() => {
        if (showCancelled) {
            setRegistrations(allRegistrations);
        }
        else {
            setRegistrations(allRegistrations.filter((item) => item.status !== "CANCELED"));
        }
    }, [allRegistrations, showCancelled]);
    useEffect(() => {
        setCurrentPage(1);
    }, [showCancelled, allRegistrations.length]);
    const filteredRegistrations = useMemo(() => {
        const query = searchDraft.trim().toLowerCase();
        const items = registrations
            .filter((item) => {
            if (!query) {
                return true;
            }
            return [
                item.eventTitle,
                item.ticketTypeName,
                item.registrationId,
                item.venueName || "",
                item.venueCity || ""
            ].join(" ").toLowerCase().includes(query);
        })
            .filter((item) => {
            if (statusFilter === "all") {
                return true;
            }
            return item.status === statusFilter;
        });
        const sorted = [...items];
        sorted.sort((left, right) => {
            if (sortBy === "oldest") {
                return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            }
            if (sortBy === "event-date") {
                return new Date(left.eventStartTime).getTime() - new Date(right.eventStartTime).getTime();
            }
            if (sortBy === "title") {
                return left.eventTitle.localeCompare(right.eventTitle);
            }
            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        });
        return sorted;
    }, [registrations, searchDraft, sortBy, statusFilter]);
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredRegistrations.length]);
    const totalPages = Math.max(1, Math.ceil(filteredRegistrations.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
    const pagedRegistrations = useMemo(() => filteredRegistrations.slice(pageStart, pageStart + PAGE_SIZE), [filteredRegistrations, pageStart]);
    const cancelRegistration = async (registrationId) => {
        setBusyId(registrationId);
        setError("");
        try {
            await ticketingApi.cancelRegistration(registrationId, "MANUAL_CANCEL");
            setAllRegistrations((current) => current.map((item) => item.registrationId === registrationId ? { ...item, status: "CANCELED" } : item));
            setActionMessage("Registration cancelled successfully.");
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to cancel registration.");
        }
        finally {
            setBusyId("");
        }
    };
    const removeFromHistory = (registrationId) => {
        // Remove cancelled registration from local state (this doesn't delete from backend)
        setAllRegistrations((current) => current.filter((item) => item.registrationId !== registrationId));
        setActionMessage("Registration removed from your history.");
    };
    return (<section className="min-h-screen bg-[#f3f5f9] text-slate-900 dark:bg-[#09132a] dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[32px] bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(219,234,254,0.96),rgba(224,242,254,0.94))] p-6 text-slate-900 shadow-xl dark:bg-[linear-gradient(135deg,#0b3aa4,#18a0fb)] dark:text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#1132d4] dark:text-white">Booking History</p>
          <h1 className="eventzen-page-title mt-3">My Registrations</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-blue-50 sm:text-base">
            Review upcoming bookings, monitor status changes, and manage cancellations from one organized history.
          </p>
        </header>

        <div className="space-y-5 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101a33]">
          <div className="grid gap-4 lg:grid-cols-[1.7fr_0.85fr_0.8fr]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Registrations</span>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search by event, ticket type, venue, or registration ID..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 pr-12 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                {searchDraft && (<button type="button" onClick={() => setSearchDraft("")} className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear registration search">
                    <X className="size-4"/>
                  </button>)}
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Status</span>
              <div className="relative">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="all">All Statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CHECKED_IN">Checked In</option>
                  {showCancelled ? <option value="CANCELED">Canceled</option> : null}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sort</span>
              <div className="relative">
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                  <option value="event-date">Event Date</option>
                  <option value="title">Title</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-[#0c152b] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-100">
                Showing {filteredRegistrations.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredRegistrations.length)} of {filteredRegistrations.length} registrations
              </span>
              <span className="hidden text-slate-300 md:inline">|</span>
              <span>Search by event title, venue, registration ID, or ticket type.</span>
            </div>
          </div>
        </div>

        {/* Toggle to show/hide cancelled registrations */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => {
            setShowCancelled(!showCancelled);
            setActionMessage(""); // Clear any action messages when toggling
            setInvoiceLink(null);
        }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
              {showCancelled ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
              {showCancelled ? "Hide Cancelled" : "Show Cancelled"}
            </button>
            {showCancelled && allRegistrations.some(r => r.status === "CANCELED") && (<span className="text-sm text-slate-500 dark:text-slate-400">
                {allRegistrations.filter(r => r.status === "CANCELED").length} cancelled registration(s)
              </span>)}
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {actionMessage && (<div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>{actionMessage}</p>
              {invoiceLink && (<button type="button" onClick={() => void downloadInvoice(invoiceLink.paymentId, invoiceLink.label)} disabled={downloadingInvoiceId === invoiceLink.paymentId} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/60 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-60 dark:border-emerald-300/30 dark:bg-transparent dark:text-emerald-100">
                  <Download className="size-4"/>
                  {downloadingInvoiceId === invoiceLink.paymentId ? "Downloading..." : `Download ${invoiceLink.label}`}
                </button>)}
            </div>
          </div>)}

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
          {loading ? (<div className="p-6 text-sm text-slate-500">Loading registrations...</div>) : (<div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Registration</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRegistrations.map((registration) => (<tr key={registration.registrationId} className="border-t border-slate-200 dark:border-white/10">
                      <td className="px-4 py-4 text-sm font-semibold">{registration.registrationId.slice(0, 8).toUpperCase()}</td>
                      <td className="px-4 py-4 text-sm">{registration.eventTitle}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="size-4 text-slate-500"/>
                          {formatDate(registration.eventStartTime)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="inline-flex items-center gap-2">
                          <Ticket className="size-4 text-slate-500"/>
                          {registration.ticketTypeName}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${registration.status === "CHECKED_IN" || registration.status === "CONFIRMED"
                    ? "bg-emerald-100 text-emerald-700"
                    : registration.status === "CANCELED"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-amber-100 text-amber-700"}`}>
                          <CircleCheck className="size-3.5"/>
                          {registration.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex flex-wrap gap-2">
                          {paymentIndex[registration.registrationId] && (<button type="button" onClick={() => void downloadInvoice(paymentIndex[registration.registrationId].id, paymentIndex[registration.registrationId].invoiceLabel)} disabled={downloadingInvoiceId === paymentIndex[registration.registrationId].id} className="inline-flex items-center gap-2 rounded-lg border border-[#1132d4]/30 px-3 py-2 text-xs font-semibold text-[#1132d4] disabled:opacity-60 dark:border-[#1132d4]/40">
                              <Download className="size-3.5"/>
                              {downloadingInvoiceId === paymentIndex[registration.registrationId].id ? "Downloading..." : "Invoice"}
                            </button>)}

                          {!paymentIndex[registration.registrationId] && (registration.status === "CONFIRMED" || registration.status === "CHECKED_IN") && (<span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 dark:border-white/15 dark:text-slate-400" title="Invoice not available for free tickets or payments still being reconciled.">
                              <Download className="size-3.5 opacity-50"/>
                              No Invoice
                            </span>)}

                          {registration.status === "CANCELED" ? (<button onClick={() => removeFromHistory(registration.registrationId)} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10">
                              <Trash2 className="size-3.5"/>
                              Remove
                            </button>) : (<button disabled={busyId === registration.registrationId} onClick={() => void cancelRegistration(registration.registrationId)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15">
                              {busyId === registration.registrationId ? "Canceling..." : "Cancel"}
                            </button>)}
                        </div>
                      </td>
                    </tr>))}
                  {filteredRegistrations.length === 0 && (<tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        {registrations.length > 0
                    ? "No registrations matched the current filters."
                    : showCancelled && allRegistrations.length > 0
                    ? "No active registrations. Toggle to hide cancelled registrations."
                    : allRegistrations.some(r => r.status === "CANCELED")
                        ? "No active registrations. Toggle to show cancelled registrations."
                        : "No registrations yet."}
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>)}
        </div>

        {!loading && filteredRegistrations.length > 0 && (<>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172e] dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-100">
                Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredRegistrations.length)} of {filteredRegistrations.length} registrations
              </span>
              <span>Use pagination below to browse more rows.</span>
            </div>
            <PageNavigation currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage}/>
          </>)}

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600 dark:border-white/15 dark:bg-[#0f172e] dark:text-slate-300">
          <p className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <Clock3 className="size-4"/> Need to modify a registration?
          </p>
          <p className="mt-2">
              Cancellations update the ticket inventory.
              Use the "Show Cancelled" toggle to view cancelled registrations and permanently remove them from your history.
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              <strong>Invoice availability:</strong> Invoices are generated for successful paid registrations and are available across refreshes and devices.
            Free tickets don't generate invoices. If you don't see an invoice for a paid registration yet, the payment may still be reconciling.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            <strong>Important:</strong> Canceling a registration does not delete the historical payment invoice that was already issued.
            Paid registrations remain hidden here until payment is verified successfully.
          </p>
        </div>
      </div>
    </section>);
}
