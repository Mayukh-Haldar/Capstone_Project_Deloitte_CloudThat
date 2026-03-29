import { Calendar, ChevronDown, MapPin, Search, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LazyLoadSentinel } from "../components/LazyLoadSentinel";
import { PageNavigation } from "../components/PageNavigation";
import { eventApi, getEventStatusLabel, isPubliclyDiscoverableEvent } from "../lib/event-api";
import { ApiClientError } from "../lib/http-client";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
import { useAuthSession } from "../lib/auth-storage";
import { ticketingApi } from "../lib/ticketing-api";
const PAGE_SIZE = 6;
const FETCH_BATCH_SIZE = 18;
const formatDate = (value) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const formatLabel = (value) => value
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
const isSameDay = (left, right) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
const getLifecycleLabel = (value) => {
    switch (value) {
        case "upcoming":
            return "Upcoming";
        case "ongoing":
            return "Ongoing";
        case "past":
            return "Past";
        default:
            return "All Events";
    }
};
const getLifecycleDescription = (value) => {
    switch (value) {
        case "upcoming":
            return "Events scheduled next, ready for discovery and planning.";
        case "ongoing":
            return "Live experiences happening right now.";
        case "past":
            return "Completed events and recently closed experiences.";
        default:
            return "Browse every event stage from announced to completed.";
    }
};
const getEventLifecycle = (event) => {
    const now = new Date();
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    if (event.status === "COMPLETED" || event.status === "ARCHIVED" || end < now) {
        return "past";
    }
    if (event.status === "ONGOING" || (start <= now && end >= now)) {
        return "ongoing";
    }
    return "upcoming";
};
const eventMatchesDateFilter = (event, filter) => {
    if (filter === "all") {
        return true;
    }
    const start = new Date(event.startTime);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    switch (filter) {
        case "today":
            return isSameDay(start, now);
        case "weekend": {
            const dayOfWeek = todayStart.getDay();
            const daysUntilSaturday = dayOfWeek <= 6 ? (6 - dayOfWeek) % 7 : 0;
            const saturday = new Date(todayStart);
            saturday.setDate(todayStart.getDate() + daysUntilSaturday);
            const sunday = new Date(saturday);
            sunday.setDate(saturday.getDate() + 1);
            return isSameDay(eventDay, saturday) || isSameDay(eventDay, sunday);
        }
        case "week": {
            const weekEnd = new Date(todayStart);
            weekEnd.setDate(todayStart.getDate() + 7);
            return eventDay >= todayStart && eventDay < weekEnd;
        }
        case "month":
            return eventDay.getFullYear() === now.getFullYear() && eventDay.getMonth() === now.getMonth();
        default:
            return true;
    }
};
const eventMatchesTopic = (event, topic) => {
    if (!topic || topic === "all") {
        return true;
    }
    const normalizedTopic = topic.toLowerCase();
    if (normalizedTopic === "free") {
        return event.estimatedBudget <= 0 || event.tags.some((tag) => tag.toLowerCase() === "free");
    }
    const haystack = [event.eventType, event.categoryName, ...event.tags].join(" ").toLowerCase();
    return haystack.includes(normalizedTopic);
};
const eventMatchesLifecycle = (event, lifecycle) => {
    if (!lifecycle || lifecycle === "all") {
        return true;
    }
    return getEventLifecycle(event) === lifecycle;
};
const sortEvents = (items, sortBy) => {
    const sorted = [...items];
    sorted.sort((left, right) => {
        if (sortBy === "latest") {
            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }
        if (sortBy === "title") {
            return left.title.localeCompare(right.title);
        }
        if (sortBy === "capacity") {
            return right.capacity - left.capacity;
        }
        const popularityDelta = right.expectedAttendees +
            right.capacity * 0.15 -
            (left.expectedAttendees + left.capacity * 0.15);
        if (popularityDelta !== 0) {
            return popularityDelta;
        }
        return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
    });
    return sorted;
};
export function Events() {
    const session = useAuthSession();
    const [searchParams, setSearchParams] = useSearchParams();
    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [registeredEventIds, setRegisteredEventIds] = useState(new Set());
    const [searchDraft, setSearchDraft] = useState(searchParams.get("q") || "");
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [sourcePage, setSourcePage] = useState(0);
    const [sourceTotalPages, setSourceTotalPages] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const searchContainerRef = useRef(null);
    const suppressNextSuggestionsRef = useRef(false);
    const focusedEventId = searchParams.get("eventId");
    const query = searchParams.get("q") || "";
    const selectedCategoryId = searchParams.get("category") || "";
    const selectedCity = searchParams.get("city") || "";
    const selectedDateFilter = searchParams.get("date") || "all";
    const selectedSort = searchParams.get("sort") || "popularity";
    const selectedTopic = searchParams.get("topic") || "all";
    const selectedLifecycle = searchParams.get("lifecycle") || "all";
    const currentPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);
    const selectedCategory = useMemo(() => categories.find((category) => category.id === selectedCategoryId) || null, [categories, selectedCategoryId]);
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
    useEffect(() => {
        suppressNextSuggestionsRef.current = true;
        setSearchDraft(query);
        setSearchSuggestions([]);
        setSuggestionsOpen(false);
        setSearchLoading(false);
    }, [query, focusedEventId]);
    useEffect(() => {
        const trimmedQuery = searchDraft.trim();
        if (suppressNextSuggestionsRef.current) {
            suppressNextSuggestionsRef.current = false;
            setSearchSuggestions([]);
            setSuggestionsOpen(false);
            setSearchLoading(false);
            return;
        }
        if (trimmedQuery.length < 2) {
            setSearchSuggestions([]);
            setSuggestionsOpen(false);
            setSearchLoading(false);
            return;
        }
        let cancelled = false;
        setSearchLoading(true);
        const timeoutId = window.setTimeout(() => {
            eventApi
                .listEvents({ q: trimmedQuery, size: 6 })
                .then((page) => {
                if (cancelled) {
                    return;
                }
                setSearchSuggestions(page.content);
                setSuggestionsOpen(true);
            })
                .catch(() => {
                if (!cancelled) {
                    setSearchSuggestions([]);
                    setSuggestionsOpen(false);
                }
            })
                .finally(() => {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            });
        }, 220);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [searchDraft]);
    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!searchContainerRef.current?.contains(event.target)) {
                setSuggestionsOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, []);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const categoryPromise = eventApi.listCategories();
                const eventPromise = focusedEventId
                    ? eventApi.getEvent(focusedEventId).then((detail) => [detail.event])
                    : eventApi.listEvents({
                        q: query || undefined,
                        category: selectedCategoryId || undefined,
                        page: 0,
                        size: FETCH_BATCH_SIZE
                    });
                const [categoryData, eventData] = await Promise.all([categoryPromise, eventPromise]);
                if (cancelled) {
                    return;
                }
                setCategories(categoryData);
                if (focusedEventId) {
                    setEvents(eventData);
                    setSourcePage(1);
                    setSourceTotalPages(1);
                }
                else {
                    setEvents(eventData.content);
                    setSourcePage(1);
                    setSourceTotalPages(eventData.totalPages);
                }
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof ApiClientError ? err.message : "Unable to load events.");
                }
            }
            finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [focusedEventId, query, selectedCategoryId]);
    const cityOptions = useMemo(() => Array.from(new Set(events.map((event) => event.venueCity?.trim()).filter((city) => Boolean(city))))
        .sort((left, right) => left.localeCompare(right)), [events]);
    const topicOptions = useMemo(() => {
        const counts = new Map();
        for (const event of events) {
            const tokens = [event.eventType, ...event.tags].map((value) => value.trim()).filter(Boolean);
            for (const token of tokens) {
                const normalized = token.toLowerCase();
                counts.set(normalized, (counts.get(normalized) || 0) + 1);
            }
            if (event.estimatedBudget <= 0) {
                counts.set("free", (counts.get("free") || 0) + 1);
            }
        }
        return [...counts.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 6)
            .map(([value]) => value);
    }, [events]);
    const filteredEvents = useMemo(() => {
        const discoverableEvents = events.filter((event) => focusedEventId || isPubliclyDiscoverableEvent(event.status));
        const byCity = selectedCity
            ? discoverableEvents.filter((event) => (event.venueCity || "").toLowerCase() === selectedCity.toLowerCase())
            : discoverableEvents;
        const byDate = byCity.filter((event) => eventMatchesDateFilter(event, selectedDateFilter));
        const byTopic = byDate.filter((event) => eventMatchesTopic(event, selectedTopic));
        const byLifecycle = byTopic.filter((event) => eventMatchesLifecycle(event, selectedLifecycle));
        return sortEvents(byLifecycle, selectedSort);
    }, [events, focusedEventId, selectedCity, selectedDateFilter, selectedTopic, selectedLifecycle, selectedSort]);
    const lifecycleCounts = useMemo(() => {
        const scopedEvents = events
            .filter((event) => isPubliclyDiscoverableEvent(event.status))
            .filter((event) => (selectedCity ? (event.venueCity || "").toLowerCase() === selectedCity.toLowerCase() : true))
            .filter((event) => eventMatchesDateFilter(event, selectedDateFilter))
            .filter((event) => eventMatchesTopic(event, selectedTopic));
        return {
            all: scopedEvents.length,
            upcoming: scopedEvents.filter((event) => getEventLifecycle(event) === "upcoming").length,
            ongoing: scopedEvents.filter((event) => getEventLifecycle(event) === "ongoing").length,
            past: scopedEvents.filter((event) => getEventLifecycle(event) === "past").length
        };
    }, [events, selectedCity, selectedDateFilter, selectedTopic]);
    const totalEvents = filteredEvents.length;
    const hasMoreSourceEvents = !focusedEventId && sourcePage < sourceTotalPages;
    const totalPages = Math.max(1, Math.ceil(totalEvents / PAGE_SIZE));
    const safeCurrentPage = hasMoreSourceEvents ? currentPage : Math.min(currentPage, totalPages);
    const pageStart = totalEvents === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE;
    const pagedEvents = filteredEvents.slice(pageStart, pageStart + PAGE_SIZE);
    useEffect(() => {
        if (focusedEventId || loading || loadingMore || sourcePage >= sourceTotalPages || totalEvents >= currentPage * PAGE_SIZE) {
            return;
        }
        let cancelled = false;
        const loadMore = async () => {
            setLoadingMore(true);
            try {
                const response = await eventApi.listEvents({
                    q: query || undefined,
                    category: selectedCategoryId || undefined,
                    page: sourcePage,
                    size: FETCH_BATCH_SIZE
                });
                if (!cancelled) {
                    setEvents((current) => [...current, ...response.content]);
                    setSourcePage((current) => current + 1);
                    setSourceTotalPages(response.totalPages);
                }
            }
            catch (err) {
                if (!cancelled) {
                    setError(err instanceof ApiClientError ? err.message : "Unable to load more events.");
                }
            }
            finally {
                if (!cancelled) {
                    setLoadingMore(false);
                }
            }
        };
        void loadMore();
        return () => {
            cancelled = true;
        };
    }, [currentPage, focusedEventId, loading, loadingMore, query, selectedCategoryId, sourcePage, sourceTotalPages, totalEvents]);
    useEffect(() => {
        if (!hasMoreSourceEvents && currentPage !== safeCurrentPage) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set("page", String(safeCurrentPage));
            setSearchParams(nextParams, { replace: true });
        }
    }, [currentPage, hasMoreSourceEvents, safeCurrentPage, searchParams, setSearchParams]);
    const headline = useMemo(() => {
        if (focusedEventId && events[0]) {
            return events[0].title;
        }
        if (selectedCategory) {
            return `${selectedCategory.name} events`;
        }
        return getLifecycleLabel(selectedLifecycle);
    }, [focusedEventId, events, selectedCategory, selectedLifecycle]);
    const updateParams = (updates) => {
        const nextParams = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(updates)) {
            if (value && value !== "all" && value !== "1") {
                nextParams.set(key, value);
            }
            else {
                nextParams.delete(key);
            }
        }
        if (Object.keys(updates).some((key) => key !== "page")) {
            if (!Object.prototype.hasOwnProperty.call(updates, "eventId")) {
                nextParams.delete("eventId");
            }
            if (!("page" in updates)) {
                nextParams.delete("page");
            }
        }
        setSearchParams(nextParams);
    };
    const handleSearch = (event) => {
        event.preventDefault();
        suppressNextSuggestionsRef.current = true;
        setSearchSuggestions([]);
        setSuggestionsOpen(false);
        updateParams({
            q: searchDraft.trim() || null,
            page: "1"
        });
    };
    const openSuggestedEvent = (event) => {
        suppressNextSuggestionsRef.current = true;
        setSearchDraft(event.title);
        setSearchSuggestions([]);
        setSuggestionsOpen(false);
        updateParams({
            eventId: event.id,
            q: event.title,
            page: "1"
        });
    };
    const clearSearch = () => {
        suppressNextSuggestionsRef.current = true;
        setSearchDraft("");
        setSearchSuggestions([]);
        setSuggestionsOpen(false);
        updateParams({
            q: null,
            eventId: null,
            page: "1"
        });
    };
    return (<section className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900 dark:bg-[#09132a] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[32px] bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(219,234,254,0.96),rgba(224,242,254,0.94))] p-6 text-slate-900 shadow-xl dark:bg-[linear-gradient(135deg,#0b3aa4,#18a0fb)] dark:text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#1132d4] dark:text-white">Event Discovery</p>
          <h1 className="eventzen-page-title mt-3">{headline}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-blue-50 sm:text-base">
            {focusedEventId
            ? "Showing the exact event selected from search suggestions."
            : getLifecycleDescription(selectedLifecycle)}
          </p>
        </header>

        <div className="space-y-5 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101a33]">
          {!focusedEventId && (<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { key: "all", title: "ALL EVENTS", description: "Everything in the catalog", count: lifecycleCounts.all },
                { key: "upcoming", title: "UPCOMING", description: "Scheduled next", count: lifecycleCounts.upcoming },
                { key: "ongoing", title: "ONGOING", description: "Happening now", count: lifecycleCounts.ongoing },
                { key: "past", title: "PAST", description: "Already completed", count: lifecycleCounts.past }
            ].map((item) => {
                const active = selectedLifecycle === item.key || (item.key === "all" && selectedLifecycle === "all");
                return (<button key={item.key} type="button" onClick={() => updateParams({ lifecycle: item.key === "all" ? null : item.key, page: "1" })} className={`rounded-3xl border px-5 py-4 text-left transition ${active
                        ? "border-[#4b68ff] bg-[linear-gradient(135deg,rgba(35,65,215,0.18),rgba(65,129,255,0.1))] shadow-sm"
                        : "border-slate-200 bg-slate-50/70 hover:border-[#4b68ff]/40 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"}`}>
                    <p className="text-[11px] font-bold tracking-[0.22em] text-[#6a7ad7] dark:text-blue-200">{item.title}</p>
                    <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{item.count}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{item.description}</p>
                  </button>);
            })}
            </div>)}

          <div className="grid gap-4 lg:grid-cols-[1.7fr_0.85fr_0.9fr_0.75fr_0.75fr]">
            <form onSubmit={handleSearch} className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Events</span>
              <div ref={searchContainerRef} className="relative">
                <Search className="absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400"/>
                <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onFocus={() => {
            if (searchSuggestions.length > 0 || searchLoading) {
                setSuggestionsOpen(true);
            }
        }} onKeyDown={(event) => {
            if (event.key === "Escape") {
                setSuggestionsOpen(false);
            }
        }} placeholder="Search by name, artist, or keyword..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 pr-12 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                {searchDraft && (<button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 z-10 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear event search">
                    <X className="size-4"/>
                  </button>)}
                {suggestionsOpen && (searchLoading || searchSuggestions.length > 0) && (<div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0f172e]">
                    {searchLoading ? (<div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">Searching events...</div>) : (<div className="py-2">
                        <button type="button" onMouseDown={(pointerEvent) => {
                    pointerEvent.preventDefault();
                    clearSearch();
                }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">
                          <span>Clear search and show all events</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                            Reset
                          </span>
                        </button>
                        {searchSuggestions.map((event) => (<button key={event.id} type="button" onMouseDown={(pointerEvent) => {
                        pointerEvent.preventDefault();
                        openSuggestedEvent(event);
                    }} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {event.categoryName} · {event.venueCity || event.venueName || event.eventType}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#1132d4]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1132d4] dark:bg-[#7aa3ff]/15 dark:text-[#7aa3ff]">
                              View
                            </span>
                          </button>))}
                      </div>)}
                  </div>)}
              </div>
            </form>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Timeline</span>
              <div className="relative">
                <select value={selectedLifecycle} onChange={(event) => updateParams({ lifecycle: event.target.value || null, page: "1" })} className="w-full appearance-none rounded-2xl border border-slate-200 bg-none bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="all">All Events</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="past">Past</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Category</span>
              <div className="relative">
                <select value={selectedCategoryId} onChange={(event) => updateParams({ category: event.target.value || null, page: "1" })} className="w-full appearance-none rounded-2xl border border-slate-200 bg-none bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="">All Categories</option>
                  {categories.map((category) => (<option key={category.id} value={category.id}>
                      {category.name}
                    </option>))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">City</span>
              <div className="relative">
                <select value={selectedCity} onChange={(event) => updateParams({ city: event.target.value || null, page: "1" })} className="w-full appearance-none rounded-2xl border border-slate-200 bg-none bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="">All Cities</option>
                  {cityOptions.map((city) => (<option key={city} value={city}>
                      {city}
                    </option>))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Date</span>
              <div className="relative">
                <select value={selectedDateFilter} onChange={(event) => updateParams({ date: event.target.value || null, page: "1" })} className="w-full appearance-none rounded-2xl border border-slate-200 bg-none bg-white px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                  <option value="all">Any Date</option>
                  <option value="today">Today</option>
                  <option value="weekend">This Weekend</option>
                  <option value="week">Next 7 Days</option>
                  <option value="month">This Month</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              </div>
            </label>
          </div>

          {!focusedEventId && topicOptions.length > 0 && (<div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => updateParams({ topic: null, page: "1" })} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${selectedTopic === "all"
                ? "bg-[#2341d7] text-white shadow-sm"
                : "bg-[#e9eefc] text-[#2341d7] hover:bg-[#dce5ff] dark:bg-white/10 dark:text-blue-100"}`}>
                All
              </button>
              {topicOptions.map((topic) => (<button key={topic} type="button" onClick={() => updateParams({ topic, page: "1" })} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${selectedTopic === topic
                    ? "bg-[#2341d7] text-white shadow-sm"
                    : "bg-[#e9eefc] text-[#2341d7] hover:bg-[#dce5ff] dark:bg-white/10 dark:text-blue-100"}`}>
                  {formatLabel(topic)}
                </button>))}
            </div>)}

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-[#0c152b] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-100">
                Showing {totalEvents === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, totalEvents)} of {totalEvents} events
              </span>
              {hasMoreSourceEvents ? (
                <>
                  <span className="hidden text-slate-300 md:inline">|</span>
                  <span className="font-mono text-xs text-[#5770e6]">
                    More events load as you browse
                  </span>
                </>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <span>Sort by:</span>
              <div className="relative min-w-40">
                <select value={selectedSort} onChange={(event) => updateParams({ sort: event.target.value || null, page: "1" })} style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "none" }} className="w-full appearance-none rounded-xl border border-transparent bg-none bg-transparent py-1.5 pr-8 text-sm font-semibold text-[#2341d7] outline-none [-moz-appearance:none] [&::-ms-expand]:hidden dark:text-blue-200">
                  <option value="popularity">Popularity</option>
                  <option value="latest">Latest</option>
                  <option value="title">Title</option>
                  <option value="capacity">Capacity</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-[#2341d7] dark:text-blue-200"/>
              </div>
            </label>
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {loading ? (<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-[#101a33] dark:text-slate-300">
            Loading events...
          </div>) : pagedEvents.length === 0 && hasMoreSourceEvents ? (<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-[#101a33] dark:text-slate-300">
            Loading more events...
          </div>) : pagedEvents.length === 0 ? (<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-[#101a33] dark:text-slate-300">
            No events matched the current filters.
          </div>) : (<>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {pagedEvents.map((event) => (<article key={event.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#101a33]">
                  <img src={event.bannerImageUrl || getEventPlaceholderImage(event.id)} alt={event.title} loading="lazy" className="h-40 w-full object-cover"/>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#1132d4]/10 px-3 py-1 text-xs font-semibold text-[#1132d4]">
                        {event.categoryName}
                      </span>
                      {registeredEventIds.has(event.id) ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                          Already Registered
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-white/10">
                          {getEventStatusLabel(event.status)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h2 className="line-clamp-2 min-h-[3.5rem] text-xl font-bold">{event.title}</h2>
                      <p className="line-clamp-3 min-h-[4.5rem] text-sm text-slate-600 dark:text-slate-300">{event.description}</p>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p className="flex min-h-10 w-full items-start gap-2">
                        <Calendar className="mt-0.5 size-4 shrink-0"/>
                        <span>{formatDate(event.startTime)}</span>
                      </p>
                      <p className="flex min-h-10 w-full items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0"/>
                        <span className="line-clamp-2">
                          {event.venueName || "Venue TBD"}
                          {event.venueCity ? `, ${event.venueCity}` : ""}
                        </span>
                      </p>
                      <p className="flex min-h-10 w-full items-start gap-2">
                        <Tag className="mt-0.5 size-4 shrink-0"/>
                        <span className="line-clamp-2">{event.tags.length ? event.tags.join(", ") : event.eventType}</span>
                      </p>
                    </div>
                    <Link to={`/events/${event.id}`} className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f2dc0]">
                      View details
                    </Link>
                  </div>
                </article>))}
            </div>

            {!focusedEventId && totalPages > 1 && (<PageNavigation className="pt-2" currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={(page) => updateParams({ page: String(page) })}/>)}
            {!focusedEventId && <LazyLoadSentinel enabled={hasMoreSourceEvents && safeCurrentPage >= totalPages} loading={loadingMore} onVisible={() => {
                if (hasMoreSourceEvents) {
                    updateParams({ page: String(safeCurrentPage + 1) });
                }
            }}/>}
            {loadingMore && <p className="pt-2 text-center text-sm text-slate-500 dark:text-slate-300">Loading more events...</p>}
          </>)}
      </div>
    </section>);
}
