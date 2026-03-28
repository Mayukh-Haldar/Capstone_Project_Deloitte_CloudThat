import { AlertTriangle, Calendar, ChevronDown, Clock3, MapPin, QrCode, Search, Ticket as TicketIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { LazyLoadSentinel } from "../components/LazyLoadSentinel";
import { PageNavigation } from "../components/PageNavigation";
import { ticketingApi } from "../lib/ticketing-api";
import { eventApi, isDisabledEvent } from "../lib/event-api";
import { ApiClientError } from "../lib/http-client";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
const PAGE_SIZE = 6;
const formatDate = (value) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export function Tickets() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [eventStatusMap, setEventStatusMap] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [searchDraft, setSearchDraft] = useState("");
    const [dateFilter, setDateFilter] = useState("all");
    const [sortBy, setSortBy] = useState("soonest");
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const data = await ticketingApi.listMyRegistrations();
                // Filter out cancelled and pending (failed payment) registrations
                const active = data.filter((item) => item.status !== "CANCELED" && item.status !== "PENDING");
                setRegistrations(active);
                // Fetch event statuses for all unique event IDs so we can show disabled notices
                const uniqueEventIds = [...new Set(active.map((item) => item.eventId))];
                const statusEntries = await Promise.all(
                    uniqueEventIds.map(async (eventId) => {
                        try {
                            const detail = await eventApi.getEvent(eventId);
                            return [eventId, detail.event?.status ?? detail.status ?? ""];
                        }
                        catch {
                            return [eventId, ""];
                        }
                    })
                );
                setEventStatusMap(Object.fromEntries(statusEntries));
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load your ticket wallet.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, []);
    const upcomingRegistrations = useMemo(() => registrations.filter((item) => new Date(item.eventEndTime).getTime() >= Date.now()), [registrations]);
    const filteredRegistrations = useMemo(() => {
        const query = searchDraft.trim().toLowerCase();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const items = upcomingRegistrations
            .filter((item) => {
            if (!query) {
                return true;
            }
            return [
                item.eventTitle,
                item.ticketTypeName,
                item.venueName || "",
                item.venueCity || "",
                item.ticket.ticketNumber
            ].join(" ").toLowerCase().includes(query);
        })
            .filter((item) => {
            const eventDate = new Date(item.eventStartTime);
            if (dateFilter === "this-week") {
                const weekEnd = new Date(todayStart);
                weekEnd.setDate(todayStart.getDate() + 7);
                return eventDate >= todayStart && eventDate < weekEnd;
            }
            if (dateFilter === "this-month") {
                return eventDate >= todayStart && eventDate < monthEnd;
            }
            return true;
        });
        const sorted = [...items];
        sorted.sort((left, right) => {
            if (sortBy === "latest") {
                return new Date(right.eventStartTime).getTime() - new Date(left.eventStartTime).getTime();
            }
            if (sortBy === "title") {
                return left.eventTitle.localeCompare(right.eventTitle);
            }
            return new Date(left.eventStartTime).getTime() - new Date(right.eventStartTime).getTime();
        });
        return sorted;
    }, [dateFilter, searchDraft, sortBy, upcomingRegistrations]);
    const totalPages = Math.max(1, Math.ceil(filteredRegistrations.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
    const pagedRegistrations = filteredRegistrations.slice(pageStart, pageStart + PAGE_SIZE);
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredRegistrations.length]);
    return (<section className="relative min-h-screen text-slate-900 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-200/80 via-blue-100/40 to-transparent dark:from-[#0d1942]/90 dark:via-[#070d1f]/50 dark:to-transparent"/>
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[32px] bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(219,234,254,0.96),rgba(224,242,254,0.94))] p-6 text-slate-900 shadow-xl dark:bg-[linear-gradient(135deg,#0b3aa4,#18a0fb)] dark:text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#1132d4] dark:text-white">Digital Passes</p>
          <h1 className="eventzen-page-title mt-3">My Ticket Wallet</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-blue-50 sm:text-base">
            Keep every active pass in one place, with signed QR payloads ready for venue entry and quick ticket access.
          </p>
        </header>

        <div className="space-y-5 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101a33]">
          <div className="grid gap-4 lg:grid-cols-[1.7fr_0.9fr_0.75fr]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Tickets</span>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search by event, venue, ticket type, or ticket number..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 pr-12 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                {searchDraft && (<button type="button" onClick={() => setSearchDraft("")} className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear ticket search">
                    <X className="size-4"/>
                  </button>)}
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Date</span>
              <div className="relative">
                <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="all">All Upcoming</option>
                  <option value="this-week">Next 7 Days</option>
                  <option value="this-month">This Month</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sort</span>
              <div className="relative">
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="soonest">Soonest</option>
                  <option value="latest">Latest</option>
                  <option value="title">Title</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-[#0c152b] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-100">
                Showing {filteredRegistrations.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredRegistrations.length)} of {filteredRegistrations.length} tickets
              </span>
              <span className="hidden text-slate-300 md:inline">|</span>
              <span>Search by event title, venue, or ticket number.</span>
            </div>
          </div>
        </div>

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {loading ? (<div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f1e3d]/70">
            Loading ticket wallet...
          </div>) : filteredRegistrations.length === 0 ? (<div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 p-8 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f1e3d]/70">
            {upcomingRegistrations.length === 0 ? "No active tickets yet. Register for an event to see your wallet here." : "No tickets matched the current filters."}
          </div>) : (<>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/60 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-100">
                Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredRegistrations.length)} of {filteredRegistrations.length} tickets
              </span>
              <span>Scroll to the bottom or use pagination to browse more passes.</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedRegistrations.map((registration, index) => {
              const eventStatus = eventStatusMap[registration.eventId] || "";
              const eventDisabled = isDisabledEvent(eventStatus);
              return (<article key={registration.registrationId} className={`flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm ${eventDisabled ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-900/10" : "border-slate-200 bg-white/90 dark:border-white/10 dark:bg-[#0f1e3d]/80"}`}>
                <img src={getEventPlaceholderImage(registration.registrationId)} alt={registration.eventTitle} loading="lazy" className={`h-40 w-full object-cover ${eventDisabled ? "opacity-60 grayscale" : ""}`}/>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  {eventDisabled && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"/>
                      <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-200">This event has been disabled by the owner.</p>
                        <p className="mt-0.5 text-amber-700 dark:text-amber-300">Please email the event organizer for refund or further information.</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="min-h-7">
                      {!eventDisabled && pageStart + index === 0 && (<span className="inline-flex rounded-full bg-[#1132d4]/10 px-3 py-1 text-xs font-semibold text-[#1132d4]">Next Event</span>)}
                    </div>
                    <h2 className="line-clamp-2 min-h-[3.5rem] text-xl font-bold">{registration.eventTitle}</h2>
                    <p className="inline-flex min-h-10 items-start gap-2 text-sm text-slate-600 dark:text-slate-300"><Calendar className="mt-0.5 size-4 shrink-0"/><span>{formatDate(registration.eventStartTime)}</span></p>
                    <p className="inline-flex min-h-10 items-start gap-2 text-sm text-slate-600 dark:text-slate-300"><MapPin className="mt-0.5 size-4 shrink-0"/><span className="line-clamp-2">{registration.venueName || "Venue TBD"}{registration.venueCity ? `, ${registration.venueCity}` : ""}</span></p>
                    <div className="min-h-[7.75rem] rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{registration.ticketTypeName}</p>
                      <p className="mt-1">Ticket No: {registration.ticket.ticketNumber}</p>
                      <p className="mt-1 line-clamp-3 break-all">QR Payload: {registration.ticket.qrPayload}</p>
                    </div>
                  </div>
                  <Link to={`/my/tickets/${registration.registrationId}/pass`} className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1132d4] px-4 py-2.5 text-sm font-semibold text-white">
                    <QrCode className="size-4"/>View Ticket Pass
                  </Link>
                </div>
              </article>);
            })}
          </div>

            <PageNavigation currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage}/>
            <LazyLoadSentinel enabled={safeCurrentPage < totalPages} loading={loading} onVisible={() => setCurrentPage((current) => Math.min(current + 1, totalPages))}/>
          </>)}

        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/85 p-5 text-sm text-slate-600 backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/60 dark:text-slate-300">
          <p className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100"><Clock3 className="size-4"/>Ticket Support</p>
          <p className="mt-2">Need transfer or cancellation help? Use the registrations page before the event starts.</p>
          <p className="mt-2 inline-flex items-center gap-2 font-semibold text-[#1132d4]"><TicketIcon className="size-4"/>Each pass includes a signed entry payload for check-in validation.</p>
        </div>
      </div>
    </section>);
}
