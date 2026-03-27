import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarRange, CirclePlus, ImagePlus, MapPin, PencilLine, RefreshCw, Rocket, Ticket, Trash2, Users, X } from "lucide-react";
import { useLocation } from "react-router";
import { DateTimeScheduler } from "../components/ui/date-time-scheduler";
import { eventApi, getEventStatusLabel } from "../lib/event-api";
import { venueVendorApi } from "../lib/venue-vendor-api";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { portalFromPath } from "../lib/roles";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
const formatDate = (value) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const eventStatuses = ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "ARCHIVED"];
const getStatusBadgeClass = (status) => {
    switch (status) {
        case "DRAFT":
            return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
        case "ARCHIVED":
            return "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300";
        default:
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    }
};
const createLocalId = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
const createAgendaDraft = () => ({
  localId: createLocalId(),
    agendaTitle: "",
    type: "",
    startTime: "",
    endTime: "",
    description: ""
});
const createSessionDraft = () => ({
  localId: createLocalId(),
    persisted: false,
    sessionTitle: "",
    speakerName: "",
    speakerId: "",
    speakerPhotoUrl: "",
    speakerBio: "",
    speakerRole: "",
    speakerCompany: "",
    room: "",
    sessionType: "",
    startTime: "",
    endTime: "",
    capacity: "",
    description: ""
});
const createTicketTierDraft = () => ({
  localId: createLocalId(),
    ticketName: "",
    tierCode: "GENERAL",
    price: "",
    totalQuantity: "",
    maxPerOrder: "1",
    description: ""
});
const toDateTimeLocalValue = (value) => {
    if (!value) {
        return "";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }
    const offset = parsed.getTimezoneOffset();
    const local = new Date(parsed.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
};
const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
        }
        reject(new Error("Unable to read the selected file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
});
export function AdminEvents() {
    const location = useLocation();
    const session = useAuthSession();
    const portal = portalFromPath(location.pathname) || "ADMIN";
    const isAdminPortal = portal === "ADMIN";
    const [events, setEvents] = useState([]);
    const [categories, setCategories] = useState([]);
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [windowFilter, setWindowFilter] = useState("ALL");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [ticketTypesByEvent, setTicketTypesByEvent] = useState({});
    const [loadingTicketTypesFor, setLoadingTicketTypesFor] = useState("");
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState("create");
    const [editingEventId, setEditingEventId] = useState("");
    const [editorLoading, setEditorLoading] = useState(false);
    const [editorTicketTiersReadOnly, setEditorTicketTiersReadOnly] = useState(false);
    const [removedSessionIds, setRemovedSessionIds] = useState([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventType, setEventType] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [expectedAttendees, setExpectedAttendees] = useState("");
    const [capacity, setCapacity] = useState("");
    const [estimatedBudget, setEstimatedBudget] = useState("");
    const [tags, setTags] = useState("");
    const [bannerImageUrl, setBannerImageUrl] = useState("");
    const [bannerPreview, setBannerPreview] = useState("");
    const [venueId, setVenueId] = useState("");
    const [agendaDrafts, setAgendaDrafts] = useState([createAgendaDraft()]);
    const [sessionDrafts, setSessionDrafts] = useState([createSessionDraft()]);
    const [sessionPhotoPreviews, setSessionPhotoPreviews] = useState({});
    const [ticketTierDrafts, setTicketTierDrafts] = useState([createTicketTierDraft()]);
    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [eventData, categoryData, venueData] = await Promise.all([
                eventApi.listEvents({
                    organizerId: isAdminPortal ? undefined : session?.user.id,
                    size: 50
                }),
                eventApi.listCategories(),
                venueVendorApi.listVenues({ limit: 50 })
            ]);
            setEvents(eventData.content);
            setCategories(categoryData);
            setVenues(venueData.items);
            if (!selectedEventId && eventData.content.length > 0) {
                setSelectedEventId(eventData.content[0].id);
            }
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load admin event data.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, [isAdminPortal, session?.user.id]);
    const venueLookup = useMemo(() => Object.fromEntries(venues.map((venue) => [venue.venueId, venue])), [venues]);
    const filteredEvents = useMemo(() => {
        const now = new Date();
        return events.filter((event) => {
            const eventDate = new Date(event.startTime);
            if (windowFilter === "UPCOMING") {
                return eventDate >= now;
            }
            if (windowFilter === "PAST") {
                return eventDate < now;
            }
            return true;
        });
    }, [events, windowFilter]);
    const selectedEvent = useMemo(() => filteredEvents.find((event) => event.id === selectedEventId) || events.find((event) => event.id === selectedEventId) || null, [events, filteredEvents, selectedEventId]);
    const selectedVenue = venueId ? venueLookup[venueId] : undefined;
    const selectedEventTicketTypes = selectedEvent ? ticketTypesByEvent[selectedEvent.id] || [] : [];
    const resetEditor = () => {
        setTitle("");
        setDescription("");
        setEventType("");
        setCategoryId("");
        setStartTime("");
        setEndTime("");
        setExpectedAttendees("");
        setCapacity("");
        setEstimatedBudget("");
        setTags("");
        setBannerImageUrl("");
        setBannerPreview("");
        setVenueId("");
        setAgendaDrafts([createAgendaDraft()]);
        setSessionDrafts([createSessionDraft()]);
        setSessionPhotoPreviews({});
        setTicketTierDrafts([createTicketTierDraft()]);
        setEditorTicketTiersReadOnly(false);
        setRemovedSessionIds([]);
    };
    const openCreateEditor = () => {
        resetEditor();
        setEditorMode("create");
        setEditingEventId("");
        setError("");
        setMessage("");
        setEditorOpen(true);
    };
    const closeEditor = () => {
        setEditorOpen(false);
        setSubmitting(false);
        setEditorLoading(false);
    };
    const ensureTicketTypesLoaded = async (eventId) => {
        if (ticketTypesByEvent[eventId]) {
            return;
        }
        setLoadingTicketTypesFor(eventId);
        try {
            const ticketTypes = await ticketingApi.listTicketTypes(eventId);
            setTicketTypesByEvent((current) => ({ ...current, [eventId]: ticketTypes }));
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load ticket tiers.");
        }
        finally {
            setLoadingTicketTypesFor("");
        }
    };
    useEffect(() => {
        if (selectedEvent) {
            void ensureTicketTypesLoaded(selectedEvent.id);
        }
    }, [selectedEvent?.id]);
    const handleBannerFileChange = async (file) => {
        if (!file) {
            setBannerPreview("");
            return;
        }
        try {
            setError("");
            const { url } = await eventApi.uploadBannerImage(file);
            setBannerImageUrl(url);
            setBannerPreview(url);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to upload the selected banner image.");
        }
    };
    const openEditEditor = async (eventId) => {
        setEditorMode("edit");
        setEditingEventId(eventId);
        setEditorLoading(true);
        setEditorOpen(true);
        setError("");
        setMessage("");
        try {
            const [detail, ticketTypes] = await Promise.all([
                eventApi.getEvent(eventId),
                ticketTypesByEvent[eventId] ? Promise.resolve(ticketTypesByEvent[eventId]) : ticketingApi.listTicketTypes(eventId)
            ]);
            const { event, agendaItems, sessions } = detail;
            setTitle(event.title);
            setDescription(event.description);
            setEventType(event.eventType);
            setCategoryId(event.categoryId);
            setStartTime(toDateTimeLocalValue(event.startTime));
            setEndTime(toDateTimeLocalValue(event.endTime));
            setExpectedAttendees(String(event.expectedAttendees));
            setCapacity(String(event.capacity));
            setEstimatedBudget(String(event.estimatedBudget ?? ""));
            setTags(event.tags.join(", "));
            setBannerImageUrl(event.bannerImageUrl || "");
            setBannerPreview("");
            setVenueId(event.venueId || "");
            setAgendaDrafts(agendaItems.length > 0
                ? agendaItems.map((item) => ({
                    localId: item.id,
                    agendaTitle: item.agendaTitle,
                    type: item.type || "",
                    startTime: toDateTimeLocalValue(item.startTime),
                    endTime: toDateTimeLocalValue(item.endTime),
                    description: item.description || ""
                }))
                : [createAgendaDraft()]);
            setSessionDrafts(sessions.length > 0
                ? sessions.map((item) => ({
                    localId: item.id,
                    persisted: true,
                    sessionTitle: item.sessionTitle,
                    speakerName: item.speakerName || "",
                    speakerId: item.speakerId || "",
                    speakerPhotoUrl: item.speakerPhotoUrl || "",
                    speakerBio: item.speakerBio || "",
                    speakerRole: item.speakerRole || "",
                    speakerCompany: item.speakerCompany || "",
                    room: item.room || "",
                    sessionType: item.sessionType || "",
                    startTime: toDateTimeLocalValue(item.startTime),
                    endTime: toDateTimeLocalValue(item.endTime),
                    capacity: item.capacity ? String(item.capacity) : "",
                    description: item.description || ""
                }))
                : [createSessionDraft()]);
            setTicketTierDrafts(ticketTypes.length > 0
                ? ticketTypes.map((item) => ({
                    localId: item.ticketTypeId,
                    ticketName: item.ticketName,
                    tierCode: item.tierCode,
                    price: String(item.price),
                    totalQuantity: String(item.totalQuantity),
                    maxPerOrder: String(item.maxPerOrder),
                    description: item.description || ""
                }))
                : [createTicketTierDraft()]);
            setTicketTypesByEvent((current) => ({ ...current, [eventId]: ticketTypes }));
            setEditorTicketTiersReadOnly(ticketTypes.length > 0);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load the event editor.");
            closeEditor();
        }
        finally {
            setEditorLoading(false);
        }
    };
    const handleStatusChange = async (eventId, status) => {
        setError("");
        setMessage("");
        try {
            await eventApi.transitionStatus(eventId, status);
            setMessage(`Event moved to ${getEventStatusLabel(status)}.`);
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Status update failed.");
        }
    };
    const handleDeleteEvent = async (eventId) => {
        const eventToDelete = events.find((event) => event.id === eventId);
        if (!eventToDelete) {
            return;
        }
        const confirmed = window.confirm(`Remove "${eventToDelete.title}"? This permanently deletes the event from Event Operations.`);
        if (!confirmed) {
            return;
        }
        setError("");
        setMessage("");
        try {
            await eventApi.deleteEvent(eventId);
            const remainingEvents = events.filter((event) => event.id !== eventId);
            setSelectedEventId(remainingEvents[0]?.id || "");
            setTicketTypesByEvent((current) => {
                const next = { ...current };
                delete next[eventId];
                return next;
            });
            setMessage(`Event "${eventToDelete.title}" was removed.`);
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to remove the event.");
        }
    };
    const updateAgendaDraft = (localId, field, value) => {
        setAgendaDrafts((current) => current.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)));
    };
    const updateSessionDraft = (localId, field, value) => {
        setSessionDrafts((current) => current.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)));
    };
    const removeSessionDraft = (draft) => {
        setSessionDrafts((current) => current.filter((item) => item.localId !== draft.localId));
        setSessionPhotoPreviews((current) => {
            const next = { ...current };
            delete next[draft.localId];
            return next;
        });
        if (draft.persisted) {
            setRemovedSessionIds((current) => (current.includes(draft.localId) ? current : [...current, draft.localId]));
        }
    };
    const handleSessionPhotoFileChange = async (localId, file) => {
        if (!file) {
            return;
        }
        try {
            setError("");
            const { url } = await eventApi.uploadSpeakerPhoto(file);
            updateSessionDraft(localId, "speakerPhotoUrl", url);
            setSessionPhotoPreviews((current) => ({ ...current, [localId]: url }));
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to upload the selected speaker photo.");
        }
    };
    const clearSessionPhoto = (localId) => {
        updateSessionDraft(localId, "speakerPhotoUrl", "");
        setSessionPhotoPreviews((current) => {
            const next = { ...current };
            delete next[localId];
            return next;
        });
    };
    const updateTicketTierDraft = (localId, field, value) => {
        setTicketTierDrafts((current) => current.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)));
    };
    const handleSaveEvent = async () => {
        setSubmitting(true);
        setError("");
        setMessage("");
        if (!title.trim() || !eventType.trim() || !categoryId || !startTime || !endTime || !expectedAttendees || !capacity || !estimatedBudget || !description.trim()) {
            setError("Please complete all required event fields before submitting.");
            setSubmitting(false);
            return;
        }
        try {
            const agendaItems = agendaDrafts
                .filter((item) => item.agendaTitle.trim() && item.startTime && item.endTime)
                .map((item) => ({
                agendaTitle: item.agendaTitle.trim(),
                type: item.type.trim() || undefined,
                startTime: new Date(item.startTime).toISOString(),
                endTime: new Date(item.endTime).toISOString(),
                description: item.description.trim() || undefined
            }));
            const basePayload = {
                categoryId,
                title: title.trim(),
                eventType: eventType.trim(),
                description: description.trim(),
                bannerImageUrl: bannerImageUrl.trim() || undefined,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                expectedAttendees: Number(expectedAttendees),
                capacity: Number(capacity),
                estimatedBudget: Number(estimatedBudget),
                tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
                venueBooking: selectedVenue
                    ? {
                        venueId: selectedVenue.venueId,
                        venueName: selectedVenue.venueName,
                        venueCity: selectedVenue.city
                    }
                    : undefined,
                agendaItems
            };
            if (editorMode === "edit" && editingEventId) {
                const updatedEvent = await eventApi.updateEvent(editingEventId, basePayload);
                const validSessions = sessionDrafts.filter((item) => item.sessionTitle.trim() && item.startTime && item.endTime);
                for (const sessionDraft of validSessions) {
                    const sessionPayload = {
                        sessionTitle: sessionDraft.sessionTitle.trim(),
                        speakerName: sessionDraft.speakerName.trim() || undefined,
                        speakerId: sessionDraft.speakerId.trim() || undefined,
                        speakerPhotoUrl: sessionDraft.speakerPhotoUrl.trim() || undefined,
                        speakerBio: sessionDraft.speakerBio.trim() || undefined,
                        speakerRole: sessionDraft.speakerRole.trim() || undefined,
                        speakerCompany: sessionDraft.speakerCompany.trim() || undefined,
                        room: sessionDraft.room.trim() || undefined,
                        sessionType: sessionDraft.sessionType.trim() || undefined,
                        startTime: new Date(sessionDraft.startTime).toISOString(),
                        endTime: new Date(sessionDraft.endTime).toISOString(),
                        capacity: sessionDraft.capacity ? Number(sessionDraft.capacity) : undefined,
                        description: sessionDraft.description.trim() || undefined
                    };
                    if (sessionDraft.persisted) {
                        await eventApi.updateSession(editingEventId, sessionDraft.localId, sessionPayload);
                    }
                    else {
                        await eventApi.addSession(editingEventId, sessionPayload);
                    }
                }
                for (const removedSessionId of removedSessionIds) {
                    await eventApi.deleteSession(editingEventId, removedSessionId);
                }
                setSelectedEventId(updatedEvent.event.id);
                setMessage("Event details and sessions updated successfully.");
            }
            else {
                const createdEvent = await eventApi.createEvent(basePayload);
                const validSessions = sessionDrafts.filter((item) => item.sessionTitle.trim() && item.startTime && item.endTime);
                for (const sessionDraft of validSessions) {
                    await eventApi.addSession(createdEvent.event.id, {
                        sessionTitle: sessionDraft.sessionTitle.trim(),
                        speakerName: sessionDraft.speakerName.trim() || undefined,
                        speakerId: sessionDraft.speakerId.trim() || undefined,
                        speakerPhotoUrl: sessionDraft.speakerPhotoUrl.trim() || undefined,
                        speakerBio: sessionDraft.speakerBio.trim() || undefined,
                        speakerRole: sessionDraft.speakerRole.trim() || undefined,
                        speakerCompany: sessionDraft.speakerCompany.trim() || undefined,
                        room: sessionDraft.room.trim() || undefined,
                        sessionType: sessionDraft.sessionType.trim() || undefined,
                        startTime: new Date(sessionDraft.startTime).toISOString(),
                        endTime: new Date(sessionDraft.endTime).toISOString(),
                        capacity: sessionDraft.capacity ? Number(sessionDraft.capacity) : undefined,
                        description: sessionDraft.description.trim() || undefined
                    });
                }
                const createdTicketTypes = [];
                const validTicketTiers = ticketTierDrafts.filter((item) => item.ticketName.trim() && item.price && item.totalQuantity);
                for (const tier of validTicketTiers) {
                    const createdTicketType = await ticketingApi.createTicketType(createdEvent.event.id, {
                        ticketName: tier.ticketName.trim(),
                        tierCode: tier.tierCode.trim(),
                        price: Number(tier.price),
                        totalQuantity: Number(tier.totalQuantity),
                        maxPerOrder: Number(tier.maxPerOrder || 1),
                        description: tier.description.trim() || undefined
                    });
                    createdTicketTypes.push(createdTicketType);
                }
                setTicketTypesByEvent((current) => ({
                    ...current,
                    [createdEvent.event.id]: createdTicketTypes
                }));
                setSelectedEventId(createdEvent.event.id);
                setMessage(`Event created with ${validSessions.length} session(s), ${agendaItems.length} agenda item(s), and ${createdTicketTypes.length} ticket tier(s).`);
            }
            closeEditor();
            resetEditor();
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : editorMode === "edit" ? "Unable to update event." : "Unable to create event.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const getActionLabel = (status) => {
        switch (status) {
            case "DRAFT":
                return "Mark as Draft";
            case "PUBLISHED":
                return "Publish";
            case "REGISTRATION_OPEN":
                return "Open Registration";
            case "REGISTRATION_CLOSED":
                return "Close Registration";
            case "ONGOING":
                return "Mark as Ongoing";
            case "COMPLETED":
                return "Mark as Completed";
            case "ARCHIVED":
                return "Archive";
            default:
                return getEventStatusLabel(status);
        }
    };
    return (<main>
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
            <h1 className="eventzen-page-title mt-2">Manage Events</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Configure event metadata, speakers, agenda, venues, and ticketing from a single operations workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-white/15">
              <RefreshCw className="size-4"/> Refresh
            </button>
            <button type="button" onClick={openCreateEditor} className="inline-flex items-center gap-2 rounded-xl bg-[#1132d4] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-700/20">
              <CirclePlus className="size-4"/> New Event
            </button>
          </div>
        </header>

        {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {message && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-bold">Event Control Board</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Monitor event readiness, capacity, and next actions.</p>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
                {["ALL", "UPCOMING", "PAST"].map((option) => (<button key={option} type="button" onClick={() => setWindowFilter(option)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${windowFilter === option ? "bg-white text-[#1132d4] shadow-sm dark:bg-[#18254a]" : "text-slate-500 dark:text-slate-300"}`}>
                    {option === "ALL" ? "All" : option === "UPCOMING" ? "Upcoming" : "Past"}
                  </button>))}
              </div>
            </div>

            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
              <div className="hidden rounded-2xl bg-slate-50 px-5 py-4 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400 xl:grid xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)] xl:gap-4">
                <span>Event Details</span>
                <span>Date & Time</span>
                <span>Capacity</span>
                <span>Status</span>
              </div>

              <div className="mt-3 space-y-3">
                {loading ? (<div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-sm text-slate-500 dark:border-white/15">
                    Loading events...
                  </div>) : filteredEvents.length === 0 ? (<div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-sm text-slate-500 dark:border-white/15">
                    No events match the current filter.
                  </div>) : (filteredEvents.map((event) => (<button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className={`grid w-full gap-4 rounded-2xl border border-slate-200 px-5 py-5 text-left transition hover:border-[#1132d4]/30 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 md:grid-cols-2 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)] xl:items-center ${selectedEventId === event.id ? "border-[#1132d4]/30 bg-blue-50/70 shadow-sm dark:bg-[#16254c]" : "bg-white dark:bg-[#111a33]"}`}>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:hidden">Event Details</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.id}</p>
                        <p className="mt-2 truncate text-sm text-slate-500 dark:text-slate-300">{event.venueName || "Venue TBD"}</p>
                      </div>

                      <div className="min-w-0 text-sm text-slate-600 dark:text-slate-300">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:hidden">Date & Time</p>
                        <div className="mt-1 inline-flex items-start gap-2">
                          <Calendar className="mt-0.5 size-4 shrink-0 text-slate-400"/>
                          <span className="break-words">{formatDate(event.startTime)}</span>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:hidden">Capacity</p>
                        <div className="mt-1 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-900 dark:text-white">{event.expectedAttendees}</span>
                          <span className="text-slate-500">/ {event.capacity}</span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:hidden">Status</p>
                        <div className="mt-1 xl:mt-0">
                          <span className={`inline-flex max-w-full whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(event.status)}`}>
                            {getEventStatusLabel(event.status)}
                          </span>
                        </div>
                      </div>
                    </button>)))}
              </div>
            </div>
          </article>

          <aside className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            {selectedEvent ? (<div className="flex h-full flex-col">
                <div className="border-b border-slate-200 p-6 dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">EVENT EDITOR</p>
                      <h2 className="mt-2 text-3xl font-bold">{selectedEvent.title}</h2>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{selectedEvent.description}</p>
                    </div>
                    <button type="button" onClick={() => void openEditEditor(selectedEvent.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#1132d4]/30 px-4 py-2.5 text-sm font-semibold text-[#1132d4]">
                      <PencilLine className="size-4"/> Edit Details
                    </button>
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                    <img src={selectedEvent.bannerImageUrl || getEventPlaceholderImage(selectedEvent.id)} alt={selectedEvent.title} className="h-44 w-full object-cover"/>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Date</p>
                      <p className="mt-2 text-sm font-semibold">{formatDate(selectedEvent.startTime)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Budget</p>
                      <p className="mt-2 text-sm font-semibold">{formatCurrency(selectedEvent.estimatedBudget)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Venue</p>
                      <p className="mt-2 text-sm font-semibold">{selectedEvent.venueName || "Venue TBD"}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedEvent.venueCity || "City pending"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Capacity</p>
                      <p className="mt-2 text-sm font-semibold">{selectedEvent.expectedAttendees} / {selectedEvent.capacity}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Lifecycle Actions</p>
                        <p className="mt-1 text-xs text-slate-500">Set the event to any lifecycle state, or remove it completely from Event Operations.</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {eventStatuses.filter((status) => status !== selectedEvent.status).map((status) => (<button key={status} type="button" onClick={() => void handleStatusChange(selectedEvent.id, status)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-white/15">
                            {status === "DRAFT" ? <PencilLine className="size-3"/> : null}
                            {status === "PUBLISHED" ? <Rocket className="size-3"/> : null}
                            {status === "REGISTRATION_OPEN" ? <Ticket className="size-3"/> : null}
                            {status === "REGISTRATION_CLOSED" ? <Ticket className="size-3"/> : null}
                            {status === "ONGOING" ? <CalendarRange className="size-3"/> : null}
                            {status === "COMPLETED" ? <Calendar className="size-3"/> : null}
                            {getActionLabel(status)}
                          </button>))}
                        <button type="button" onClick={() => void handleDeleteEvent(selectedEvent.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
                          <Trash2 className="size-3"/>
                          Remove Event
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Ticketing Tiers</p>
                        <p className="mt-1 text-xs text-slate-500">Current sellable tiers for this event.</p>
                      </div>
                      <button type="button" onClick={openCreateEditor} className="inline-flex items-center gap-2 rounded-lg border border-[#1132d4]/30 px-3 py-2 text-xs font-semibold text-[#1132d4]">
                        <CirclePlus className="size-3.5"/> New Event
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {loadingTicketTypesFor === selectedEvent.id ? (<div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/15">Loading ticket tiers...</div>) : selectedEventTicketTypes.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/15">No ticket tiers created yet.</div>) : (selectedEventTicketTypes.map((ticketType) => (<div key={ticketType.ticketTypeId} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{ticketType.ticketName}</p>
                                <p className="text-xs text-slate-500">{ticketType.tierCode}</p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-white/10">
                                {ticketType.availableQuantity}/{ticketType.totalQuantity}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {formatCurrency(ticketType.price)} · Max {ticketType.maxPerOrder} per order
                            </p>
                            {ticketType.description && <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{ticketType.description}</p>}
                          </div>)))}
                    </div>
                  </div>
                </div>
              </div>) : (<div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-300">
                Select an event from the list to view its operational details.
              </div>)}
          </aside>
        </section>
        {editorOpen && (<div className="fixed inset-x-0 bottom-0 top-16 z-[60] flex justify-end bg-slate-950/50 backdrop-blur-sm">
            <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f172e]">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-[#0f172e]/95">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">
                    {editorMode === "edit" ? "EVENT UPDATION" : "EVENT CREATION"}
                  </p>
                  <h2 className="mt-1 text-3xl font-bold">{editorMode === "edit" ? "Update Event" : "Create Event"}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {editorMode === "edit"
                ? "Use this form to update event metadata, agenda, lifecycle-ready details, and sessions. Ticket tiers are still shown using the current live service data."
                : "Use this form to create a new event, then add sessions and ticket tiers in the same flow."}
                  </p>
                </div>
                <button type="button" onClick={closeEditor} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10">
                  <X className="size-5"/>
                </button>
              </div>

              {editorLoading ? (<div className="p-6">
                  <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-sm text-slate-500 dark:border-white/15">
                    Loading event editor...
                  </div>
                </div>) : (<div className="space-y-8 p-6">
                <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="size-5 text-[#1132d4]"/>
                    <h3 className="text-lg font-bold">Banner</h3>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium">
                        <span>Banner image URL</span>
                        <input value={bannerImageUrl} onChange={(event) => {
                    setBannerImageUrl(event.target.value);
                    setBannerPreview("");
                }} placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                      </label>
                      <label className="block text-sm font-medium">
                        <span>Upload preview image</span>
                        <input type="file" accept="image/*" onChange={(event) => handleBannerFileChange(event.target.files?.[0])} className="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1132d4] file:px-4 file:py-2 file:font-semibold file:text-white"/>
                      </label>
                      <p className="text-xs text-slate-500">Paste a banner URL or upload an image file. Either option now saves with the event.</p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                      <img src={bannerPreview || bannerImageUrl || getEventPlaceholderImage("admin-event-draft")} alt="Event banner preview" className="h-48 w-full object-cover"/>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <CalendarRange className="size-5 text-[#1132d4]"/>
                    <h3 className="text-lg font-bold">Basic Information</h3>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm font-medium md:col-span-2">
                      <span>Event Title<span className="required-mark">*</span></span>
                      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="AI Ethics Workshop" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Event Type<span className="required-mark">*</span></span>
                      <input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Conference, summit, workshop..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Category<span className="required-mark">*</span></span>
                      <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]">
                        <option value="">Select category</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Start Time<span className="required-mark">*</span></span>
                      <DateTimeScheduler value={startTime} onChange={setStartTime} placeholder="Choose event start" className="w-full" required/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>End Time<span className="required-mark">*</span></span>
                      <DateTimeScheduler value={endTime} onChange={setEndTime} placeholder="Choose event end" className="w-full" required/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Expected Attendees<span className="required-mark">*</span></span>
                      <input type="number" value={expectedAttendees} onChange={(event) => setExpectedAttendees(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Capacity<span className="required-mark">*</span></span>
                      <input type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Estimated Budget<span className="required-mark">*</span></span>
                      <input type="number" value={estimatedBudget} onChange={(event) => setEstimatedBudget(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      <span>Tags</span>
                      <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ai, leadership, flagship" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="space-y-1 text-sm font-medium md:col-span-2">
                      <span>Description<span className="required-mark">*</span></span>
                      <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-[#1132d4]"/>
                    <h3 className="text-lg font-bold">Venue Add Section</h3>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <label className="space-y-1 text-sm font-medium">
                      <span>Venue</span>
                      <select value={venueId} onChange={(event) => setVenueId(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#09132a]">
                        <option value="">Select venue or leave blank</option>
                        {venues.map((venue) => <option key={venue.venueId} value={venue.venueId}>{venue.venueName}</option>)}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/10">
                      {selectedVenue ? (<>
                          <p className="font-semibold">{selectedVenue.venueName}</p>
                          <p className="mt-1 text-slate-500">{selectedVenue.city}</p>
                          <p className="mt-2 text-slate-500">Capacity: {selectedVenue.capacity}</p>
                          <p className="mt-1 text-slate-500">Halls: {selectedVenue.halls.length}</p>
                        </>) : (<p className="text-slate-500">Select a venue to attach booking metadata during event creation.</p>)}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="size-5 text-[#1132d4]"/>
                      <h3 className="text-lg font-bold">Speaker Details And Session Builder</h3>
                    </div>
                    <button type="button" onClick={() => setSessionDrafts((current) => [...current, createSessionDraft()])} className="text-sm font-semibold text-[#1132d4]">
                      + Add Session
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {sessionDrafts.map((draft, index) => (<div key={draft.localId} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">Session {index + 1}</p>
                            {draft.persisted && <p className="mt-1 text-xs text-slate-500">Editing an existing saved session</p>}
                          </div>
                          {sessionDrafts.length > 1 && (<button type="button" onClick={() => removeSessionDraft(draft)} className="text-xs font-semibold text-rose-600">
                              Remove
                            </button>)}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-sm font-medium">
                            <span>Session Title<span className="required-mark">*</span></span>
                            <input value={draft.sessionTitle} onChange={(event) => updateSessionDraft(draft.localId, "sessionTitle", event.target.value)} placeholder="Opening Keynote" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Session Type</span>
                            <input value={draft.sessionType} onChange={(event) => updateSessionDraft(draft.localId, "sessionType", event.target.value)} placeholder="Keynote, panel, workshop" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Speaker Name</span>
                            <input value={draft.speakerName} onChange={(event) => updateSessionDraft(draft.localId, "speakerName", event.target.value)} placeholder="Speaker Name" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Speaker Role / Title</span>
                            <input value={draft.speakerRole} onChange={(event) => updateSessionDraft(draft.localId, "speakerRole", event.target.value)} placeholder="Role / Title" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Speaker Company / Organization</span>
                            <input value={draft.speakerCompany} onChange={(event) => updateSessionDraft(draft.localId, "speakerCompany", event.target.value)} placeholder="Company / Organization" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Speaker Photo URL</span>
                            <input value={draft.speakerPhotoUrl} onChange={(event) => updateSessionDraft(draft.localId, "speakerPhotoUrl", event.target.value)} placeholder="Speaker photo URL" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Speaker ID / Profile Link</span>
                            <input value={draft.speakerId} onChange={(event) => updateSessionDraft(draft.localId, "speakerId", event.target.value)} placeholder="Speaker ID or profile link" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Room / Hall</span>
                            <input value={draft.room} onChange={(event) => updateSessionDraft(draft.localId, "room", event.target.value)} placeholder="Room / Hall" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Session Capacity</span>
                            <input value={draft.capacity} onChange={(event) => updateSessionDraft(draft.localId, "capacity", event.target.value)} placeholder="Capacity" type="number" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Session Start Time<span className="required-mark">*</span></span>
                            <DateTimeScheduler value={draft.startTime} onChange={(value) => updateSessionDraft(draft.localId, "startTime", value)} placeholder="Choose session start" className="w-full" required/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Session End Time<span className="required-mark">*</span></span>
                            <DateTimeScheduler value={draft.endTime} onChange={(value) => updateSessionDraft(draft.localId, "endTime", value)} placeholder="Choose session end" className="w-full" required/>
                          </label>
                          <label className="space-y-2 text-sm font-medium">
                            <span className="text-slate-600 dark:text-slate-300">Upload speaker photo</span>
                            <input type="file" accept="image/*" onChange={(event) => handleSessionPhotoFileChange(draft.localId, event.target.files?.[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1132d4] file:px-4 file:py-2 file:font-semibold file:text-white"/>
                          </label>
                          <div className="rounded-2xl border border-dashed border-slate-300 p-3 dark:border-white/10">
                            {sessionPhotoPreviews[draft.localId] || draft.speakerPhotoUrl ? (<div className="space-y-3">
                                <img src={sessionPhotoPreviews[draft.localId] || draft.speakerPhotoUrl} alt={draft.speakerName || "Speaker preview"} className="h-40 w-full rounded-xl object-cover"/>
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => clearSessionPhoto(draft.localId)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600">
                                    Remove Photo
                                  </button>
                                  {draft.speakerPhotoUrl ? (<span className="self-center text-xs text-slate-500">This speaker photo will be saved with the session.</span>) : (<span className="self-center text-xs text-slate-500">Choose a speaker photo file or paste an image URL to save it.</span>)}
                                </div>
                              </div>) : (<p className="text-sm text-slate-500">Add a speaker photo URL or choose an image file to save and preview it here.</p>)}
                          </div>
                          <label className="space-y-1 text-sm font-medium md:col-span-2">
                            <span>Speaker Bio</span>
                            <textarea value={draft.speakerBio} onChange={(event) => updateSessionDraft(draft.localId, "speakerBio", event.target.value)} rows={3} placeholder="Speaker bio" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium md:col-span-2">
                            <span>Session Description</span>
                            <textarea value={draft.description} onChange={(event) => updateSessionDraft(draft.localId, "description", event.target.value)} rows={3} placeholder="Session notes, speaker context, or synopsis" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                        </div>
                      </div>))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-5 text-[#1132d4]"/>
                      <h3 className="text-lg font-bold">Agenda Builder</h3>
                    </div>
                    <button type="button" onClick={() => setAgendaDrafts((current) => [...current, createAgendaDraft()])} className="text-sm font-semibold text-[#1132d4]">
                      + Add Agenda Item
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {agendaDrafts.map((draft, index) => (<div key={draft.localId} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-semibold">Agenda Item {index + 1}</p>
                          {agendaDrafts.length > 1 && (<button type="button" onClick={() => setAgendaDrafts((current) => current.filter((item) => item.localId !== draft.localId))} className="text-xs font-semibold text-rose-600">
                              Remove
                            </button>)}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-sm font-medium">
                            <span>Agenda Title<span className="required-mark">*</span></span>
                            <input value={draft.agendaTitle} onChange={(event) => updateAgendaDraft(draft.localId, "agendaTitle", event.target.value)} placeholder="Opening keynote" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Agenda Type</span>
                            <input value={draft.type} onChange={(event) => updateAgendaDraft(draft.localId, "type", event.target.value)} placeholder="Keynote, break, networking" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Agenda Start Time<span className="required-mark">*</span></span>
                            <DateTimeScheduler value={draft.startTime} onChange={(value) => updateAgendaDraft(draft.localId, "startTime", value)} placeholder="Choose agenda start" className="w-full" required/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Agenda End Time<span className="required-mark">*</span></span>
                            <DateTimeScheduler value={draft.endTime} onChange={(value) => updateAgendaDraft(draft.localId, "endTime", value)} placeholder="Choose agenda end" className="w-full" required/>
                          </label>
                          <label className="space-y-1 text-sm font-medium md:col-span-2">
                            <span>Agenda Description</span>
                            <textarea value={draft.description} onChange={(event) => updateAgendaDraft(draft.localId, "description", event.target.value)} rows={3} placeholder="Agenda item description" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                        </div>
                      </div>))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="size-5 text-[#1132d4]"/>
                      <h3 className="text-lg font-bold">Ticketing Tiers</h3>
                    </div>
                    <button type="button" disabled={editorTicketTiersReadOnly} onClick={() => setTicketTierDrafts((current) => [...current, createTicketTierDraft()])} className="text-sm font-semibold text-[#1132d4] disabled:cursor-not-allowed disabled:opacity-50">
                      + Add Ticket Tier
                    </button>
                  </div>
                  {editorTicketTiersReadOnly && (<p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5">
                      Existing ticket tiers are loaded for review. The current ticketing backend does not expose a tier update endpoint yet, so direct edits stay read-only here.
                    </p>)}
                  <div className="mt-4 space-y-4">
                    {ticketTierDrafts.map((draft, index) => (<div key={draft.localId} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-semibold">Tier {index + 1}</p>
                          {ticketTierDrafts.length > 1 && (<button type="button" disabled={editorTicketTiersReadOnly} onClick={() => setTicketTierDrafts((current) => current.filter((item) => item.localId !== draft.localId))} className="text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
                              Remove
                            </button>)}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-sm font-medium">
                            <span>Ticket Name<span className="required-mark">*</span></span>
                            <input disabled={editorTicketTiersReadOnly} value={draft.ticketName} onChange={(event) => updateTicketTierDraft(draft.localId, "ticketName", event.target.value)} placeholder="VIP Delegate" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Tier Code</span>
                            <select disabled={editorTicketTiersReadOnly} value={draft.tierCode} onChange={(event) => updateTicketTierDraft(draft.localId, "tierCode", event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-[#09132a]">
                              <option value="GENERAL">GENERAL</option>
                              <option value="VIP">VIP</option>
                              <option value="SPEAKER">SPEAKER</option>
                              <option value="SPONSOR">SPONSOR</option>
                            </select>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Price<span className="required-mark">*</span></span>
                            <input disabled={editorTicketTiersReadOnly} value={draft.price} onChange={(event) => updateTicketTierDraft(draft.localId, "price", event.target.value)} placeholder="8900" type="number" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Total Quantity<span className="required-mark">*</span></span>
                            <input disabled={editorTicketTiersReadOnly} value={draft.totalQuantity} onChange={(event) => updateTicketTierDraft(draft.localId, "totalQuantity", event.target.value)} placeholder="100" type="number" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <label className="space-y-1 text-sm font-medium">
                            <span>Max Per Order</span>
                            <input disabled={editorTicketTiersReadOnly} value={draft.maxPerOrder} onChange={(event) => updateTicketTierDraft(draft.localId, "maxPerOrder", event.target.value)} placeholder="1" type="number" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-white/10">
                            {editorTicketTiersReadOnly ? "Existing ticket availability is shown from the live service." : "Ticket availability is created immediately after the event is saved."}
                          </div>
                          <label className="space-y-1 text-sm font-medium md:col-span-2">
                            <span>Tier Description</span>
                            <textarea disabled={editorTicketTiersReadOnly} value={draft.description} onChange={(event) => updateTicketTierDraft(draft.localId, "description", event.target.value)} rows={3} placeholder="Describe what this tier includes" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-[#09132a]"/>
                          </label>
                        </div>
                      </div>))}
                  </div>
                </section>

                <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-1 pt-5 dark:border-white/10 dark:bg-[#0f172e]">
                  <p className="text-xs text-slate-500">
                    {editorMode === "edit"
                    ? "Editing updates the live event metadata, agenda, and sessions. Existing ticket tiers remain read-only until their update endpoints are added."
                    : "This flow creates the event first, then adds sessions and ticket tiers using the live services."}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeEditor} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-white/15">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void handleSaveEvent()} disabled={submitting || editorLoading} className="rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 disabled:opacity-60">
                      {submitting
                    ? (editorMode === "edit" ? "Updating Event..." : "Creating Event...")
                    : editorMode === "edit"
                        ? "Update Event"
                        : "Create Event"}
                    </button>
                  </div>
                </div>
              </div>)}
            </div>
          </div>)}
      </div>
    </main>);
}
