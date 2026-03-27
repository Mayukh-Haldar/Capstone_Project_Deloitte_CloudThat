import { CalendarRange, ClipboardCheck, DollarSign, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuthSession } from "../lib/auth-storage";
import { eventApi, getEventStatusLabel } from "../lib/event-api";
import { ApiClientError } from "../lib/http-client";
import { venueVendorApi } from "../lib/venue-vendor-api";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
export function VendorDashboard() {
    const session = useAuthSession();
    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [error, setError] = useState("");
    useEffect(() => {
        const load = async () => {
            setError("");
            try {
                const [eventsResult, bookingsResult] = await Promise.allSettled([
                    eventApi.listEvents({ organizerId: session?.user.id, size: 50 }),
                    venueVendorApi.listBookings({ upcomingOnly: true, limit: 50 })
                ]);
                const eventItems = eventsResult.status === "fulfilled" ? eventsResult.value.content : [];
                setEvents(eventItems);
                if (bookingsResult.status === "fulfilled") {
                    setBookings(bookingsResult.value.items.filter((item) => eventItems.some((event) => event.id === item.eventId)));
                }
                else {
                    setBookings([]);
                    console.error("Unable to load vendor bookings:", bookingsResult.reason);
                }
                if (eventsResult.status === "rejected") {
                    console.error("Unable to load vendor events:", eventsResult.reason);
                }
                if (eventsResult.status === "rejected" && bookingsResult.status === "rejected") {
                    throw eventsResult.reason;
                }
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load vendor operations.");
            }
        };
        if (session?.user.id) {
            void load();
        }
    }, [session?.user.id]);
    const totalBudget = useMemo(() => events.reduce((sum, event) => sum + event.estimatedBudget, 0), [events]);
    const activeEvents = useMemo(() => events.filter((event) => event.status !== "ARCHIVED" && event.status !== "COMPLETED"), [events]);
    return (<main className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-200/55 via-blue-100/20 to-transparent dark:from-[#0d1942]/55 dark:via-[#070d1f]/25 dark:to-transparent"/>
      <div className="relative mx-auto max-w-[1500px] space-y-5 p-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">VENDOR PORTAL</p>
          <h1 className="eventzen-page-title mt-2">Vendor Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Manage your events, venue bookings, customer check-ins, finance, and reporting from a dedicated vendor workspace.
          </p>
        </header>

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Managed Events", value: events.length, icon: CalendarRange },
            { label: "Active Events", value: activeEvents.length, icon: ClipboardCheck },
            { label: "Venue Bookings", value: bookings.length, icon: MapPin },
            { label: "Planned Budget", value: formatCurrency(totalBudget), icon: DollarSign }
        ].map((item) => (<article key={item.label} className="rounded-3xl border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
              <item.icon className="size-5 text-[#1132d4]"/>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-black">{item.value}</p>
            </article>))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Operations</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">Shortcuts into the vendor command surfaces you asked for.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
            { title: "Create and manage events", description: "Open the vendor event operations workspace for event setup and publishing.", to: "/vendor/events" },
            { title: "Book and monitor venues", description: "Review venue availability and make booking requests for your event portfolio.", to: "/vendor/venues" },
            { title: "Run customer check-in", description: "Launch the customer check-in command center for live entry operations.", to: "/vendor/check-in" },
            { title: "Track finance and reports", description: "Move into vendor finance and reports dashboards for budgeting and performance.", to: "/vendor/finance" }
        ].map((item) => (<Link key={item.to} to={item.to} className="rounded-2xl border border-black/10 bg-slate-50/80 p-4 transition hover:border-[#1132d4]/40 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                </Link>))}
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <h2 className="text-2xl font-black">Upcoming Portfolio</h2>
            <div className="mt-5 space-y-3">
              {activeEvents.length === 0 ? (<div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                  No active vendor events yet.
                </div>) : (activeEvents.slice(0, 5).map((event) => (<div key={event.id} className="rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10">
                    <p className="font-semibold">{event.title}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{new Date(event.startTime).toLocaleString()}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {event.venueName || "Venue TBD"} • {getEventStatusLabel(event.status)}
                    </p>
                  </div>)))}
            </div>
          </section>
        </div>
      </div>
    </main>);
}
