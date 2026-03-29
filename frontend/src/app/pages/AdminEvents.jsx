import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Calendar, CalendarRange, CheckCircle, CirclePlus, ImagePlus, MapPin, PencilLine, RefreshCw, Rocket, Search, Ticket, Trash2, Unlock, Users, X } from "lucide-react";
import { useLocation } from "react-router";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { PageNavigation } from "../components/PageNavigation";
import { DateTimeScheduler } from "../components/ui/date-time-scheduler";
import { eventApi, getEventStatusLabel, isDisabledEvent, isPendingApprovalEvent } from "../lib/event-api";
import { venueVendorApi } from "../lib/venue-vendor-api";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { portalFromPath } from "../lib/roles";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
const formatDate = (value) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const eventStatuses = ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "ARCHIVED"];
const EVENT_LIST_PAGE_SIZE = 6;
const getStatusBadgeClass = (status) => {
    switch (status) {
        case "PENDING_APPROVAL":
            return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
        case "DRAFT":
            return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
        case "ARCHIVED":
            return "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300";
        case "DISABLED_BY_VENDOR":
        case "DISABLED_BY_ADMIN":
            return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
        default:
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    }
};
const getApprovalBadgeClass = (approvalStatus) => {
    switch (approvalStatus) {
        case "APPROVED":
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
        case "CHANGES_REQUESTED":
            return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
        case "REJECTED":
            return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
        default:
            return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
    }
};
const getApprovalStatusLabel = (approvalStatus) => {
    switch (approvalStatus) {
        case "APPROVED":
            return "Approved";
        case "CHANGES_REQUESTED":
            return "Changes Requested";
        case "REJECTED":
            return "Rejected";
        default:
            return "Pending Review";
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
    persisted: false,
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
const normalizeMatchKey = (value) => String(value || "").trim().toLowerCase();
const getEventCategoryKey = (event) => event.categoryId || (event.categoryName ? `name:${normalizeMatchKey(event.categoryName)}` : "");
const getEventCategoryLabel = (event, categoryLookup) => event.categoryName || categoryLookup[event.categoryId]?.name || "Uncategorized";
const toTextValue = (value) => value == null ? "" : String(value);
const toNumericTextValue = (value) => value == null || value === "" ? "" : String(value);
const toTagString = (value) => Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).join(", ")
    : toTextValue(value);
const toDraftDateTimeValue = (value) => {
    if (!value) {
        return "";
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        return value;
    }
    return toDateTimeLocalValue(value);
};
const createAgendaDraftFromImport = (item = {}) => ({
    localId: createLocalId(),
    agendaTitle: toTextValue(item.agendaTitle ?? item.title),
    type: toTextValue(item.type),
    startTime: toDraftDateTimeValue(item.startTime),
    endTime: toDraftDateTimeValue(item.endTime),
    description: toTextValue(item.description)
});
const createSessionDraftFromImport = (item = {}) => ({
    localId: createLocalId(),
    persisted: false,
    sessionTitle: toTextValue(item.sessionTitle ?? item.title),
    speakerName: toTextValue(item.speakerName),
    speakerId: toTextValue(item.speakerId),
    speakerPhotoUrl: toTextValue(item.speakerPhotoUrl),
    speakerBio: toTextValue(item.speakerBio),
    speakerRole: toTextValue(item.speakerRole),
    speakerCompany: toTextValue(item.speakerCompany),
    room: toTextValue(item.room),
    sessionType: toTextValue(item.sessionType ?? item.type),
    startTime: toDraftDateTimeValue(item.startTime),
    endTime: toDraftDateTimeValue(item.endTime),
    capacity: toNumericTextValue(item.capacity),
    description: toTextValue(item.description)
});
const createTicketTierDraftFromImport = (item = {}) => ({
    localId: createLocalId(),
    persisted: false,
    ticketName: toTextValue(item.ticketName ?? item.name),
    tierCode: toTextValue(item.tierCode || "GENERAL") || "GENERAL",
    price: toNumericTextValue(item.price),
    totalQuantity: toNumericTextValue(item.totalQuantity ?? item.quantity),
    maxPerOrder: toNumericTextValue(item.maxPerOrder ?? 1) || "1",
    description: toTextValue(item.description)
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
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sortBy, setSortBy] = useState("start-asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [ticketTypesByEvent, setTicketTypesByEvent] = useState({});
    const [loadingTicketTypesFor, setLoadingTicketTypesFor] = useState("");
    const [enableRequests, setEnableRequests] = useState([]);
    const [loadingEnableRequests, setLoadingEnableRequests] = useState(false);
    const [requestEnableNote, setRequestEnableNote] = useState("");
    const [reviewModal, setReviewModal] = useState(null); // { requestId, eventTitle, action, note }
    const [disableModalEvent, setDisableModalEvent] = useState(null);
    const [disableSubmitting, setDisableSubmitting] = useState(false);
    const [eventRequestModal, setEventRequestModal] = useState(null);
    const [eventRequestLoading, setEventRequestLoading] = useState(false);
    const [eventRequestSubmitting, setEventRequestSubmitting] = useState(false);
    const [eventRequestNote, setEventRequestNote] = useState("");
    const [eventRequestApprovedBudget, setEventRequestApprovedBudget] = useState("");
    const [adminCreateReview, setAdminCreateReview] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState("create");
    const [editingEventId, setEditingEventId] = useState("");
    const [editorLoading, setEditorLoading] = useState(false);
    const [editorTicketTiersReadOnly, setEditorTicketTiersReadOnly] = useState(false);
    const [removedSessionIds, setRemovedSessionIds] = useState([]);
    const [removedTicketTypeIds, setRemovedTicketTypeIds] = useState([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventType, setEventType] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [expectedAttendees, setExpectedAttendees] = useState("");
    const [capacity, setCapacity] = useState("");
    const [estimatedBudget, setEstimatedBudget] = useState("");
    const [editorShowsApprovedBudget, setEditorShowsApprovedBudget] = useState(false);
    const [tags, setTags] = useState("");
    const [bannerImageUrl, setBannerImageUrl] = useState("");
    const [bannerPreview, setBannerPreview] = useState("");
    const [venueId, setVenueId] = useState("");
    const [agendaDrafts, setAgendaDrafts] = useState([createAgendaDraft()]);
    const [sessionDrafts, setSessionDrafts] = useState([createSessionDraft()]);
    const [sessionPhotoPreviews, setSessionPhotoPreviews] = useState({});
    const [ticketTierDrafts, setTicketTierDrafts] = useState([createTicketTierDraft()]);
    const [importedJsonFileName, setImportedJsonFileName] = useState("");
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
    useEffect(() => {
        if (isAdminPortal) {
            void loadEnableRequests();
        }
    }, [isAdminPortal]);
    const venueLookup = useMemo(() => Object.fromEntries(venues.map((venue) => [venue.venueId, venue])), [venues]);
    const categoryLookup = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category])), [categories]);
    const categoryOptions = useMemo(() => {
      const seen = new Map();

      events.forEach((event) => {
        const key = getEventCategoryKey(event);
        if (!key || seen.has(key)) {
          return;
        }
        seen.set(key, getEventCategoryLabel(event, categoryLookup));
      });

      return Array.from(seen.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label));
    }, [categoryLookup, events]);
    const statusOptions = useMemo(() => Array.from(new Set(events.map((event) => event.status).filter(Boolean))), [events]);
    const filteredEvents = useMemo(() => {
        const now = new Date();
      const searchKey = normalizeMatchKey(searchQuery);

      const nextEvents = events.filter((event) => {
            const eventDate = new Date(event.startTime);
            if (windowFilter === "UPCOMING") {
          if (eventDate < now) {
            return false;
          }
            }
        else if (windowFilter === "PAST") {
          if (eventDate >= now) {
            return false;
          }
            }
        if (categoryFilter !== "ALL" && getEventCategoryKey(event) !== categoryFilter) {
          return false;
        }
        if (statusFilter !== "ALL" && event.status !== statusFilter) {
          return false;
        }
        if (searchKey) {
          const eventSearchFields = [
            event.title,
            event.id,
            event.description,
            event.venueName,
            event.venueCity,
            event.eventType,
            getEventCategoryLabel(event, categoryLookup),
            Array.isArray(event.tags) ? event.tags.join(" ") : event.tags
          ];

          if (!eventSearchFields.some((value) => normalizeMatchKey(value).includes(searchKey))) {
            return false;
          }
        }

        return true;
      });

      nextEvents.sort((left, right) => {
        if (sortBy === "start-desc") {
          return new Date(right.startTime).getTime() - new Date(left.startTime).getTime();
        }
        if (sortBy === "title") {
          return left.title.localeCompare(right.title);
        }
        if (sortBy === "status") {
          return getEventStatusLabel(left.status).localeCompare(getEventStatusLabel(right.status));
        }
        return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
      });

      return nextEvents;
    }, [events, windowFilter, categoryFilter, statusFilter, searchQuery, sortBy, categoryLookup]);
    const pendingEventRequests = useMemo(() => events
        .filter((event) => isPendingApprovalEvent(event))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [events]);
    const totalPages = filteredEvents.length === 0 ? 0 : Math.ceil(filteredEvents.length / EVENT_LIST_PAGE_SIZE);
    const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
    const pageStart = (safeCurrentPage - 1) * EVENT_LIST_PAGE_SIZE;
    const pagedEvents = filteredEvents.slice(pageStart, pageStart + EVENT_LIST_PAGE_SIZE);
    const selectedEvent = useMemo(() => filteredEvents.find((event) => event.id === selectedEventId) || null, [filteredEvents, selectedEventId]);
    const selectedVenue = venueId ? venueLookup[venueId] : undefined;
    const selectedEventTicketTypes = selectedEvent ? ticketTypesByEvent[selectedEvent.id] || [] : [];
    const getCapacitySnapshot = (event) => {
        const ticketTypes = ticketTypesByEvent[event.id] || [];
        const totalCapacity = ticketTypes.reduce((sum, ticketType) => sum + (Number(ticketType.totalQuantity) || 0), 0) || event.capacity || 0;
        const bookedCount = ticketTypes.length > 0
            ? ticketTypes.reduce((sum, ticketType) => sum + Math.max((Number(ticketType.totalQuantity) || 0) - (Number(ticketType.availableQuantity) || 0), 0), 0)
            : 0;
        return { bookedCount, totalCapacity };
    };
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
        setEditorShowsApprovedBudget(false);
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
        setRemovedTicketTypeIds([]);
        setImportedJsonFileName("");
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
        setAdminCreateReview(null);
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
    useEffect(() => {
      setCurrentPage(1);
    }, [windowFilter, categoryFilter, statusFilter, searchQuery, sortBy]);
    useEffect(() => {
      if (filteredEvents.length === 0) {
        setSelectedEventId("");
        return;
      }

      if (!filteredEvents.some((event) => event.id === selectedEventId)) {
        setSelectedEventId(filteredEvents[0].id);
      }
    }, [filteredEvents, selectedEventId]);
    useEffect(() => {
      const missingEventIds = pagedEvents
            .map((event) => event.id)
            .filter((eventId) => !ticketTypesByEvent[eventId]);
        if (missingEventIds.length === 0) {
            return;
        }
        void Promise.allSettled(missingEventIds.map(async (eventId) => {
            try {
                const ticketTypes = await ticketingApi.listTicketTypes(eventId);
                setTicketTypesByEvent((current) => ({ ...current, [eventId]: ticketTypes }));
            }
            catch {
                // Keep the event visible even if ticketing data is temporarily unavailable.
            }
        }));
          }, [pagedEvents, ticketTypesByEvent]);
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
    const resolveImportedCategoryId = (payload) => {
        const requested = payload.categoryId ?? payload.category ?? payload.categoryName;
        if (!requested) {
            return "";
        }
        const matchKey = normalizeMatchKey(requested);
        return categories.find((category) => category.id === requested || normalizeMatchKey(category.name) === matchKey)?.id || "";
    };
    const resolveImportedVenue = (payload) => {
        const venuePayload = payload.venueBooking ?? payload.venue ?? {};
        const requestedVenueId = venuePayload.venueId ?? payload.venueId;
        const requestedVenueName = venuePayload.venueName ?? payload.venueName;
        if (requestedVenueId) {
            return venues.find((venue) => venue.venueId === requestedVenueId) || null;
        }
        if (requestedVenueName) {
            const matchKey = normalizeMatchKey(requestedVenueName);
            return venues.find((venue) => normalizeMatchKey(venue.venueName) === matchKey) || null;
        }
        return null;
    };
    const applyImportedEventDraft = (payload) => {
        const categoryMatch = resolveImportedCategoryId(payload);
        const venueMatch = resolveImportedVenue(payload);
        const importedAgendaItems = Array.isArray(payload.agendaItems) ? payload.agendaItems : [];
        const importedSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
        const importedTicketTiers = Array.isArray(payload.ticketTiers)
            ? payload.ticketTiers
            : Array.isArray(payload.ticketTypes)
                ? payload.ticketTypes
                : [];

        setTitle(toTextValue(payload.title));
        setDescription(toTextValue(payload.description));
        setEventType(toTextValue(payload.eventType));
        setCategoryId(categoryMatch);
        setStartTime(toDraftDateTimeValue(payload.startTime));
        setEndTime(toDraftDateTimeValue(payload.endTime));
        setExpectedAttendees(toNumericTextValue(payload.expectedAttendees));
        setCapacity(toNumericTextValue(payload.capacity));
        setEstimatedBudget(toNumericTextValue(payload.estimatedBudget ?? payload.proposedBudget ?? payload.budget));
        setTags(toTagString(payload.tags));
        setBannerImageUrl(toTextValue(payload.bannerImageUrl));
        setBannerPreview("");
        setVenueId(venueMatch?.venueId || "");
        setAgendaDrafts(importedAgendaItems.length > 0
            ? importedAgendaItems.map(createAgendaDraftFromImport)
            : [createAgendaDraft()]);
        setSessionDrafts(importedSessions.length > 0
            ? importedSessions.map(createSessionDraftFromImport)
            : [createSessionDraft()]);
        setSessionPhotoPreviews({});
        setTicketTierDrafts(importedTicketTiers.length > 0
            ? importedTicketTiers.map(createTicketTierDraftFromImport)
            : [createTicketTierDraft()]);
        setEditorTicketTiersReadOnly(false);
        setRemovedSessionIds([]);
        setRemovedTicketTypeIds([]);
    };
    const handleImportEventJson = async (file) => {
        if (!file) {
            return;
        }
        try {
            setError("");
            const raw = await file.text();
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("The uploaded JSON must be a single event object.");
            }
            applyImportedEventDraft(parsed);
            setImportedJsonFileName(file.name);
            setMessage(`Imported event draft from ${file.name}. Review the fields below before submitting.`);
        }
        catch (err) {
            setImportedJsonFileName("");
            setError(err instanceof Error ? err.message : "Unable to import the selected JSON file.");
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
            setEstimatedBudget(String(event.approvedBudget ?? event.estimatedBudget ?? ""));
            setEditorShowsApprovedBudget(event.approvedBudget != null);
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
            const canEditExistingTicketTiers = !isAdminPortal
                && event.status === "PENDING_APPROVAL"
                && (event.approvalStatus === "PENDING" || event.approvalStatus === "CHANGES_REQUESTED");
            setTicketTierDrafts(ticketTypes.length > 0
                ? ticketTypes.map((item) => ({
                    localId: item.ticketTypeId,
                    persisted: true,
                    ticketName: item.ticketName,
                    tierCode: item.tierCode,
                    price: String(item.price),
                    totalQuantity: String(item.totalQuantity),
                    maxPerOrder: String(item.maxPerOrder),
                    description: item.description || ""
                }))
                : [createTicketTierDraft()]);
            setTicketTypesByEvent((current) => ({ ...current, [eventId]: ticketTypes }));
            setEditorTicketTiersReadOnly(ticketTypes.length > 0 && !canEditExistingTicketTiers);
            setRemovedTicketTypeIds([]);
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
    const handleDisableEvent = async (eventId) => {
        const eventTarget = events.find((event) => event.id === eventId);
        if (!eventTarget) return;
        setDisableModalEvent(eventTarget);
    };
    const confirmDisableEvent = async () => {
        if (!disableModalEvent) return;
        const eventTarget = disableModalEvent;
        setError("");
        setMessage("");
        setDisableSubmitting(true);
        try {
            await eventApi.disableEvent(eventTarget.id);
            setMessage(`Event "${eventTarget.title}" has been disabled.`);
            setDisableModalEvent(null);
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to disable the event.");
        }
        finally {
            setDisableSubmitting(false);
        }
    };
    const handleEnableEvent = async (eventId) => {
        const eventTarget = events.find((event) => event.id === eventId);
        if (!eventTarget) return;
        setError("");
        setMessage("");
        try {
            await eventApi.enableEvent(eventId);
            setMessage(`Event "${eventTarget.title}" has been re-enabled.`);
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to enable the event.");
        }
    };
    const openEventRequestReview = async (eventId) => {
        setEventRequestLoading(true);
        setError("");
        try {
            const [detail, ticketTypes] = await Promise.all([
                eventApi.getEvent(eventId),
                ticketTypesByEvent[eventId] ? Promise.resolve(ticketTypesByEvent[eventId]) : ticketingApi.listTicketTypes(eventId)
            ]);
            setTicketTypesByEvent((current) => ({ ...current, [eventId]: ticketTypes }));
            setEventRequestModal({ detail, ticketTypes });
            setEventRequestApprovedBudget(String(detail.event.approvedBudget ?? detail.event.proposedBudget ?? detail.event.estimatedBudget ?? ""));
            setEventRequestNote(detail.event.approvalNote || "");
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load the event request review.");
        }
        finally {
            setEventRequestLoading(false);
        }
    };
    const closeEventRequestReview = () => {
        if (eventRequestSubmitting) {
            return;
        }
        setEventRequestModal(null);
        setEventRequestNote("");
        setEventRequestApprovedBudget("");
    };
    const submitEventRequestDecision = async (action) => {
        if (!eventRequestModal) {
            return;
        }
        setEventRequestSubmitting(true);
        setError("");
        setMessage("");
        try {
            const eventId = eventRequestModal.detail.event.id;
            if (action === "approve") {
                await eventApi.approveEventRequest(eventId, {
                    approvedBudget: Number(eventRequestApprovedBudget),
                    note: eventRequestNote.trim() || undefined
                });
                setMessage(`Event request for "${eventRequestModal.detail.event.title}" approved.`);
            } else if (action === "changes") {
                await eventApi.requestEventChanges(eventId, eventRequestNote.trim());
                setMessage(`Change request sent for "${eventRequestModal.detail.event.title}".`);
            } else {
                await eventApi.rejectEventRequest(eventId, eventRequestNote.trim() || undefined);
                setMessage(`Event request for "${eventRequestModal.detail.event.title}" rejected.`);
            }
            setEventRequestModal(null);
            setEventRequestNote("");
            setEventRequestApprovedBudget("");
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to review the event request.");
        }
        finally {
            setEventRequestSubmitting(false);
        }
    };
    const handleRequestEnable = async (eventId) => {
        const eventTarget = events.find((event) => event.id === eventId);
        if (!eventTarget) return;
        setError("");
        setMessage("");
        try {
            await eventApi.requestEnableEvent(eventId, requestEnableNote || null);
            setMessage(`Re-enable request submitted for "${eventTarget.title}". The admin will review your request.`);
            setRequestEnableNote("");
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to submit re-enable request.");
        }
    };
    const loadEnableRequests = async () => {
        setLoadingEnableRequests(true);
        try {
            const data = await eventApi.listEnableRequests();
            setEnableRequests(data);
        }
        catch {
            // non-critical
        }
        finally {
            setLoadingEnableRequests(false);
        }
    };
    const handleApproveRequest = async (requestId, eventTitle) => {
        setReviewModal({ requestId, eventTitle, action: "approve", note: "" });
    };
    const handleRejectRequest = async (requestId, eventTitle) => {
        setReviewModal({ requestId, eventTitle, action: "reject", note: "" });
    };
    const submitReview = async () => {
        if (!reviewModal) return;
        const { requestId, eventTitle, action, note } = reviewModal;
        setError("");
        setMessage("");
        setReviewModal(null);
        try {
            if (action === "approve") {
                await eventApi.approveEnableRequest(requestId, note || null);
                setMessage(`Re-enable request for "${eventTitle}" approved. Event is now re-enabled.`);
                await Promise.all([load(), loadEnableRequests()]);
            } else {
                await eventApi.rejectEnableRequest(requestId, note || null);
                setMessage(`Re-enable request for "${eventTitle}" rejected.`);
                await loadEnableRequests();
            }
        } catch (err) {
            setError(err instanceof ApiClientError ? err.message : `Unable to ${action} the request.`);
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
    const removeTicketTierDraft = (draft) => {
        setTicketTierDrafts((current) => {
            const next = current.filter((item) => item.localId !== draft.localId);
            return next.length > 0 ? next : [createTicketTierDraft()];
        });
        if (draft.persisted) {
            setRemovedTicketTypeIds((current) => (current.includes(draft.localId) ? current : [...current, draft.localId]));
        }
    };
    const createEventWithChildren = async ({ basePayload, validSessions, validTicketTiers, agendaItems }) => {
        const createdEvent = await eventApi.createEvent(basePayload);
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
        setMessage(
            isAdminPortal
                ? `Event created with ${validSessions.length} session(s), ${agendaItems.length} agenda item(s), and ${createdTicketTypes.length} ticket tier(s).`
                : `Event request submitted with ${validSessions.length} session(s), ${agendaItems.length} agenda item(s), and ${createdTicketTypes.length} ticket tier(s). The admin will review it before publishing.`
        );
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
              const validSessions = sessionDrafts.filter((item) => item.sessionTitle.trim() && item.startTime && item.endTime);
              const validTicketTiers = ticketTierDrafts.filter((item) => item.ticketName.trim() && item.price && item.totalQuantity);
              if (editorMode === "edit" && editingEventId) {
                  const updatedEvent = await eventApi.updateEvent(editingEventId, basePayload);
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
                  let liveTicketTypes = ticketTypesByEvent[editingEventId] || [];
                  if (!editorTicketTiersReadOnly) {
                      for (const removedTicketTypeId of removedTicketTypeIds) {
                          await ticketingApi.deleteTicketType(editingEventId, removedTicketTypeId);
                      }
                      liveTicketTypes = [];
                      for (const tier of validTicketTiers) {
                          const tierPayload = {
                              ticketName: tier.ticketName.trim(),
                              tierCode: tier.tierCode.trim(),
                              price: Number(tier.price),
                              totalQuantity: Number(tier.totalQuantity),
                              maxPerOrder: Number(tier.maxPerOrder || 1),
                              description: tier.description.trim() || undefined
                          };
                          const savedTier = tier.persisted
                              ? await ticketingApi.updateTicketType(editingEventId, tier.localId, tierPayload)
                              : await ticketingApi.createTicketType(editingEventId, tierPayload);
                          liveTicketTypes.push(savedTier);
                      }
                      setTicketTypesByEvent((current) => ({
                          ...current,
                          [editingEventId]: liveTicketTypes
                      }));
                  }
                  setSelectedEventId(updatedEvent.event.id);
                  if (!isAdminPortal && updatedEvent.event.status === "PENDING_APPROVAL" && updatedEvent.event.approvalStatus === "CHANGES_REQUESTED") {
                      setMessage(`Event request updated${editorTicketTiersReadOnly ? "" : " with revised ticket tiers"}. Use resubmit when you're ready for the admin to review again.`);
                  } else {
                      setMessage(editorTicketTiersReadOnly
                          ? "Event details and sessions updated successfully."
                          : "Event details, sessions, and ticket tiers updated successfully.");
                  }
              }
              else {
                  if (isAdminPortal) {
                      setAdminCreateReview({
                          basePayload,
                          validSessions,
                          validTicketTiers,
                          agendaItems,
                          summary: {
                              title: title.trim(),
                              venueName: selectedVenue?.venueName || "Venue TBD",
                              proposedBudget: Number(estimatedBudget),
                              startTime,
                              endTime,
                              capacity: Number(capacity),
                              expectedAttendees: Number(expectedAttendees)
                          }
                      });
                      setSubmitting(false);
                      return;
                  }
                  await createEventWithChildren({ basePayload, validSessions, validTicketTiers, agendaItems });
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
    const confirmAdminCreateEvent = async () => {
        if (!adminCreateReview) {
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        try {
            const payload = {
                ...adminCreateReview.basePayload,
                estimatedBudget: Number(adminCreateReview.basePayload.estimatedBudget)
            };
            await createEventWithChildren({
                basePayload: payload,
                validSessions: adminCreateReview.validSessions,
                validTicketTiers: adminCreateReview.validTicketTiers,
                agendaItems: adminCreateReview.agendaItems
            });
            setAdminCreateReview(null);
            closeEditor();
            resetEditor();
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to create the event.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleResubmitEventRequest = async (eventId) => {
        const eventTarget = events.find((event) => event.id === eventId);
        if (!eventTarget) {
            return;
        }
        setError("");
        setMessage("");
        try {
            await eventApi.resubmitEventRequest(eventId);
            setMessage(`Event request for "${eventTarget.title}" has been resubmitted for approval.`);
            await load();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to resubmit the event request.");
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
              <CirclePlus className="size-4"/> {isAdminPortal ? "New Event" : "Submit Event Request"}
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
              <div className="mt-4 space-y-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Events</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by title, venue, event ID, or keyword..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                    {searchQuery && (<button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear event search">
                        <X className="size-4"/>
                      </button>)}
                  </div>
                </label>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Category</span>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                      <option value="ALL">All Categories</option>
                      {categoryOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                      <option value="ALL">All Statuses</option>
                      {statusOptions.map((status) => (<option key={status} value={status}>{getEventStatusLabel(status)}</option>))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sort</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                      <option value="start-asc">Soonest First</option>
                      <option value="start-desc">Latest First</option>
                      <option value="title">Title</option>
                      <option value="status">Status</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-[#0c152b] dark:text-slate-300">
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  Showing {filteredEvents.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + EVENT_LIST_PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length} events
                </span>
                {(searchQuery || categoryFilter !== "ALL" || statusFilter !== "ALL" || sortBy !== "start-asc" || windowFilter !== "ALL") && (<button type="button" onClick={() => {
                setSearchQuery("");
                setCategoryFilter("ALL");
                setStatusFilter("ALL");
                setSortBy("start-asc");
                setWindowFilter("ALL");
              }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                    Reset Filters
                  </button>)}
              </div>

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
                  </div>) : (pagedEvents.map((event) => {
                    const { bookedCount, totalCapacity } = getCapacitySnapshot(event);
                    return (<button key={event.id} type="button" onClick={() => setSelectedEventId(event.id)} className={`grid w-full gap-4 rounded-2xl border border-slate-200 px-5 py-5 text-left transition hover:border-[#1132d4]/30 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 md:grid-cols-2 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)] xl:items-center ${selectedEventId === event.id ? "border-[#1132d4]/30 bg-blue-50/70 shadow-sm dark:bg-[#16254c]" : "bg-white dark:bg-[#111a33]"}`}>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:hidden">Event Details</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.id}</p>
                        <p className="mt-2 truncate text-sm text-slate-500 dark:text-slate-300">{event.venueName || "Venue TBD"}</p>
                        <p className="mt-1 text-xs text-slate-400">{getEventCategoryLabel(event, categoryLookup)}</p>
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
                          <span className="font-semibold text-slate-900 dark:text-white">{bookedCount}</span>
                          <span className="text-slate-500">/ {totalCapacity}</span>
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
                    </button>);
                  }))}
              </div>

              {!loading && filteredEvents.length > 0 && (<>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172e] dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-100">
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <span>Use filters to narrow the board.</span>
                  </div>
                  <div className="mt-4">
                    <PageNavigation currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage}/>
                  </div>
                </>)}
            </div>
          </article>

          <aside className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            {selectedEvent ? (() => {
              const { bookedCount, totalCapacity } = getCapacitySnapshot(selectedEvent);
              return (<div className="flex h-full flex-col">
                <div className="border-b border-slate-200 p-6 dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">EVENT EDITOR</p>
                      <h2 className="mt-2 text-3xl font-bold">{selectedEvent.title}</h2>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{selectedEvent.description}</p>
                      {selectedEvent.approvalStatus && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getApprovalBadgeClass(selectedEvent.approvalStatus)}`}>
                            {getApprovalStatusLabel(selectedEvent.approvalStatus)}
                          </span>
                          {selectedEvent.status === "PENDING_APPROVAL" && (
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                              Awaiting admin review
                            </span>
                          )}
                        </div>
                      )}
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
                      {selectedEvent.proposedBudget != null && selectedEvent.approvedBudget != null && selectedEvent.proposedBudget !== selectedEvent.approvedBudget && (
                        <p className="mt-1 text-xs text-slate-500">Proposed: {formatCurrency(selectedEvent.proposedBudget)}</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Venue</p>
                      <p className="mt-2 text-sm font-semibold">{selectedEvent.venueName || "Venue TBD"}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedEvent.venueCity || "City pending"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Capacity</p>
                      <p className="mt-2 text-sm font-semibold">{bookedCount} / {totalCapacity}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Lifecycle Actions</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedEvent.status === "PENDING_APPROVAL"
                            ? "This event is waiting for approval before normal lifecycle controls become available."
                            : "Set the event to any lifecycle state, or remove it completely from Event Operations."}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {selectedEvent.status === "PENDING_APPROVAL" ? (
                          <>
                            {isAdminPortal ? (
                              <button type="button" onClick={() => void openEventRequestReview(selectedEvent.id)} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10">
                                <AlertTriangle className="size-3"/>
                                Review Request
                              </button>
                            ) : selectedEvent.approvalStatus === "CHANGES_REQUESTED" ? (
                              <button type="button" onClick={() => void handleResubmitEventRequest(selectedEvent.id)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10">
                                <RefreshCw className="size-3"/>
                                Resubmit for Approval
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <>
                        {!isDisabledEvent(selectedEvent.status) && eventStatuses.filter((status) => status !== selectedEvent.status).map((status) => (<button key={status} type="button" onClick={() => void handleStatusChange(selectedEvent.id, status)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-white/15">
                            {status === "DRAFT" ? <PencilLine className="size-3"/> : null}
                            {status === "PUBLISHED" ? <Rocket className="size-3"/> : null}
                            {status === "REGISTRATION_OPEN" ? <Ticket className="size-3"/> : null}
                            {status === "REGISTRATION_CLOSED" ? <Ticket className="size-3"/> : null}
                            {status === "ONGOING" ? <CalendarRange className="size-3"/> : null}
                            {status === "COMPLETED" ? <Calendar className="size-3"/> : null}
                            {getActionLabel(status)}
                          </button>))}
                        {isDisabledEvent(selectedEvent.status) ? (
                          <>
                            {(isAdminPortal || selectedEvent.status === "DISABLED_BY_VENDOR") ? (
                              <button type="button" onClick={() => void handleEnableEvent(selectedEvent.id)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
                                <Unlock className="size-3"/>
                                Enable Event
                              </button>
                            ) : (
                              <>
                              <button type="button" onClick={() => void handleRequestEnable(selectedEvent.id)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10">
                                <AlertTriangle className="size-3"/>
                                Request Re-enable
                              </button>
                              <textarea
                                value={requestEnableNote}
                                onChange={(e) => setRequestEnableNote(e.target.value)}
                                placeholder="Optional note for the admin…"
                                rows={2}
                                maxLength={1000}
                                className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-slate-200"
                              />
                              </>
                            )}
                          </>
                        ) : (
                          <button type="button" onClick={() => void handleDisableEvent(selectedEvent.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
                            <Ban className="size-3"/>
                            Disable Event
                          </button>
                        )}
                          </>
                        )}
                      </div>
                    </div>
                    {selectedEvent.approvalNote && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <span className="font-semibold">Approval note:</span> {selectedEvent.approvalNote}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Ticketing Tiers</p>
                        <p className="mt-1 text-xs text-slate-500">Current sellable tiers for this event.</p>
                      </div>
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
              </div>);
            })() : (<div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-300">
                Select an event from the list to view its operational details.
              </div>)}
          </aside>
        </section>

        {isAdminPortal && (
          <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-bold">New Event Requests</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Review vendor-submitted event requests, proposed budgets, and supporting ticket tiers.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {pendingEventRequests.length} pending
              </span>
            </div>
            <div className="p-6">
              {pendingEventRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-white/15">No new event requests are waiting for review.</div>
              ) : (
                <div className="space-y-3">
                  {pendingEventRequests.map((event) => (
                    <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{event.title}</p>
                          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getApprovalBadgeClass(event.approvalStatus)}`}>
                            {getApprovalStatusLabel(event.approvalStatus)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Vendor: {event.organizerEmail || event.organizerId}</p>
                        <p className="mt-1 text-xs text-slate-500">Proposed budget: {formatCurrency(event.proposedBudget ?? event.estimatedBudget)}</p>
                        <p className="mt-1 text-xs text-slate-500">Submitted: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</p>
                        {event.approvalNote && (
                          <p className="mt-2 max-w-xl rounded-lg bg-amber-50 px-3 py-1.5 text-xs italic text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            Latest note: {event.approvalNote}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => void openEventRequestReview(event.id)} disabled={eventRequestLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10">
                        <PencilLine className="size-3.5"/> Review New Event Request
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {isAdminPortal && (
          <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-bold">Vendor Re-enable Requests</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Pending requests from vendors to re-enable their admin-disabled events.</p>
              </div>
              <button type="button" onClick={() => void loadEnableRequests()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-white/15">
                <RefreshCw className="size-4"/> Refresh
              </button>
            </div>
            <div className="p-6">
              {loadingEnableRequests ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-white/15">Loading requests...</div>
              ) : enableRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-white/15">No pending re-enable requests.</div>
              ) : (
                <div className="space-y-3">
                  {enableRequests.map((req) => (
                    <div key={req.requestId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{req.eventTitle}</p>
                        <p className="mt-1 text-xs text-slate-500">Event ID: {req.eventId}</p>
                        <p className="mt-1 text-xs text-slate-500">Vendor: {req.vendorEmail ?? req.vendorId}</p>
                        <p className="mt-1 text-xs text-slate-500">Requested: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(req.requestedAt))}</p>
                        {req.vendorNote && (
                          <p className="mt-2 max-w-sm rounded-lg bg-amber-50 px-3 py-1.5 text-xs italic text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            Vendor note: {req.vendorNote}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void handleApproveRequest(req.requestId, req.eventTitle)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
                          <CheckCircle className="size-3.5"/> Approve
                        </button>
                        <button type="button" onClick={() => void handleRejectRequest(req.requestId, req.eventTitle)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
                          <X className="size-3.5"/> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {eventRequestModal && (
          <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
            <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111a33]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">REVIEW NEW EVENT REQUEST</p>
                  <h3 className="mt-2 text-2xl font-bold">{eventRequestModal.detail.event.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{eventRequestModal.detail.event.description}</p>
                </div>
                <button type="button" onClick={closeEventRequestReview} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10">
                  <X className="size-4"/>
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Proposed Budget</p>
                  <p className="mt-2 text-sm font-semibold">{formatCurrency(eventRequestModal.detail.event.proposedBudget ?? eventRequestModal.detail.event.estimatedBudget)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Expected / Capacity</p>
                  <p className="mt-2 text-sm font-semibold">{eventRequestModal.detail.event.expectedAttendees} / {eventRequestModal.detail.event.capacity}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Date</p>
                  <p className="mt-2 text-sm font-semibold">{formatDate(eventRequestModal.detail.event.startTime)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Venue</p>
                  <p className="mt-2 text-sm font-semibold">{eventRequestModal.detail.event.venueName || "Venue TBD"}</p>
                  <p className="mt-1 text-xs text-slate-500">{eventRequestModal.detail.event.venueCity || "City pending"}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <p className="text-sm font-semibold">Agenda Preview</p>
                    <div className="mt-3 space-y-3">
                      {eventRequestModal.detail.agendaItems.length === 0 ? (
                        <p className="text-sm text-slate-500">No agenda items were proposed.</p>
                      ) : eventRequestModal.detail.agendaItems.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                          <p className="font-semibold">{item.agendaTitle}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(item.startTime)} - {formatDate(item.endTime)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <p className="text-sm font-semibold">Ticket Tier Preview</p>
                    <div className="mt-3 space-y-3">
                      {eventRequestModal.ticketTypes.length === 0 ? (
                        <p className="text-sm text-slate-500">No ticket tiers were attached to this request.</p>
                      ) : eventRequestModal.ticketTypes.map((ticketType) => (
                        <div key={ticketType.ticketTypeId} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{ticketType.ticketName}</p>
                              <p className="text-xs text-slate-500">{ticketType.tierCode}</p>
                            </div>
                            <span className="text-sm font-semibold">{ticketType.totalQuantity}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">{formatCurrency(ticketType.price)} · Max {ticketType.maxPerOrder} per order</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                    <label className="space-y-1 text-sm font-medium">
                      <span>Approved Budget</span>
                      <input type="number" value={eventRequestApprovedBudget} onChange={(event) => setEventRequestApprovedBudget(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <label className="mt-4 block space-y-1 text-sm font-medium">
                      <span>Admin Note</span>
                      <textarea value={eventRequestNote} onChange={(event) => setEventRequestNote(event.target.value)} rows={5} placeholder="Explain approval, revision, or rejection details" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                    </label>
                    <p className="mt-3 text-xs text-slate-500">Approving moves the request into draft so it can be published through the normal lifecycle controls.</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button type="button" onClick={closeEventRequestReview} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/15">
                      Close
                    </button>
                    <button type="button" onClick={() => void submitEventRequestDecision("changes")} disabled={eventRequestSubmitting || !eventRequestNote.trim()} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60 dark:border-amber-500/30 dark:text-amber-300">
                      {eventRequestSubmitting ? "Saving..." : "Request Changes"}
                    </button>
                    <button type="button" onClick={() => void submitEventRequestDecision("reject")} disabled={eventRequestSubmitting} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:border-red-500/30 dark:text-red-300">
                      {eventRequestSubmitting ? "Saving..." : "Reject"}
                    </button>
                    <button type="button" onClick={() => void submitEventRequestDecision("approve")} disabled={eventRequestSubmitting || !eventRequestApprovedBudget} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {eventRequestSubmitting ? "Saving..." : "Approve Request"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {adminCreateReview && (
          <div className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111a33]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">ADMIN CREATE REVIEW</p>
                  <h3 className="mt-1 text-2xl font-bold">{adminCreateReview.summary.title}</h3>
                </div>
                <button type="button" onClick={() => setAdminCreateReview(null)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10">
                  <X className="size-4"/>
                </button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Budget</p>
                  <input type="number" value={adminCreateReview.basePayload.estimatedBudget} onChange={(event) => setAdminCreateReview((current) => ({
                    ...current,
                    basePayload: { ...current.basePayload, estimatedBudget: Number(event.target.value) },
                    summary: { ...current.summary, proposedBudget: Number(event.target.value) }
                  }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-white/15 dark:bg-[#09132a]"/>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Capacity</p>
                  <p className="mt-2 text-sm font-semibold">{adminCreateReview.summary.expectedAttendees} / {adminCreateReview.summary.capacity}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Venue</p>
                  <p className="mt-2 text-sm font-semibold">{adminCreateReview.summary.venueName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Schedule</p>
                  <p className="mt-2 text-sm font-semibold">{formatDate(adminCreateReview.basePayload.startTime)}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">Review the event details and final budget before the event is created directly in draft status.</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setAdminCreateReview(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/15">
                  Back
                </button>
                <button type="button" onClick={() => void confirmAdminCreateEvent()} disabled={submitting} className="rounded-lg bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {submitting ? "Creating..." : "Create Event"}
                </button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog
          open={Boolean(disableModalEvent)}
          onOpenChange={(open) => {
              if (!open && !disableSubmitting) {
                  setDisableModalEvent(null);
              }
          }}
        >
          <AlertDialogContent className="border-slate-200 bg-white sm:max-w-xl dark:border-white/10 dark:bg-[#111a33]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-left">
                <span className="rounded-xl bg-red-100 p-2 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                  <Ban className="size-4"/>
                </span>
                Disable Event
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 text-left text-sm text-slate-600 dark:text-slate-300">
                <span className="block">
                  Disable <span className="font-semibold text-slate-900 dark:text-slate-100">"{disableModalEvent?.title}"</span>?
                </span>
                <span className="block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
                  The event will be hidden from the public events page, and ticket holders will receive a notice about the update.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disableSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                    event.preventDefault();
                    void confirmDisableEvent();
                }}
                className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                disabled={disableSubmitting}
              >
                {disableSubmitting ? "Disabling..." : "Disable Event"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {reviewModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111a33]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-[#1132d4]">
                    {reviewModal.action === "approve" ? "APPROVE REQUEST" : "REJECT REQUEST"}
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{reviewModal.eventTitle}</h3>
                </div>
                <button type="button" onClick={() => setReviewModal(null)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X className="size-4"/>
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                {reviewModal.action === "approve"
                  ? "Approving this request will re-enable the event. You may add an optional note for the vendor."
                  : "Rejecting this request will not re-enable the event. You may add an optional note for the vendor explaining the decision."}
              </p>
              <textarea
                value={reviewModal.note}
                onChange={(e) => setReviewModal((m) => ({ ...m, note: e.target.value }))}
                placeholder={reviewModal.action === "approve" ? "Optional note for vendor (e.g., reason for approval)…" : "Optional note for vendor (e.g., reason for rejection)…"}
                rows={3}
                maxLength={1000}
                className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1132d4] dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setReviewModal(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/15">
                  Cancel
                </button>
                {reviewModal.action === "approve" ? (
                  <button type="button" onClick={() => void submitReview()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    <CheckCircle className="size-4"/> Approve
                  </button>
                ) : (
                  <button type="button" onClick={() => void submitReview()} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                    <X className="size-4"/> Reject
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {editorOpen && (<div className="fixed inset-x-0 bottom-0 top-16 z-[60] flex justify-end bg-slate-950/50 backdrop-blur-sm">
            <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f172e]">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-[#0f172e]/95">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">
                    {editorMode === "edit" ? "EVENT UPDATION" : isAdminPortal ? "EVENT CREATION" : "EVENT REQUEST"}
                  </p>
                  <h2 className="mt-1 text-3xl font-bold">{editorMode === "edit" ? "Update Event" : isAdminPortal ? "Create Event" : "Submit Event Request"}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {editorMode === "edit"
                ? "Use this form to update event metadata, agenda, lifecycle-ready details, and sessions. Ticket tiers are still shown using the current live service data."
                : isAdminPortal
                    ? "Use this form to prepare a new event, review the details in a separate modal, and create it directly."
                    : "Use this form to submit a new event request. The admin will review the proposed details and budget before approval."}
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
                {editorMode === "create" && (<section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "EVENT INPUT" : "REQUEST INPUT"}</p>
                        <h3 className="mt-2 text-lg font-bold">Import JSON Or Fill Manually</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                          {isAdminPortal
                            ? "Upload a JSON event draft to prefill the admin event form, then review and edit the same fields manually before creating the event."
                            : "Upload a JSON event draft to prefill the request, then review and edit the same form manually before submitting."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-3">
                        <label className="block text-sm font-medium">
                          <span>Import event JSON</span>
                          <input type="file" accept=".json,application/json" onChange={(event) => void handleImportEventJson(event.target.files?.[0])} className="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1132d4] file:px-4 file:py-2 file:font-semibold file:text-white"/>
                        </label>
                        <p className="text-xs text-slate-500">
                          Supported keys include <code>title</code>, <code>eventType</code>, <code>categoryId</code> or <code>category</code>, <code>startTime</code>, <code>endTime</code>, <code>expectedAttendees</code>, <code>capacity</code>, <code>estimatedBudget</code> or <code>proposedBudget</code>, <code>tags</code>, <code>description</code>, <code>venueId</code> or <code>venueName</code>, <code>agendaItems</code>, <code>sessions</code>, and <code>ticketTiers</code>.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/10">
                        <p className="font-semibold text-slate-900 dark:text-white">{importedJsonFileName || "Manual entry mode"}</p>
                        <p className="mt-2 text-slate-500">
                          {importedJsonFileName
                            ? isAdminPortal
                              ? "The imported values now populate the form below. Review them and make any edits you want before continuing to the admin review and create step."
                              : "The imported values now populate the form below. Review them and make any edits you want before submitting the request."
                            : "Skip the upload if you want to fill every field manually. Both paths use the same preview form below."}
                        </p>
                      </div>
                    </div>
                  </section>)}
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
                      <span>{editorShowsApprovedBudget ? "Approved Budget" : "Estimated Budget"}<span className="required-mark">*</span></span>
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
                      Existing ticket tiers are read-only for live events. Pending event requests can now revise tiers directly before approval.
                      </p>)}
                  <div className="mt-4 space-y-4">
                    {ticketTierDrafts.map((draft, index) => (<div key={draft.localId} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-semibold">Tier {index + 1}</p>
                          {ticketTierDrafts.length > 1 && (<button type="button" disabled={editorTicketTiersReadOnly} onClick={() => removeTicketTierDraft(draft)} className="text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">
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
                              {editorTicketTiersReadOnly
                                ? "Existing ticket availability is shown from the live service."
                                : draft.persisted
                                    ? "Existing tier updates are saved back to the live ticketing service."
                                    : "New ticket tiers are created when you save the request."}
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
                    ? (editorTicketTiersReadOnly
                        ? "Editing updates the live event metadata, agenda, and sessions. Existing ticket tiers remain read-only for this event."
                        : "Editing updates the live event metadata, agenda, sessions, and ticket tiers.")
                    : isAdminPortal
                        ? "This flow creates the event after a final admin review modal confirms the details and budget."
                        : "This flow submits the event to admin review first, then adds sessions and ticket tiers using the live services."}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeEditor} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-white/15">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void handleSaveEvent()} disabled={submitting || editorLoading} className="rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 disabled:opacity-60">
                      {submitting
                    ? (editorMode === "edit" ? "Updating Event..." : isAdminPortal ? "Preparing Review..." : "Submitting Request...")
                    : editorMode === "edit"
                        ? "Update Event"
                        : isAdminPortal
                            ? "Review & Create Event"
                            : "Submit Event Request"}
                    </button>
                  </div>
                </div>
              </div>)}
            </div>
          </div>)}
      </div>
    </main>);
}
