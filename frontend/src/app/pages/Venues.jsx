import { useEffect, useMemo, useState } from "react";
import { Ban, Clock3, MapPin, Search, Star, Trash2, Users, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { PageNavigation } from "../components/PageNavigation";
import { DateTimeScheduler } from "../components/ui/date-time-scheduler";
import { venueVendorApi } from "../lib/venue-vendor-api";
import { eventApi } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { portalFromPath } from "../lib/roles";
const serviceCategories = ["CATERING", "AV", "DECOR", "SECURITY", "PHOTOGRAPHY"];
const toTextValue = (value) => value == null ? "" : String(value);
const toNumericTextValue = (value) => value == null || value === "" ? "" : String(value);
const toCommaSeparatedValue = (value) => Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).join(", ")
    : toTextValue(value);
const bookingStatusFilters = [
    { value: "ACTIVE", label: "Active" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "ALL", label: "All" }
];
const VENUE_PAGE_SIZE = 4;
const BOOKING_PAGE_SIZE = 8;
const VENDOR_PAGE_SIZE = 6;
const normalizeMatchKey = (value) => String(value || "").trim().toLowerCase();
export function Venues() {
    const location = useLocation();
    const navigate = useNavigate();
    const session = useAuthSession();
    const portal = portalFromPath(location.pathname) || "ADMIN";
    const isAdminPortal = portal === "ADMIN";
    const [venues, setVenues] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [allVendors, setAllVendors] = useState([]);
    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loadingVenues, setLoadingVenues] = useState(false);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [availabilitySearchQuery, setAvailabilitySearchQuery] = useState("");
    const [availabilityCityFilter, setAvailabilityCityFilter] = useState("ALL");
    const [availabilityResultFilter, setAvailabilityResultFilter] = useState("ALL");
    const [availabilitySortBy, setAvailabilitySortBy] = useState("name");
    const [availabilityPage, setAvailabilityPage] = useState(1);
    const [availabilityByVenue, setAvailabilityByVenue] = useState({});
    const [availabilityStart, setAvailabilityStart] = useState("");
    const [availabilityEnd, setAvailabilityEnd] = useState("");
    const [bookingVenueId, setBookingVenueId] = useState("");
    const [bookingEventId, setBookingEventId] = useState("");
    const [bookingStart, setBookingStart] = useState("");
    const [bookingEnd, setBookingEnd] = useState("");
    const [bookingHallIds, setBookingHallIds] = useState([]);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [cancellingBookingId, setCancellingBookingId] = useState("");
    const [deletingBookingId, setDeletingBookingId] = useState("");
    const [cancelBookingModal, setCancelBookingModal] = useState(null);
    const [deleteBookingModal, setDeleteBookingModal] = useState(null);
    const [bookingStatusFilter, setBookingStatusFilter] = useState("ACTIVE");
    const [bookingSearchQuery, setBookingSearchQuery] = useState("");
    const [bookingVenueFilter, setBookingVenueFilter] = useState("ALL");
    const [bookingPaymentFilter, setBookingPaymentFilter] = useState("ALL");
    const [bookingSortBy, setBookingSortBy] = useState("start-asc");
    const [bookingPage, setBookingPage] = useState(1);
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [venueCity, setVenueCity] = useState("");
    const [venueCapacity, setVenueCapacity] = useState("");
    const [venuePricePerDay, setVenuePricePerDay] = useState("");
    const [venueAmenities, setVenueAmenities] = useState("");
    const [venueMediaGallery, setVenueMediaGallery] = useState("");
    const [venueHalls, setVenueHalls] = useState([{ hallName: "", capacity: "" }]);
    const [importedVenueJsonFileName, setImportedVenueJsonFileName] = useState("");
    const [createVenueLoading, setCreateVenueLoading] = useState(false);
    const [vendorSearchQuery, setVendorSearchQuery] = useState("");
    const [vendorSortBy, setVendorSortBy] = useState("rating");
    const [vendorPage, setVendorPage] = useState(1);
    const loadVenues = async () => {
        setLoadingVenues(true);
        setError("");
        try {
            const response = await venueVendorApi.listVenues({ limit: 50 });
            setVenues(response.items);
        }
        catch (err) {
            if (err instanceof ApiClientError) {
                setError(err.message);
            }
            else {
                setError("Unable to load venues.");
            }
        }
        finally {
            setLoadingVenues(false);
        }
    };
    const loadVendors = async () => {
        if (!session?.accessToken) {
            setVendors([]);
            return;
        }
        setLoadingVendors(true);
        setError("");
        try {
            const response = await venueVendorApi.listVendors({
                serviceType: selectedCategory || undefined,
                limit: 50
            });
            setVendors(response.items);
        }
        catch (err) {
            if (err instanceof ApiClientError) {
                setError(err.message);
            }
            else {
                setError("Unable to load vendors.");
            }
        }
        finally {
            setLoadingVendors(false);
        }
    };
    const loadAllVendors = async () => {
        if (!session?.accessToken) {
            setAllVendors([]);
            return;
        }
        try {
            const response = await venueVendorApi.listVendors({ limit: 200 });
            setAllVendors(response.items);
        }
        catch (err) {
            setAllVendors([]);
        }
    };
    const loadBookings = async (statusOverride = bookingStatusFilter) => {
        if (!session?.accessToken) {
            setBookings([]);
            return;
        }
        setLoadingBookings(true);
        setError("");
        try {
            const response = await venueVendorApi.listBookings({
                upcomingOnly: statusOverride === "ACTIVE",
                bookingStatus: statusOverride,
                limit: 100
            });
            setBookings(response.items);
        }
        catch (err) {
            if (err instanceof ApiClientError) {
                setError(err.message);
            }
            else {
                setError("Unable to load venue bookings.");
            }
        }
        finally {
            setLoadingBookings(false);
        }
    };
    useEffect(() => {
        loadVenues();
    }, []);
    useEffect(() => {
        const loadEvents = async () => {
            if (!session?.user.id) {
                return;
            }
            try {
                const response = await eventApi.listEvents({
                    organizerId: isAdminPortal ? undefined : session.user.id,
                    size: 50
                });
                setEvents(response.content);
            }
            catch {
                setEvents([]);
            }
        };
        void loadEvents();
    }, [session?.user.id]);
    useEffect(() => {
        void loadAllVendors();
    }, [session?.accessToken]);
    useEffect(() => {
        loadVendors();
    }, [selectedCategory, session?.accessToken]);
    useEffect(() => {
        void loadBookings(bookingStatusFilter);
    }, [session?.accessToken, bookingStatusFilter]);
    const handleBookingStatusFilterChange = (nextFilter) => {
        setBookingStatusFilter(nextFilter);
        setBookings([]);
        void loadBookings(nextFilter);
    };
    useEffect(() => {
        const now = new Date();
        const plusThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        const toDateTimeLocal = (value) => {
            const offset = value.getTimezoneOffset();
            const local = new Date(value.getTime() - offset * 60 * 1000);
            return local.toISOString().slice(0, 16);
        };
        setAvailabilityStart(toDateTimeLocal(now));
        setAvailabilityEnd(toDateTimeLocal(plusThreeHours));
    }, []);
    useEffect(() => {
        if (!location.state?.actionMessage) {
            return;
        }
        setMessage(location.state.actionMessage);
        void navigate(location.pathname, { replace: true });
    }, [location.pathname, location.state, navigate]);
    const handleCheckAvailability = async (venueId) => {
        setError("");
        setMessage("");
        if (!availabilityStart || !availabilityEnd) {
            setError("Please choose both availability start and end.");
            return;
        }
        const start = new Date(availabilityStart);
        const end = new Date(availabilityEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            setError("Please choose a valid availability time range.");
            return;
        }
        if (end <= start) {
            setError("Availability end time must be later than the start time.");
            return;
        }
        try {
            const result = await venueVendorApi.checkAvailability(venueId, {
                start: start.toISOString(),
                end: end.toISOString()
            });
            setAvailabilityByVenue((prev) => ({ ...prev, [venueId]: result }));
        }
        catch (err) {
            setAvailabilityByVenue((prev) => {
                const current = { ...prev };
                delete current[venueId];
                return current;
            });
            setError(err instanceof ApiClientError ? err.message : "Availability check failed.");
        }
    };
    const handleCreateBooking = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!bookingVenueId || !bookingEventId || !bookingStart || !bookingEnd) {
            setError("Please fill venue, eventId, booking start and booking end.");
            return;
        }
        setBookingLoading(true);
        try {
            const booking = await venueVendorApi.createBooking(bookingVenueId, {
                eventId: bookingEventId.trim(),
                bookingStart: new Date(bookingStart).toISOString(),
                bookingEnd: new Date(bookingEnd).toISOString(),
                hallIds: bookingHallIds
            });
            const selectedEvent = eventLookup[bookingEventId.trim()];
            if (booking.paymentStatus === "PENDING" && Number(booking.paymentAmount) > 0) {
                setMessage(`Booking reserved. Complete the payment of ${booking.paymentCurrency || "INR"} ${booking.paymentAmount} to confirm the venue.`);
            }
            else {
                setMessage("Booking created successfully.");
            }
            setBookingVenueId("");
            setBookingEventId("");
            setBookingStart("");
            setBookingEnd("");
            setBookingHallIds([]);
            await loadVenues();
            await loadBookings();
            if (!isAdminPortal && booking.paymentStatus === "PENDING" && Number(booking.paymentAmount) > 0) {
                void navigate(`/vendor/venues/checkout/${booking.bookingId}`);
            }
        }
        catch (err) {
            if (err instanceof ApiClientError) {
                setError(err.message);
            }
            else {
                setError("Booking failed.");
            }
        }
        finally {
            setBookingLoading(false);
        }
    };
    const handleCancelBooking = async (booking) => {
        setCancelBookingModal(booking);
    };
    const confirmCancelBooking = async () => {
        if (!cancelBookingModal) {
            return;
        }
        setError("");
        setMessage("");
        setCancellingBookingId(cancelBookingModal.bookingId);
        try {
            await venueVendorApi.cancelBooking(cancelBookingModal.bookingId, {});
            setMessage(`Venue booking ${cancelBookingModal.bookingId} was cancelled.`);
            setCancelBookingModal(null);
            await loadBookings();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to cancel the venue booking.");
        }
        finally {
            setCancellingBookingId("");
        }
    };
    const handleDeleteBooking = async (booking) => {
        setDeleteBookingModal(booking);
    };
    const confirmDeleteBooking = async () => {
        if (!deleteBookingModal) {
            return;
        }
        setError("");
        setMessage("");
        setDeletingBookingId(deleteBookingModal.bookingId);
        try {
            await venueVendorApi.deleteBooking(deleteBookingModal.bookingId);
            setMessage(`Cancelled venue booking ${deleteBookingModal.bookingId} was removed permanently.`);
            setDeleteBookingModal(null);
            await loadBookings();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to remove the cancelled venue booking.");
        }
        finally {
            setDeletingBookingId("");
        }
    };
    const handleVenueHallChange = (index, field, value) => {
        setVenueHalls((current) => current.map((hall, hallIndex) => (hallIndex === index ? { ...hall, [field]: value } : hall)));
    };
    const handleAddVenueHall = () => {
        setVenueHalls((current) => [...current, { hallName: "", capacity: "" }]);
    };
    const handleRemoveVenueHall = (index) => {
        setVenueHalls((current) => (current.length === 1 ? current : current.filter((_, hallIndex) => hallIndex !== index)));
    };
    const resetCreateVenueForm = () => {
        setVenueName("");
        setVenueAddress("");
        setVenueCity("");
        setVenueCapacity("");
        setVenuePricePerDay("");
        setVenueAmenities("");
        setVenueMediaGallery("");
        setVenueHalls([{ hallName: "", capacity: "" }]);
        setImportedVenueJsonFileName("");
    };
    const applyImportedVenueDraft = (payload) => {
        const importedHalls = Array.isArray(payload.halls)
            ? payload.halls
                .map((hall) => ({
                hallName: toTextValue(hall?.hallName ?? hall?.name),
                capacity: toNumericTextValue(hall?.capacity)
            }))
                .filter((hall) => hall.hallName || hall.capacity)
            : [];
        setVenueName(toTextValue(payload.venueName ?? payload.name));
        setVenueAddress(toTextValue(payload.address));
        setVenueCity(toTextValue(payload.city));
        setVenueCapacity(toNumericTextValue(payload.capacity));
        setVenuePricePerDay(toNumericTextValue(payload.pricePerDay ?? payload.dailyPrice));
        setVenueAmenities(toCommaSeparatedValue(payload.amenities));
        setVenueMediaGallery(toCommaSeparatedValue(payload.mediaGallery ?? payload.images));
        setVenueHalls(importedHalls.length > 0 ? importedHalls : [{ hallName: "", capacity: "" }]);
    };
    const handleImportVenueJson = async (file) => {
        if (!file) {
            return;
        }
        try {
            setError("");
            const raw = await file.text();
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("The uploaded JSON must be a single venue object.");
            }
            applyImportedVenueDraft(parsed);
            setImportedVenueJsonFileName(file.name);
            setMessage(`Imported venue draft from ${file.name}. Review the fields below before creating the venue.`);
        }
        catch (err) {
            setImportedVenueJsonFileName("");
            setError(err instanceof Error ? err.message : "Unable to import the selected venue JSON file.");
        }
    };
    const handleCreateVenue = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!venueName || !venueAddress || !venueCity || !venueCapacity || !venuePricePerDay) {
            setError("Please fill venue name, address, city, capacity and price per day.");
            return;
        }
        setCreateVenueLoading(true);
        try {
            const amenities = venueAmenities
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean);
            const mediaGallery = venueMediaGallery
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean);
            const halls = venueHalls
                .map((hall) => ({
                hallName: hall.hallName.trim(),
                capacity: Number(hall.capacity)
            }))
                .filter((hall) => hall.hallName && Number.isFinite(hall.capacity) && hall.capacity > 0);
            const createdVenue = await venueVendorApi.createVenue({
                venueName: venueName.trim(),
                address: venueAddress.trim(),
                city: venueCity.trim(),
                capacity: Number(venueCapacity),
                pricePerDay: Number(venuePricePerDay),
                amenities,
                mediaGallery,
                halls
            });
            setMessage(`Venue "${createdVenue.venueName}" created successfully.`);
            resetCreateVenueForm();
            await loadVenues();
        }
        catch (err) {
            if (err instanceof ApiClientError) {
                setError(err.message);
            }
            else {
                setError("Venue creation failed.");
            }
        }
        finally {
            setCreateVenueLoading(false);
        }
    };
    const venueLookup = useMemo(() => Object.fromEntries(venues.map((venue) => [venue.venueId, venue])), [venues]);
    const selectedBookingVenue = bookingVenueId ? venueLookup[bookingVenueId] : undefined;
    const eventLookup = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events]);
    const vendorLookup = useMemo(() => Object.fromEntries(allVendors.map((vendor) => [vendor.vendorId, vendor])), [allVendors]);
    const venueCityOptions = useMemo(() => Array.from(new Set(venues.map((venue) => venue.city).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [venues]);
    const filteredVenues = useMemo(() => {
      const searchKey = normalizeMatchKey(availabilitySearchQuery);
      const nextVenues = venues.filter((venue) => {
        if (availabilityCityFilter !== "ALL" && venue.city !== availabilityCityFilter) {
          return false;
        }

        const availability = availabilityByVenue[venue.venueId];
        if (availabilityResultFilter === "AVAILABLE" && !availability?.isAvailable) {
          return false;
        }
        if (availabilityResultFilter === "UNAVAILABLE" && availability?.isAvailable !== false) {
          return false;
        }
        if (availabilityResultFilter === "UNCHECKED" && availability) {
          return false;
        }

        if (searchKey) {
          const hallNames = Array.isArray(venue.halls) ? venue.halls.map((hall) => hall.hallName).join(" ") : "";
          const searchFields = [venue.venueName, venue.address, venue.city, venue.capacity, venue.pricePerDay, hallNames];
          if (!searchFields.some((value) => normalizeMatchKey(value).includes(searchKey))) {
            return false;
          }
        }

        return true;
      });

      nextVenues.sort((left, right) => {
        if (availabilitySortBy === "city") {
          return String(left.city || "").localeCompare(String(right.city || ""));
        }
        if (availabilitySortBy === "capacity") {
          return Number(right.capacity || 0) - Number(left.capacity || 0);
        }
        if (availabilitySortBy === "price") {
          return Number(left.pricePerDay || 0) - Number(right.pricePerDay || 0);
        }
        return String(left.venueName || "").localeCompare(String(right.venueName || ""));
      });

      return nextVenues;
    }, [availabilityByVenue, availabilityCityFilter, availabilityResultFilter, availabilitySearchQuery, availabilitySortBy, venues]);
    const availabilityTotalPages = filteredVenues.length === 0 ? 0 : Math.ceil(filteredVenues.length / VENUE_PAGE_SIZE);
    const safeAvailabilityPage = availabilityTotalPages === 0 ? 1 : Math.min(availabilityPage, availabilityTotalPages);
    const visibleVenueCount = Math.min(safeAvailabilityPage * VENUE_PAGE_SIZE, filteredVenues.length);
    const visibleVenues = filteredVenues.slice(0, visibleVenueCount);
    const filteredBookings = useMemo(() => {
      const searchKey = normalizeMatchKey(bookingSearchQuery);
      const nextBookings = bookings.filter((booking) => {
        const venue = venueLookup[booking.venueId];
        const linkedEvent = eventLookup[booking.eventId];
        const vendor = booking.vendorId ? vendorLookup[booking.vendorId] : undefined;
        const paymentPending = booking.paymentStatus !== "PAID" && Number(booking.paymentAmount) > 0;
        const isFree = Number(booking.paymentAmount || 0) <= 0;

        if (bookingVenueFilter !== "ALL" && booking.venueId !== bookingVenueFilter) {
          return false;
        }

        if (bookingPaymentFilter === "PAID" && (paymentPending || isFree)) {
          return false;
        }
        if (bookingPaymentFilter === "PENDING" && !paymentPending) {
          return false;
        }
        if (bookingPaymentFilter === "FREE" && !isFree) {
          return false;
        }

        if (searchKey) {
          const hallNames = booking.hallIds.length > 0
            ? booking.hallIds.map((hallId) => venue?.halls.find((hall) => hall.hallId === hallId)?.hallName || hallId).join(" ")
            : "Whole venue";
          const searchFields = [
            booking.bookingId,
            booking.bookingOwnerEmail,
            booking.createdByEmail,
            venue?.venueName,
            venue?.city,
            linkedEvent?.title,
            booking.eventId,
            vendor?.vendorName,
            hallNames
          ];

          if (!searchFields.some((value) => normalizeMatchKey(value).includes(searchKey))) {
            return false;
          }
        }

        return true;
      });

      nextBookings.sort((left, right) => {
        if (bookingSortBy === "start-desc") {
          return new Date(right.bookingStart).getTime() - new Date(left.bookingStart).getTime();
        }
        if (bookingSortBy === "venue") {
          return String(venueLookup[left.venueId]?.venueName || left.venueId).localeCompare(String(venueLookup[right.venueId]?.venueName || right.venueId));
        }
        if (bookingSortBy === "payment") {
          return Number(right.paymentAmount || 0) - Number(left.paymentAmount || 0);
        }
        return new Date(left.bookingStart).getTime() - new Date(right.bookingStart).getTime();
      });

      return nextBookings;
    }, [bookings, bookingPaymentFilter, bookingSearchQuery, bookingSortBy, bookingVenueFilter, eventLookup, venueLookup, vendorLookup]);
    const bookingTotalPages = filteredBookings.length === 0 ? 0 : Math.ceil(filteredBookings.length / BOOKING_PAGE_SIZE);
    const safeBookingPage = bookingTotalPages === 0 ? 1 : Math.min(bookingPage, bookingTotalPages);
    const bookingPageStart = (safeBookingPage - 1) * BOOKING_PAGE_SIZE;
    const pagedBookings = filteredBookings.slice(bookingPageStart, bookingPageStart + BOOKING_PAGE_SIZE);
    const filteredVendors = useMemo(() => {
      const searchKey = normalizeMatchKey(vendorSearchQuery);
      const nextVendors = vendors.filter((vendor) => {
        if (!searchKey) {
          return true;
        }
        const searchFields = [vendor.vendorName, vendor.serviceType, vendor.email, vendor.phone];
        return searchFields.some((value) => normalizeMatchKey(value).includes(searchKey));
      });

      nextVendors.sort((left, right) => {
        if (vendorSortBy === "name") {
          return left.vendorName.localeCompare(right.vendorName);
        }
        if (vendorSortBy === "reviews") {
          return Number(right.reviewCount || 0) - Number(left.reviewCount || 0);
        }
        if (vendorSortBy === "service") {
          return String(left.serviceType || "").localeCompare(String(right.serviceType || ""));
        }
        return Number(right.rating || 0) - Number(left.rating || 0);
      });

      return nextVendors;
    }, [vendorSearchQuery, vendorSortBy, vendors]);
    const vendorTotalPages = filteredVendors.length === 0 ? 0 : Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE);
    const safeVendorPage = vendorTotalPages === 0 ? 1 : Math.min(vendorPage, vendorTotalPages);
    const vendorPageStart = (safeVendorPage - 1) * VENDOR_PAGE_SIZE;
    const pagedVendors = filteredVendors.slice(vendorPageStart, vendorPageStart + VENDOR_PAGE_SIZE);
    useEffect(() => {
      setAvailabilityPage(1);
    }, [availabilitySearchQuery, availabilityCityFilter, availabilityResultFilter, availabilitySortBy]);
    useEffect(() => {
      setBookingPage(1);
    }, [bookingSearchQuery, bookingVenueFilter, bookingPaymentFilter, bookingSortBy, bookingStatusFilter]);
    useEffect(() => {
      setVendorPage(1);
    }, [selectedCategory, vendorSearchQuery, vendorSortBy]);
    const toggleBookingHall = (hallId) => {
        setBookingHallIds((current) => current.includes(hallId) ? current.filter((item) => item !== hallId) : [...current, hallId]);
    };
    return (<main>
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
            <h1 className="eventzen-page-title mt-2">{isAdminPortal ? "Venue & Vendor Management" : "Venue Booking Workspace"}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{isAdminPortal ? "Monitor venue availability, track venue bookings, manage public venues, and review the vendor catalog." : "Browse venues, check availability, and book spaces for your events."}</p>
          </div>
        </header>

        {isAdminPortal && (<nav className="flex gap-6 border-b border-slate-200 text-lg font-bold dark:border-white/10">
            <Link to="/admin/venues" className="-mb-px border-b-2 border-[#1132d4] pb-2 text-[#1132d4]">Venues</Link>
            <Link to="/admin/vendors" className="pb-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Vendors</Link>
          </nav>)}

          {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}

          <h2 className="mb-4 text-2xl font-black sm:text-3xl">Available Venues</h2>
          <section className="mb-4 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-[#111a33]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Availability Search Window</h3>
                <p className="mt-1 text-sm text-slate-500">Pick any start and end time, then check venue availability for that exact period.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1 text-sm font-medium">
                <span>Start Time</span>
                <DateTimeScheduler value={availabilityStart} onChange={setAvailabilityStart} placeholder="Choose availability start" className="w-full"/>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>End Time</span>
                <DateTimeScheduler value={availabilityEnd} onChange={setAvailabilityEnd} placeholder="Choose availability end" className="w-full"/>
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => setAvailabilityByVenue({})} className="flex h-[50px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/15 dark:bg-[#0f172e] dark:text-slate-200 dark:hover:bg-white/5">
                  Clear Results
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Venues</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                  <input value={availabilitySearchQuery} onChange={(event) => setAvailabilitySearchQuery(event.target.value)} placeholder="Search by venue name, city, address, or hall..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                  {availabilitySearchQuery && (<button type="button" onClick={() => setAvailabilitySearchQuery("")} className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear venue search">
                      <X className="size-4"/>
                    </button>)}
                </div>
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">City</span>
                  <select value={availabilityCityFilter} onChange={(event) => setAvailabilityCityFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                    <option value="ALL">All Cities</option>
                    {venueCityOptions.map((city) => (<option key={city} value={city}>{city}</option>))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Availability</span>
                  <select value={availabilityResultFilter} onChange={(event) => setAvailabilityResultFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                    <option value="ALL">All Results</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="UNAVAILABLE">Has Conflicts</option>
                    <option value="UNCHECKED">Not Checked Yet</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sort</span>
                  <select value={availabilitySortBy} onChange={(event) => setAvailabilitySortBy(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                    <option value="name">Venue Name</option>
                    <option value="city">City</option>
                    <option value="capacity">Capacity</option>
                    <option value="price">Price Per Day</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-[#0c152b] dark:text-slate-300">
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  Showing {filteredVenues.length === 0 ? 0 : 1}-{visibleVenueCount} of {filteredVenues.length} venues
                </span>
              </div>
            </div>
          </section>
          {loadingVenues ? (<p className="text-sm text-slate-500">Loading venues...</p>) : filteredVenues.length === 0 ? (<p className="text-sm text-slate-500">No venues matched the current search and filters.</p>) : (<>
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleVenues.map((venue) => (<article key={venue.venueId} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-white/15 dark:bg-[#111a33]">
                  <div className="h-2 w-full bg-[#1132d4]"/>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="min-h-[4.5rem] text-xl font-bold lg:text-3xl">{venue.venueName}</h3>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">{venue.city}</span>
                    </div>
                    <p className="flex min-h-8 items-start gap-2 text-base text-slate-600 dark:text-slate-300"><MapPin className="mt-1 size-4 shrink-0"/><span className="line-clamp-2">{venue.address}</span></p>
                    <p className="flex min-h-8 items-start gap-2 text-base text-slate-600 dark:text-slate-300"><Users className="mt-1 size-4 shrink-0"/><span>Capacity: {venue.capacity}</span></p>
                    <p className="min-h-8 text-base text-slate-600 dark:text-slate-300">Price/day: {venue.pricePerDay}</p>
                    <div className="min-h-[4.75rem]">
                      {venue.halls.length > 0 && (<div className="space-y-1 text-sm text-slate-500">
                          {venue.halls.map((hall) => (<p key={hall.hallId}>{hall.hallName} - capacity {hall.capacity}</p>))}
                        </div>)}
                    </div>
                    <button onClick={() => handleCheckAvailability(venue.venueId)} className="mt-auto w-full rounded-xl bg-[#1132d4]/15 px-4 py-3 text-base font-semibold text-[#1132d4]">
                      View Availability For Selected Time
                    </button>
                    {availabilityByVenue[venue.venueId] && (<div className={`rounded-xl border p-3 text-sm ${availabilityByVenue[venue.venueId].isAvailable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                        <p className="font-semibold">
                          {availabilityByVenue[venue.venueId].isAvailable
                        ? "Available for the selected time window"
                        : availabilityByVenue[venue.venueId].wholeVenueBlocked
                            ? "Whole venue is blocked in the selected time window"
                            : "Partial hall conflicts found"}
                        </p>
                        <p className="mt-1 text-xs">
                          Window: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(availabilityByVenue[venue.venueId].requestedWindow.start))}
                          {" to "}
                          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(availabilityByVenue[venue.venueId].requestedWindow.end))}
                        </p>
                        {availabilityByVenue[venue.venueId].unavailableHallNames.length > 0 && (<p className="mt-1">
                            Busy halls: {availabilityByVenue[venue.venueId].unavailableHallNames.join(", ")}
                          </p>)}
                        {availabilityByVenue[venue.venueId].availableHallNames.length > 0 && (<p className="mt-1">
                            Free halls: {availabilityByVenue[venue.venueId].availableHallNames.join(", ")}
                          </p>)}
                        {!availabilityByVenue[venue.venueId].isAvailable && (<p className="mt-1 text-xs">
                            Conflicts: {availabilityByVenue[venue.venueId].conflicts.map((conflict) => conflict.eventId).join(", ")}
                          </p>)}
                      </div>)}
                  </div>
                </article>))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172e] dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-100">Page {safeAvailabilityPage} of {availabilityTotalPages}</span>
              <span>Use the filters to narrow venues, or use the navigation below.</span>
            </div>
            <div className="mt-4">
              <PageNavigation currentPage={safeAvailabilityPage} totalPages={availabilityTotalPages} onPageChange={setAvailabilityPage}/>
            </div>
          </>)}

          {isAdminPortal && (<section className="mt-8 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-[#111a33]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Create Venue</h2>
                  <p className="mt-1 text-sm text-slate-500">Add a new public venue, set its daily price, and configure optional halls for partial bookings.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[1.1fr_0.9fr] dark:border-white/10">
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    <span>Import venue JSON</span>
                    <input type="file" accept=".json,application/json" onChange={(event) => void handleImportVenueJson(event.target.files?.[0])} className="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1132d4] file:px-4 file:py-2 file:font-semibold file:text-white"/>
                  </label>
                  <p className="text-xs text-slate-500">
                    Supported keys include <code>venueName</code> or <code>name</code>, <code>address</code>, <code>city</code>, <code>capacity</code>, <code>pricePerDay</code> or <code>dailyPrice</code>, <code>amenities</code>, <code>mediaGallery</code> or <code>images</code>, and <code>halls</code>.
                  </p>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm dark:border-white/10">
                  <p className="font-semibold text-slate-900 dark:text-white">{importedVenueJsonFileName || "Manual entry mode"}</p>
                  <p className="mt-2 text-slate-500">
                    {importedVenueJsonFileName
                        ? "The imported values now populate the venue form below. Review them and make any edits you want before creating the venue."
                        : "Skip the upload if you want to create the venue completely by hand. Both paths use the same form below."}
                  </p>
                </div>
              </div>
              <form onSubmit={handleCreateVenue} className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  <span>Venue name<span className="required-mark">*</span></span>
                  <input value={venueName} onChange={(event) => setVenueName(event.target.value)} placeholder="Enter venue name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>City<span className="required-mark">*</span></span>
                  <input value={venueCity} onChange={(event) => setVenueCity(event.target.value)} placeholder="Enter city" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                </label>
                <label className="space-y-1 text-sm font-medium lg:col-span-2">
                  <span>Address<span className="required-mark">*</span></span>
                  <input value={venueAddress} onChange={(event) => setVenueAddress(event.target.value)} placeholder="Enter full venue address" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>Total capacity<span className="required-mark">*</span></span>
                  <input type="number" min="1" value={venueCapacity} onChange={(event) => setVenueCapacity(event.target.value)} placeholder="Enter venue capacity" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>Price per day<span className="required-mark">*</span></span>
                  <input type="number" min="0" step="0.01" value={venuePricePerDay} onChange={(event) => setVenuePricePerDay(event.target.value)} placeholder="Enter price per day" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>Amenities</span>
                  <input value={venueAmenities} onChange={(event) => setVenueAmenities(event.target.value)} placeholder="WiFi, LED wall, parking, green room" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                  <p className="text-xs text-slate-500">Separate multiple amenities with commas.</p>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>Media gallery URLs</span>
                  <input value={venueMediaGallery} onChange={(event) => setVenueMediaGallery(event.target.value)} placeholder="https://..., https://..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                  <p className="text-xs text-slate-500">Add one or more public image URLs separated by commas.</p>
                </label>
                <div className="space-y-3 lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">Venue Halls</h3>
                      <p className="text-sm text-slate-500">Configure optional halls so teams can reserve part of a venue instead of the full building.</p>
                    </div>
                    <button type="button" onClick={handleAddVenueHall} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                      Add hall
                    </button>
                  </div>
                  <div className="space-y-3">
                    {venueHalls.map((hall, index) => (<div key={`venue-hall-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_180px_auto] dark:border-white/10">
                        <label className="space-y-1 text-sm font-medium">
                          <span>Hall name</span>
                          <input value={hall.hallName} onChange={(event) => handleVenueHallChange(index, "hallName", event.target.value)} placeholder="Aurora Ballroom" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                        </label>
                        <label className="space-y-1 text-sm font-medium">
                          <span>Capacity</span>
                          <input type="number" min="1" value={hall.capacity} onChange={(event) => handleVenueHallChange(index, "capacity", event.target.value)} placeholder="250" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]"/>
                        </label>
                        <div className="flex items-end">
                          <button type="button" onClick={() => handleRemoveVenueHall(index)} disabled={venueHalls.length === 1} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                            Remove
                          </button>
                        </div>
                      </div>))}
                  </div>
                </div>
                <button type="submit" disabled={createVenueLoading} className="rounded-lg bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 lg:col-span-2">
                  {createVenueLoading ? "Creating venue..." : "Create Venue"}
                </button>
              </form>
            </section>)}

          <div className="mt-8 rounded-2xl border border-slate-300 bg-white p-5 dark:border-white/15 dark:bg-[#111a33]">
            <h2 className="text-2xl font-black">Create Venue Booking</h2>
            <p className="mt-1 text-sm text-slate-500">Book venues for events and keep the venue schedule visible to administrators.</p>
            <form onSubmit={handleCreateBooking} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">
                <span>Venue<span className="required-mark">*</span></span>
                <select required value={bookingVenueId} onChange={(event) => {
            setBookingVenueId(event.target.value);
            setBookingHallIds([]);
        }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]">
                  <option value="">Select a venue</option>
                  {venues.map((venue) => (<option key={venue.venueId} value={venue.venueId}>
                      {venue.venueName}
                    </option>))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Event<span className="required-mark">*</span></span>
                <select required value={bookingEventId} onChange={(event) => setBookingEventId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/15 dark:bg-[#0f172e]">
                  <option value="">Select an event</option>
                  {events.map((item) => (<option key={item.id} value={item.id}>
                      {item.title}
                    </option>))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Booking Start<span className="required-mark">*</span></span>
                <DateTimeScheduler value={bookingStart} onChange={setBookingStart} placeholder="Choose booking start" className="w-full" required/>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Booking End<span className="required-mark">*</span></span>
                <DateTimeScheduler value={bookingEnd} onChange={setBookingEnd} placeholder="Choose booking end" className="w-full" required/>
              </label>
              <label className="space-y-1 text-sm font-medium md:col-span-2">
                <span>Booking Scope</span>
                <div className="rounded-lg border border-slate-300 p-3 dark:border-white/15">
                  {!selectedBookingVenue ? (<p className="text-sm text-slate-500">Select a venue first to choose specific halls, or leave all halls unselected to reserve the full venue.</p>) : selectedBookingVenue.halls.length === 0 ? (<p className="text-sm text-slate-500">This venue has no sub-halls configured, so the booking will reserve the full venue.</p>) : (<div className="space-y-2">
                      <p className="text-sm text-slate-500">Leave all halls unchecked to reserve the full venue.</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {selectedBookingVenue.halls.map((hall) => (<label key={hall.hallId} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                            <input type="checkbox" checked={bookingHallIds.includes(hall.hallId)} onChange={() => toggleBookingHall(hall.hallId)} className="mt-0.5"/>
                            <span>
                              <span className="block font-medium">{hall.hallName}</span>
                              <span className="text-slate-500">Capacity {hall.capacity}</span>
                            </span>
                          </label>))}
                      </div>
                    </div>)}
                </div>
              </label>
              <button type="submit" disabled={bookingLoading} className="md:col-span-2 rounded-lg bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {bookingLoading ? "Creating..." : "Create Booking"}
              </button>
            </form>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-[#111a33]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Venue Bookings</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {bookingStatusFilter === "ACTIVE"
                        ? "Upcoming active bookings for the current portal scope."
                        : bookingStatusFilter === "CANCELLED"
                            ? "Cancelled bookings that can be reviewed or removed permanently."
                            : "All venue bookings for the current portal scope."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                    value={bookingStatusFilter}
                    onChange={(event) => handleBookingStatusFilterChange(event.target.value)}
                    className="min-w-[11rem] rounded-lg border border-slate-300 px-4 py-2 pr-10 text-sm font-semibold text-slate-600 dark:border-white/15 dark:bg-[#0f172e] dark:text-slate-200"
                >
                  {bookingStatusFilters.map((filterOption) => (<option key={filterOption.value} value={filterOption.value}>
                      {filterOption.label}
                    </option>))}
                </select>
                <button type="button" onClick={() => void loadBookings()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                  Refresh Bookings
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Bookings</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                  <input value={bookingSearchQuery} onChange={(event) => setBookingSearchQuery(event.target.value)} placeholder="Search by booking ID, owner, venue, event, or hall..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                  {bookingSearchQuery && (<button type="button" onClick={() => setBookingSearchQuery("")} className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear booking search">
                      <X className="size-4"/>
                    </button>)}
                </div>
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Venue</span>
                  <select value={bookingVenueFilter} onChange={(event) => setBookingVenueFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                    <option value="ALL">All Venues</option>
                    {venues.map((venue) => (<option key={venue.venueId} value={venue.venueId}>{venue.venueName}</option>))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Payment</span>
                  <select value={bookingPaymentFilter} onChange={(event) => setBookingPaymentFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                    <option value="ALL">All Payment States</option>
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Payment Pending</option>
                    <option value="FREE">No Payment Due</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sort</span>
                  <select value={bookingSortBy} onChange={(event) => setBookingSortBy(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                    <option value="start-asc">Soonest First</option>
                    <option value="start-desc">Latest First</option>
                    <option value="venue">Venue</option>
                    <option value="payment">Highest Payment</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-[#0c152b] dark:text-slate-300">
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  Showing {filteredBookings.length === 0 ? 0 : bookingPageStart + 1}-{Math.min(bookingPageStart + BOOKING_PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length} bookings
                </span>
              </div>
            </div>

            {!session?.accessToken ? (<p className="mt-4 text-sm text-slate-500">Login is required to view venue bookings.</p>) : loadingBookings ? (<p className="mt-4 text-sm text-slate-500">Loading venue bookings...</p>) : filteredBookings.length === 0 ? (<p className="mt-4 text-sm text-slate-500">
                {bookingStatusFilter === "ACTIVE"
                        ? "No upcoming active venue bookings found."
                        : bookingStatusFilter === "CANCELLED"
                            ? "No cancelled venue bookings found."
                            : "No venue bookings found for this view."}
              </p>) : (<div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-3">Booking</th>
                      <th className="px-3 py-3">Booking Owner</th>
                      <th className="px-3 py-3">Venue</th>
                      <th className="px-3 py-3">Event</th>
                      <th className="px-3 py-3">Start</th>
                      <th className="px-3 py-3">End</th>
                      <th className="px-3 py-3">Duration</th>
                      <th className="px-3 py-3">Halls</th>
                      <th className="px-3 py-3">Booking Status</th>
                      <th className="px-3 py-3">Payment</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBookings.map((booking) => {
                const venue = venueLookup[booking.venueId];
                const linkedEvent = eventLookup[booking.eventId];
                const vendor = booking.vendorId ? vendorLookup[booking.vendorId] : undefined;
                const isCancelledBooking = booking.bookingStatus === "CANCELLED";
                const paymentPending = booking.paymentStatus !== "PAID" && Number(booking.paymentAmount) > 0;
                const paymentDisplay = Number(booking.paymentAmount || 0) > 0
                    ? (paymentPending ? "Payment pending" : "Paid")
                    : "No payment due";
                return (<tr key={booking.bookingId} className="border-b border-slate-100 align-top dark:border-white/5">
                          <td className="px-3 py-3 text-sm">
                            <p className="font-semibold">{booking.bookingId}</p>
                            <p className="text-xs text-slate-500">Created {new Date(booking.createdAt).toLocaleString()}</p>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {vendor ? (<>
                                <p className="font-semibold">{vendor.vendorName}</p>
                                <p className="text-xs text-slate-500">{vendor.serviceType}</p>
                              </>) : (booking.bookingOwnerEmail || linkedEvent?.organizerEmail) ? (<>
                                <p className="font-semibold">{booking.bookingOwnerEmail || linkedEvent?.organizerEmail}</p>
                                <p className="text-xs text-slate-500">{booking.createdBy !== booking.bookingOwnerId ? "Assigned organizer" : "Booking owner"}</p>
                              </>) : booking.createdByEmail ? (<>
                                <p className="font-semibold">{booking.createdByEmail}</p>
                                <p className="text-xs text-slate-500">Booking owner</p>
                              </>) : (<>
                                <p className="font-semibold text-slate-400">Owner unavailable</p>
                                <p className="text-xs text-slate-500">Booking ID: {booking.bookingId.slice(0, 8)}...</p>
                              </>)}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <p className="font-semibold">{venue?.venueName || booking.venueId}</p>
                            <p className="text-xs text-slate-500">{venue?.city || "City unavailable"}</p>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <p className="font-semibold">{linkedEvent?.title || booking.eventId}</p>
                            <p className="text-xs text-slate-500">{linkedEvent?.status || "External / unavailable"}</p>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.bookingStart))}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.bookingEnd))}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="size-4"/>
                              {Math.max(1, Math.round((new Date(booking.bookingEnd).getTime() - new Date(booking.bookingStart).getTime()) / (1000 * 60 * 60)))} hrs
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                            {booking.hallIds.length > 0
                        ? booking.hallIds
                            .map((hallId) => venue?.halls.find((hall) => hall.hallId === hallId)?.hallName || hallId)
                            .join(", ")
                        : "Whole venue"}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <p className={`font-semibold ${isCancelledBooking ? "text-slate-500" : "text-emerald-600"}`}>
                              {isCancelledBooking ? "Cancelled" : "Active"}
                            </p>
                            {booking.cancelledAt ? (<p className="text-xs text-slate-500">
                                Cancelled {new Date(booking.cancelledAt).toLocaleString()}
                              </p>) : null}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <p className={`font-semibold ${isCancelledBooking ? "text-slate-500" : paymentPending ? "text-amber-600" : "text-emerald-600"}`}>
                              {paymentDisplay}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(booking.paymentCurrency || "INR")} {Number(booking.paymentAmount || 0).toLocaleString()}
                            </p>
                            {booking.invoiceNumber ? <p className="text-xs text-slate-500">Invoice {booking.invoiceNumber}</p> : null}
                            {!isAdminPortal && paymentPending && !isCancelledBooking ? (<button type="button" onClick={() => void navigate(`/vendor/venues/checkout/${booking.bookingId}`)} className="mt-2 rounded-lg bg-[#1132d4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                                Proceed to checkout
                              </button>) : null}
                            {booking.paymentId ? (<button type="button" onClick={() => void financeApi.downloadInvoice(booking.paymentId, `venue-booking-${booking.bookingId}.pdf`)} className="mt-2 block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                                Download invoice
                              </button>) : null}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {isCancelledBooking ? (<button type="button" onClick={() => void handleDeleteBooking(booking)} disabled={deletingBookingId === booking.bookingId} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                                {deletingBookingId === booking.bookingId ? "Removing..." : "Remove permanently"}
                              </button>) : (<button type="button" onClick={() => void handleCancelBooking(booking)} disabled={cancellingBookingId === booking.bookingId} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
                                {cancellingBookingId === booking.bookingId ? "Cancelling..." : "Cancel booking"}
                              </button>)}
                          </td>
                        </tr>);
            })}
                  </tbody>
                </table>
              </div>)}
            {!loadingBookings && filteredBookings.length > 0 && (<>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172e] dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">Page {safeBookingPage} of {bookingTotalPages}</span>
                  <span>Use filters to narrow bookings, or use the navigation below.</span>
                </div>
                <div className="mt-4">
                  <PageNavigation currentPage={safeBookingPage} totalPages={bookingTotalPages} onPageChange={setBookingPage}/>
                </div>
              </>)}
          </section>

          <AlertDialog open={Boolean(cancelBookingModal)} onOpenChange={(open) => {
            if (!open && !cancellingBookingId) {
                setCancelBookingModal(null);
            }
        }}>
            <AlertDialogContent className="border-slate-200 bg-white sm:max-w-xl dark:border-white/10 dark:bg-[#111a33]">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-left">
                  <span className="rounded-xl bg-red-100 p-2 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                    <Ban className="size-4"/>
                  </span>
                  Cancel Venue Booking
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 text-left text-sm text-slate-600 dark:text-slate-300">
                  <span className="block">
                    Cancel venue booking <span className="font-semibold text-slate-900 dark:text-slate-100">"{cancelBookingModal?.bookingId}"</span>?
                  </span>
                  <span className="block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
                    This will release the reserved venue slot and the linked event will need a new venue assignment before it can continue.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={Boolean(cancellingBookingId)}>
                  Keep booking
                </AlertDialogCancel>
                <AlertDialogAction onClick={(event) => {
            event.preventDefault();
            void confirmCancelBooking();
        }} className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500" disabled={Boolean(cancellingBookingId)}>
                  {cancellingBookingId ? "Cancelling..." : "Cancel booking"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={Boolean(deleteBookingModal)} onOpenChange={(open) => {
            if (!open && !deletingBookingId) {
                setDeleteBookingModal(null);
            }
        }}>
            <AlertDialogContent className="border-slate-200 bg-white sm:max-w-xl dark:border-white/10 dark:bg-[#111a33]">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-left">
                  <span className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    <Trash2 className="size-4"/>
                  </span>
                  Remove Cancelled Booking
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 text-left text-sm text-slate-600 dark:text-slate-300">
                  <span className="block">
                    Remove cancelled booking <span className="font-semibold text-slate-900 dark:text-slate-100">"{deleteBookingModal?.bookingId}"</span> permanently?
                  </span>
                  <span className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    This action is permanent and only works for bookings that are already cancelled.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={Boolean(deletingBookingId)}>
                  Keep record
                </AlertDialogCancel>
                <AlertDialogAction onClick={(event) => {
            event.preventDefault();
            void confirmDeleteBooking();
        }} className="bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-500" disabled={Boolean(deletingBookingId)}>
                  {deletingBookingId ? "Removing..." : "Remove permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Vendor Catalog</h2>
              <p className="mt-1 text-sm text-slate-500">Search across vendors, refine by service category, and sort by the most relevant signal.</p>
            </div>
          </div>

          {!session?.accessToken ? (<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Vendor listing requires authentication. Please <Link className="font-semibold underline" to="/auth">login</Link> first.
            </div>) : (<section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-[#111a33]">
              <div className="space-y-3">
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Search Vendors</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                    <input value={vendorSearchQuery} onChange={(event) => setVendorSearchQuery(event.target.value)} placeholder="Search by vendor name, service, email, or phone..." className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]"/>
                    {vendorSearchQuery && (<button type="button" onClick={() => setVendorSearchQuery("")} className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Clear vendor search">
                        <X className="size-4"/>
                      </button>)}
                  </div>
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Category</span>
                    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                      <option value="">All Categories</option>
                      {serviceCategories.map((item) => (<option key={item} value={item}>{item}</option>))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Sort</span>
                    <select value={vendorSortBy} onChange={(event) => setVendorSortBy(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1132d4] focus:ring-4 focus:ring-[#1132d4]/10 dark:border-white/15 dark:bg-[#0c152b]">
                      <option value="rating">Highest Rating</option>
                      <option value="reviews">Most Reviews</option>
                      <option value="name">Vendor Name</option>
                      <option value="service">Service Type</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-[#0c152b] dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">
                    Showing {filteredVendors.length === 0 ? 0 : vendorPageStart + 1}-{Math.min(vendorPageStart + VENDOR_PAGE_SIZE, filteredVendors.length)} of {filteredVendors.length} vendors
                  </span>
                </div>
              </div>

              {loadingVendors ? (<p className="mt-4 text-sm text-slate-500">Loading vendors...</p>) : filteredVendors.length === 0 ? (<p className="mt-4 text-sm text-slate-500">No vendors found for the current search and filters.</p>) : (<>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {pagedVendors.map((vendor) => (<article key={vendor.vendorId} className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-white/15 dark:bg-[#111a33]">
                        <h3 className="text-2xl font-bold">{vendor.vendorName}</h3>
                        <p className="text-base text-slate-500">{vendor.serviceType}</p>
                        <p className="mt-2 inline-flex items-center gap-1 text-base text-amber-500">
                          <Star className="size-4 fill-current"/>
                          {vendor.rating.toFixed(1)}/5
                          <span className="text-slate-500">({vendor.reviewCount})</span>
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{vendor.email}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{vendor.phone}</p>
                      </article>))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172e] dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-100">Page {safeVendorPage} of {vendorTotalPages}</span>
                    <span>Use filters to narrow vendors, or use the navigation below.</span>
                  </div>
                  <div className="mt-4">
                    <PageNavigation currentPage={safeVendorPage} totalPages={vendorTotalPages} onPageChange={setVendorPage}/>
                  </div>
                </>)}
            </section>)}
      </div>
    </main>);
}
