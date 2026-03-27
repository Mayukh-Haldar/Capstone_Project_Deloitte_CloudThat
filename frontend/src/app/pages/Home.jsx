import { ArrowLeft, ArrowRight, ChartColumn, CirclePlay, Globe2, MapPin, Quote, Search, Sparkles, Tag, Ticket, WandSparkles, } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { getEventPlaceholderImage, testimonials, trustedBrands } from "../lib/placeholder-images";
import { TubesHeroBackground } from "../components/TubesHeroBackground";
import { eventApi, getEventStatusLabel, isPubliclyDiscoverableEvent } from "../lib/event-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { ticketingApi } from "../lib/ticketing-api";
const formatEventDate = (start, end) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    const sameMonth = endDate && startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
    const month = startDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const startDay = String(startDate.getDate()).padStart(2, "0");
    if (!endDate) {
        return `${month} ${startDay}, ${startDate.getFullYear()}`;
    }
    const endDay = String(endDate.getDate()).padStart(2, "0");
    return sameMonth
        ? `${month} ${startDay}-${endDay}, ${startDate.getFullYear()}`
        : `${month} ${startDay}, ${startDate.getFullYear()}`;
};
export function Home() {
    const eventsPerPage = 2;
    const session = useAuthSession();
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [upcomingLoading, setUpcomingLoading] = useState(true);
    const [upcomingError, setUpcomingError] = useState("");
    const [registeredEventIds, setRegisteredEventIds] = useState(new Set());
    const [eventsCarouselIndex, setEventsCarouselIndex] = useState(0);
    const [testimonialsIndex, setTestimonialsIndex] = useState(0);
    const [eventsTransitionDir, setEventsTransitionDir] = useState(1);
    const [testimonialsTransitionDir, setTestimonialsTransitionDir] = useState(1);
    const [eventsAnimating, setEventsAnimating] = useState(false);
    const [testimonialsAnimating, setTestimonialsAnimating] = useState(false);
    const eventsTimerRef = useRef(null);
    const testimonialsTimerRef = useRef(null);
    const services = [
        {
            title: "Event Discovery",
            description: "Reach the right audience with integrated AI-driven marketing and promotion tools.",
            icon: Search,
        },
        {
            title: "Seamless Ticketing",
            description: "Fast, secure, and intuitive multi-tier ticketing experience for attendees.",
            icon: Ticket,
        },
        {
            title: "Vendor Orchestration",
            description: "Manage logistics, vendor partners, and external teams from one unified hub.",
            icon: WandSparkles,
        },
        {
            title: "Real-time Analytics",
            description: "Use data-driven insights to measure engagement, success, and ROI.",
            icon: ChartColumn,
        },
    ];
    const eventPageCount = Math.max(1, Math.ceil(upcomingEvents.length / eventsPerPage));
    const navigateEvents = useCallback((dir) => {
        if (eventsAnimating || eventPageCount <= 1) return;
        setEventsTransitionDir(dir);
        setEventsAnimating(true);
        setTimeout(() => {
            setEventsCarouselIndex((prev) => (prev + dir + eventPageCount) % eventPageCount);
            setEventsAnimating(false);
        }, 350);
    }, [eventPageCount, eventsAnimating]);
    const navigateTestimonials = useCallback((dir) => {
        if (testimonialsAnimating) return;
        setTestimonialsTransitionDir(dir);
        setTestimonialsAnimating(true);
        setTimeout(() => {
            setTestimonialsIndex((prev) => (prev + dir + testimonials.length) % testimonials.length);
            setTestimonialsAnimating(false);
        }, 350);
    }, [testimonialsAnimating]);
    const restartTestimonialsTimer = useCallback(() => {
        clearInterval(testimonialsTimerRef.current);
        testimonialsTimerRef.current = setInterval(() => navigateTestimonials(1), 5000);
    }, [navigateTestimonials]);
    const restartEventsTimer = useCallback(() => {
        clearInterval(eventsTimerRef.current);
        if (eventPageCount > 1) {
            eventsTimerRef.current = setInterval(() => navigateEvents(1), 4000);
        }
    }, [eventPageCount, navigateEvents]);
    useEffect(() => {
        restartEventsTimer();
        return () => clearInterval(eventsTimerRef.current);
    }, [restartEventsTimer]);
    useEffect(() => {
        restartTestimonialsTimer();
        return () => clearInterval(testimonialsTimerRef.current);
    }, [restartTestimonialsTimer]);
    useEffect(() => {
        const loadUpcomingEvents = async () => {
            setUpcomingLoading(true);
            setUpcomingError("");
            try {
                const response = await eventApi.listEvents({ size: 12 });
                setUpcomingEvents(response.content.filter((event) => isPubliclyDiscoverableEvent(event.status)).slice(0, 6));
            }
            catch (error) {
                setUpcomingError(error instanceof ApiClientError ? error.message : "Unable to load upcoming events.");
            }
            finally {
                setUpcomingLoading(false);
            }
        };
        void loadUpcomingEvents();
    }, []);
    useEffect(() => {
        if (!session) return;
        const loadRegistrations = async () => {
            try {
                const registrations = await ticketingApi.listMyRegistrations();
                const ids = new Set(
                    registrations
                        .filter((reg) =>
                            reg.status !== "CANCELED" &&
                            reg.status !== "PENDING" &&
                            reg.ticket?.status !== "CANCELED"
                        )
                        .map((reg) => reg.eventId)
                );
                setRegisteredEventIds(ids);
            } catch {
                // silently ignore — badge is non-critical
            }
        };
        void loadRegistrations();
    }, [session]);
    return (<div className="text-slate-900 dark:text-slate-100">
      <section className="relative border-b border-black/5 bg-white dark:border-white/10 dark:bg-[#080c1e] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full bg-gradient-to-br from-[#eef3fc]/80 via-[#eef3fc]/40 to-transparent dark:from-[#080c1e]/75 dark:via-[#080c1e]/30 dark:to-transparent"/>
        <TubesHeroBackground />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-16 z-10">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3.5 py-1 text-[11px] font-semibold tracking-widest text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <span className="size-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
              NEW: VIRTUAL CONFERENCE SUITES
            </p>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              Orchestrate
              <br />
              Excellence.
              <br />
              <span className="bg-gradient-to-r from-[#1132d4] to-[#4f7cff] bg-clip-text text-transparent dark:from-[#7aa3ff] dark:to-[#a5c3ff]">
                Reimagined.
              </span>
            </h1>
            <p className="mt-5 max-w-lg mx-auto lg:mx-0 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              The all-in-one platform to plan, promote, and execute world-class events with precision and ease.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link to="/events" className="rounded-xl bg-[#1132d4] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0f2dc0] hover:shadow-xl hover:shadow-blue-700/30">
                Start Planning Free
              </Link>
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
                <CirclePlay className="size-4"/>
                Watch Demo
              </button>
            </div>
          </div>

          {/* ── Event image collage frame ── */}
          <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-[#c8d8f5] bg-[#d0ddf5] shadow-2xl shadow-blue-200/50 dark:border-[#1a2b55] dark:bg-[#080c1e] dark:shadow-black/60">
            {/* 4-panel mosaic: tall concert left · conference + wedding top-right · gala wide bottom-right */}
            <div className="grid h-full min-h-[420px] grid-cols-[1.15fr_0.9fr_0.95fr] grid-rows-[1.1fr_0.9fr] gap-1.5 p-1.5">

              {/* Blue-lit concert — tall left panel (row-span-2) */}
              <div className="row-span-2 overflow-hidden rounded-[1.25rem]">
                <img
                  src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=560&q=82&fit=crop"
                  alt="Live concert event"
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>

              {/* Blue-lit tech conference — top center */}
              <div className="overflow-hidden rounded-[1.25rem]">
                <img
                  src="https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=380&q=82&fit=crop"
                  alt="Corporate conference"
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>

              {/* Cool-tone wedding — top right */}
              <div className="overflow-hidden rounded-[1.25rem]">
                <img
                  src="https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=380&q=82&fit=crop"
                  alt="Elegant wedding ceremony"
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>

              {/* Blue-atmosphere gala — wide bottom-right (col-span-2) */}
              <div className="col-span-2 overflow-hidden rounded-[1.25rem]">
                <img
                  src="https://images.unsplash.com/photo-1478146059778-26028b07395a?w=700&q=82&fit=crop"
                  alt="Gala dinner event"
                  className="h-full w-full object-cover object-top transition-transform duration-700 hover:scale-105"
                />
              </div>
            </div>

            {/* Event-type genre pill — matches brand blue */}
            <div className="absolute left-4 top-4">
              <div className="rounded-full border border-[#1132d4]/30 bg-[#1132d4]/80 px-3.5 py-1.5 backdrop-blur-md dark:border-[#4f7cff]/30 dark:bg-[#0f1b38]/85">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/92">
                  Concerts · Galas · Conferences · Weddings
                </p>
              </div>
            </div>

            {/* Bottom gradient scrim — blue-tinted */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#06091a]/70 to-transparent" />

            {/* Bottom overlay — tagline + stat badge */}
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
              <div className="rounded-2xl border border-[#3b5bdb]/25 bg-[#0b1540]/65 px-4 py-3 backdrop-blur-md dark:border-[#4f7cff]/20 dark:bg-[#080c1e]/70">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#93b4ff]">EventZen</p>
                <p className="mt-0.5 text-base font-bold leading-snug text-white">Every event. One platform.</p>
              </div>
              <div className="flex flex-col items-center rounded-2xl border border-[#3b5bdb]/25 bg-[#0b1540]/65 px-4 py-3 text-center backdrop-blur-md dark:border-[#4f7cff]/20 dark:bg-[#080c1e]/70">
                <p className="text-xl font-black leading-none text-white">2.4K+</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#93b4ff]">Events</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black/5 bg-white px-4 py-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          Trusted by Global Industry Leaders
        </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {trustedBrands.map((brand) => (<div key={brand.name} className="inline-flex min-w-[132px] items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[#1132d4]/30 hover:shadow-[0_4px_20px_rgba(17,50,212,0.15),0_0_0_1px_rgba(17,50,212,0.10)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#4f7cff]/40 dark:hover:shadow-[0_4px_24px_rgba(79,124,255,0.22),0_0_14px_rgba(79,124,255,0.14)]">
                <div className={`grid size-8 place-items-center rounded-xl bg-gradient-to-br ${brand.accent} text-sm font-black text-slate-950`}>
                  {brand.mark}
                </div>
                <span className="text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300">{brand.name}</span>
              </div>))}
          </div>
        </section>

      <section id="services" className="relative py-14 bg-white dark:bg-[#080c1e] overflow-hidden">
        <TubesHeroBackground />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#1132d4] dark:text-[#7aa3ff]">
              Professional Suites
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">Our Services</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Comprehensive tools designed specifically for the modern event professional.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => {
            const Icon = service.icon;
            return (<article key={service.title} className="group rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#1132d4]/30 hover:shadow-[0_8px_30px_rgba(17,50,212,0.18),0_0_0_1px_rgba(17,50,212,0.12)] dark:border-white/10 dark:bg-[#0f172e] dark:hover:border-[#4f7cff]/40 dark:hover:shadow-[0_8px_40px_rgba(79,124,255,0.25),0_0_18px_rgba(79,124,255,0.15)]">
                  <div className="inline-flex rounded-xl bg-blue-50 p-3 transition-all duration-300 group-hover:bg-blue-100 group-hover:shadow-[0_0_12px_rgba(17,50,212,0.35)] dark:bg-blue-500/15 dark:group-hover:bg-blue-500/25 dark:group-hover:shadow-[0_0_16px_rgba(79,124,255,0.5)]">
                    <Icon className="size-5 text-[#1132d4] transition-colors group-hover:text-[#1132d4] dark:text-blue-300 dark:group-hover:text-[#93b4ff]"/>
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{service.description}</p>
                </article>);
        })}
          </div>
        </div>
      </section>

      {/* ── Upcoming Experiences Carousel ── */}
      <section id="events" className="border-y border-black/5 bg-white/60 dark:border-white/10 dark:bg-[#0b1327]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Upcoming Experiences</h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Discover and register for industry-leading events powered by EventZen.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!upcomingLoading && !upcomingError && eventPageCount > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { restartEventsTimer(); navigateEvents(-1); }}
                    className="group inline-flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-[#1132d4]/50 hover:bg-[#1132d4]/5 hover:shadow-[0_0_12px_rgba(17,50,212,0.5),0_0_0_1px_rgba(17,50,212,0.3)] dark:border-white/15 dark:bg-white/5 dark:hover:border-[#4f7cff]/60 dark:hover:shadow-[0_0_14px_rgba(79,124,255,0.65),0_0_0_1px_rgba(79,124,255,0.3)]"
                    aria-label="Previous event"
                  >
                    <ArrowLeft className="size-4 text-slate-500 transition-colors group-hover:text-[#1132d4] dark:text-slate-400 dark:group-hover:text-[#7aa3ff]" />
                  </button>
                  <button
                    onClick={() => { restartEventsTimer(); navigateEvents(1); }}
                    className="group inline-flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-[#1132d4]/50 hover:bg-[#1132d4]/5 hover:shadow-[0_0_12px_rgba(17,50,212,0.5),0_0_0_1px_rgba(17,50,212,0.3)] dark:border-white/15 dark:bg-white/5 dark:hover:border-[#4f7cff]/60 dark:hover:shadow-[0_0_14px_rgba(79,124,255,0.65),0_0_0_1px_rgba(79,124,255,0.3)]"
                    aria-label="Next event"
                  >
                    <ArrowRight className="size-4 text-slate-500 transition-colors group-hover:text-[#1132d4] dark:text-slate-400 dark:group-hover:text-[#7aa3ff]" />
                  </button>
                </div>
              )}
              <Link to="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1132d4] transition-colors hover:text-[#0f2dc0] dark:text-[#7aa3ff] dark:hover:text-[#a5c3ff]">
                View All
                <ArrowRight className="size-4"/>
              </Link>
            </div>
          </div>

          {upcomingError ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {upcomingError}
            </div>
          ) : upcomingLoading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-400">
              Loading upcoming experiences...
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-400">
              No upcoming events are available right now.
            </div>
          ) : (
            <div className="relative overflow-hidden">
              {/* Dot indicators */}
              {eventPageCount > 1 && (
                <div className="mb-4 flex items-center justify-center gap-2">
                  {Array.from({ length: eventPageCount }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { restartEventsTimer(); setEventsTransitionDir(i > eventsCarouselIndex ? 1 : -1); setEventsAnimating(true); setTimeout(() => { setEventsCarouselIndex(i); setEventsAnimating(false); }, 350); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === eventsCarouselIndex
                          ? "w-6 bg-[#1132d4] shadow-[0_0_8px_rgba(17,50,212,0.8)] dark:bg-[#7aa3ff] dark:shadow-[0_0_10px_rgba(79,124,255,0.9)]"
                          : "w-2 bg-slate-300 hover:bg-[#1132d4]/50 dark:bg-white/20 dark:hover:bg-[#4f7cff]/50"
                      }`}
                      aria-label={`Go to event ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Slide */}
              <div
                className="transition-all duration-350"
                style={{
                  opacity: eventsAnimating ? 0 : 1,
                  transform: eventsAnimating
                    ? `translateX(${eventsTransitionDir > 0 ? "-32px" : "32px"})`
                    : "translateX(0)",
                  transition: "opacity 0.35s ease, transform 0.35s ease",
                }}
              >
                {(() => {
                  const slideEvents = upcomingEvents.slice(eventsCarouselIndex * eventsPerPage, (eventsCarouselIndex + 1) * eventsPerPage);
                  return (
                    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
                      {slideEvents.map((event, index) => {
                        const visualIndex = eventsCarouselIndex * eventsPerPage + index;
                        const EventIcon = [Globe2, Sparkles, ChartColumn][visualIndex % 3];
                        const locationLabel = event.venueCity
                          ? `${event.venueCity}${event.venueName ? `, ${event.venueName}` : ""}`
                          : (event.venueName || "Venue TBD");
                        return (
                          <article key={event.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#1132d4]/30 hover:shadow-[0_16px_56px_rgba(17,50,212,0.22),0_0_0_1.5px_rgba(17,50,212,0.15),0_0_32px_rgba(17,50,212,0.12)] dark:border-white/10 dark:bg-[#0f172e] dark:hover:border-[#4f7cff]/50 dark:hover:shadow-[0_16px_64px_rgba(79,124,255,0.35),0_0_0_1.5px_rgba(79,124,255,0.25),0_0_40px_rgba(79,124,255,0.2)]">
                            <div className="relative h-40 overflow-hidden">
                              <img
                                src={event.bannerImageUrl || getEventPlaceholderImage(event.id)}
                                alt={event.title}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.3),transparent_24%),linear-gradient(180deg,rgba(10,17,43,0.18),rgba(10,17,43,0.72))]" />
                              <div className="absolute left-5 top-5 rounded-2xl border border-white/30 bg-white/30 p-3 backdrop-blur-sm transition-all duration-300 group-hover:border-[#4f7cff]/50 group-hover:bg-[#1132d4]/20 group-hover:shadow-[0_0_16px_rgba(79,124,255,0.6)]">
                                <EventIcon className="size-6 text-white transition-colors group-hover:text-[#a5c3ff]" />
                              </div>
                              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4">
                                <div className="rounded-2xl bg-slate-950/55 px-3 py-2 backdrop-blur-sm">
                                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Featured</p>
                                  <p className="mt-1 text-sm font-semibold text-white">{event.venueCity || "Upcoming"}</p>
                                </div>
                                {registeredEventIds.has(event.id) ? (
                                  <div className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm shadow-[0_0_10px_rgba(52,211,153,0.35)]">
                                    Already Registered
                                  </div>
                                ) : (
                                  <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                    {getEventStatusLabel(event.status)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-1 flex-col p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#1132d4] dark:text-[#7aa3ff]">
                                {formatEventDate(event.startTime, event.endTime)}
                              </p>
                              <h3 className="mt-1.5 min-h-[3.5rem] text-base font-semibold leading-snug tracking-tight">
                                {event.title}
                              </h3>
                              <div className="mt-2 flex min-h-[4.75rem] flex-col gap-2">
                                <p className="inline-flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                                  <span className="line-clamp-2">{locationLabel}</span>
                                </p>
                                <p className="inline-flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                                  <Tag className="mt-0.5 size-3.5 shrink-0" />
                                  <span className="line-clamp-2">{event.tags.length ? event.tags.join(", ") : event.eventType}</span>
                                </p>
                              </div>
                              <Link
                                to={`/events/${event.id}`}
                                className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-[#0b1b4e] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#1132d4] hover:shadow-[0_0_20px_rgba(17,50,212,0.55),0_0_0_1px_rgba(17,50,212,0.3)] dark:hover:shadow-[0_0_24px_rgba(79,124,255,0.6),0_0_0_1px_rgba(79,124,255,0.35)]"
                              >
                                View Event
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Testimonials Carousel ── */}
      <section id="pricing" className="relative py-10 bg-white dark:bg-[#080c1e] overflow-hidden">
        <TubesHeroBackground />
        <div className="relative px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[#c8d8f0] bg-[linear-gradient(135deg,#f4f8fc_0%,#e8f0f8_42%,#d6e5f1_100%)] px-6 py-10 shadow-[0_24px_80px_-40px_rgba(34,56,91,0.35)] transition-all duration-300 hover:border-[#1132d4]/35 hover:shadow-[0_24px_80px_-40px_rgba(34,56,91,0.35),0_0_40px_rgba(17,50,212,0.12),0_0_0_1px_rgba(17,50,212,0.08)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#14203a_0%,#1b2a49_45%,#22365b_100%)] dark:hover:border-[#4f7cff]/35 dark:hover:shadow-[0_24px_80px_-40px_rgba(0,0,0,0.5),0_0_50px_rgba(79,124,255,0.2),0_0_0_1px_rgba(79,124,255,0.15)] sm:px-10 lg:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(143,181,210,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(79,124,160,0.22),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(122,163,255,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(111,145,190,0.16),transparent_30%)]"/>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/20"/>

            {/* Section label */}
            <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[#1132d4] dark:text-[#7aa3ff]">
              What Our Clients Say
            </p>

            {/* Slide content */}
            <div
              className="relative mt-5 mx-auto max-w-3xl text-center"
              style={{
                opacity: testimonialsAnimating ? 0 : 1,
                transform: testimonialsAnimating
                  ? `translateY(${testimonialsTransitionDir > 0 ? "16px" : "-16px"})`
                  : "translateY(0)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
              }}
            >
              <Quote className="mx-auto mb-3 size-6 text-[#1132d4]/30 dark:text-[#7aa3ff]/30" />
              <p className="font-display text-lg font-semibold leading-relaxed italic tracking-tight text-[#1f3553] dark:text-white sm:text-xl">
                {testimonials[testimonialsIndex].quote}
              </p>
              <div className="mt-6 flex flex-col items-center gap-1.5">
                <div className="relative">
                  <img
                    src={testimonials[testimonialsIndex].avatar}
                    alt={testimonials[testimonialsIndex].name}
                    className="size-11 rounded-full border-2 border-white/70 object-cover shadow-xl transition-all duration-300 dark:border-white/20 hover:border-[#1132d4]/60 hover:shadow-[0_0_20px_rgba(17,50,212,0.55)] dark:hover:border-[#4f7cff]/60 dark:hover:shadow-[0_0_24px_rgba(79,124,255,0.7)]"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[#1132d4]/0 transition-all duration-300 hover:ring-[#1132d4]/40 dark:hover:ring-[#4f7cff]/50" />
                </div>
                <p className="font-semibold text-[#213754] dark:text-white">{testimonials[testimonialsIndex].name}</p>
                <p className="text-sm text-[#5f7690] dark:text-white/70">{testimonials[testimonialsIndex].title}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="relative mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => { restartTestimonialsTimer(); navigateTestimonials(-1); }}
                className="group inline-flex size-9 items-center justify-center rounded-full border border-[#c8d8f0] bg-white/60 backdrop-blur-sm transition-all duration-200 hover:border-[#1132d4]/50 hover:bg-[#1132d4]/8 hover:shadow-[0_0_14px_rgba(17,50,212,0.55),0_0_0_1px_rgba(17,50,212,0.3)] dark:border-white/15 dark:bg-white/5 dark:hover:border-[#4f7cff]/60 dark:hover:shadow-[0_0_16px_rgba(79,124,255,0.7),0_0_0_1px_rgba(79,124,255,0.35)]"
                aria-label="Previous testimonial"
              >
                <ArrowLeft className="size-4 text-[#1132d4]/60 transition-colors group-hover:text-[#1132d4] dark:text-[#7aa3ff]/60 dark:group-hover:text-[#7aa3ff]" />
              </button>

              {/* Dot indicators */}
              <div className="flex items-center gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { restartTestimonialsTimer(); setTestimonialsTransitionDir(i > testimonialsIndex ? 1 : -1); setTestimonialsAnimating(true); setTimeout(() => { setTestimonialsIndex(i); setTestimonialsAnimating(false); }, 350); }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === testimonialsIndex
                        ? "w-6 bg-[#1132d4] shadow-[0_0_8px_rgba(17,50,212,0.8)] dark:bg-[#7aa3ff] dark:shadow-[0_0_10px_rgba(79,124,255,0.9)]"
                        : "w-2 bg-slate-300 hover:bg-[#1132d4]/50 dark:bg-white/20 dark:hover:bg-[#4f7cff]/50"
                    }`}
                    aria-label={`Go to testimonial ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => { restartTestimonialsTimer(); navigateTestimonials(1); }}
                className="group inline-flex size-9 items-center justify-center rounded-full border border-[#c8d8f0] bg-white/60 backdrop-blur-sm transition-all duration-200 hover:border-[#1132d4]/50 hover:bg-[#1132d4]/8 hover:shadow-[0_0_14px_rgba(17,50,212,0.55),0_0_0_1px_rgba(17,50,212,0.3)] dark:border-white/15 dark:bg-white/5 dark:hover:border-[#4f7cff]/60 dark:hover:shadow-[0_0_16px_rgba(79,124,255,0.7),0_0_0_1px_rgba(79,124,255,0.35)]"
                aria-label="Next testimonial"
              >
                <ArrowRight className="size-4 text-[#1132d4]/60 transition-colors group-hover:text-[#1132d4] dark:text-[#7aa3ff]/60 dark:group-hover:text-[#7aa3ff]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="group relative overflow-hidden rounded-3xl border border-black/8 bg-white p-8 shadow-sm transition-all duration-300 hover:border-[#1132d4]/30 hover:shadow-[0_8px_40px_rgba(17,50,212,0.14),0_0_0_1px_rgba(17,50,212,0.08)] dark:border-white/10 dark:bg-[#0f172e] dark:hover:border-[#4f7cff]/40 dark:hover:shadow-[0_8px_48px_rgba(79,124,255,0.22),0_0_24px_rgba(79,124,255,0.14)] sm:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent transition-opacity duration-300 group-hover:from-blue-100/60 dark:from-blue-500/5 dark:group-hover:from-blue-500/10 pointer-events-none"/>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="font-display text-2xl font-bold tracking-tight">Stay in the Loop</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Get the latest trends in event management and exclusive early access to platform updates.
              </p>
            </div>
            <form className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto">
              <input placeholder="Enter your email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-2 focus:ring-[#1132d4]/20 dark:border-white/15 dark:bg-white/5 lg:w-72"/>
              <button className="rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-700/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0f2dc0] hover:shadow-md hover:shadow-blue-700/25">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>);
}
