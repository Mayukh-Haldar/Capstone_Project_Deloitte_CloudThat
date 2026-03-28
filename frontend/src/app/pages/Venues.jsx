import { useEffect, useMemo, useState } from "react";
import { Clock3, Filter, MapPin, Star, Users } from "lucide-react";
import { Link, useLocation } from "react-router";
import { DateTimeScheduler } from "../components/ui/date-time-scheduler";
import { venueVendorApi } from "../lib/venue-vendor-api";
import { eventApi } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { portalFromPath } from "../lib/roles";
const serviceCategories = ["CATERING", "AV", "DECOR", "SECURITY", "PHOTOGRAPHY"];
const RAZORPAY_SCRIPT_ID = "razorpay-checkout-js";
const loadRazorpayScript = async () => {
    if (typeof window === "undefined") {
        return false;
    }
    if (window.Razorpay) {
        return true;
    }
    const existing = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existing) {
        return await new Promise((resolve) => {
            existing.addEventListener("load", () => resolve(true), { once: true });
            existing.addEventListener("error", () => resolve(false), { once: true });
        });
    }
    return await new Promise((resolve) => {
        const script = document.createElement("script");
        script.id = RAZORPAY_SCRIPT_ID;
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};
export function Venues() {
    const location = useLocation();
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
    const [availabilityByVenue, setAvailabilityByVenue] = useState({});
    const [availabilityStart, setAvailabilityStart] = useState("");
    const [availabilityEnd, setAvailabilityEnd] = useState("");
    const [bookingVenueId, setBookingVenueId] = useState("");
    const [bookingEventId, setBookingEventId] = useState("");
    const [bookingStart, setBookingStart] = useState("");
    const [bookingEnd, setBookingEnd] = useState("");
    const [bookingHallIds, setBookingHallIds] = useState([]);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [payingBookingId, setPayingBookingId] = useState("");
    const [cancellingBookingId, setCancellingBookingId] = useState("");
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [venueCity, setVenueCity] = useState("");
    const [venueCapacity, setVenueCapacity] = useState("");
    const [venuePricePerDay, setVenuePricePerDay] = useState("");
    const [venueAmenities, setVenueAmenities] = useState("");
    const [venueMediaGallery, setVenueMediaGallery] = useState("");
    const [venueHalls, setVenueHalls] = useState([{ hallName: "", capacity: "" }]);
    const [createVenueLoading, setCreateVenueLoading] = useState(false);
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
    const loadBookings = async () => {
        if (!session?.accessToken) {
            setBookings([]);
            return;
        }
        setLoadingBookings(true);
        setError("");
        try {
            const response = await venueVendorApi.listBookings({ upcomingOnly: true, limit: 50 });
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
        void loadBookings();
    }, [session?.accessToken]);
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
                await handleBookingPayment(booking, selectedEvent);
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
    const handleBookingPayment = async (booking, linkedEvent) => {
        if (!session?.user?.email) {
            setError("Login again before completing the booking payment.");
            return;
        }
        setError("");
        setMessage("");
        setPayingBookingId(booking.bookingId);
        try {
            const payment = await financeApi.initiatePayment({
                eventId: booking.eventId,
                eventName: linkedEvent?.title || `Venue booking ${booking.bookingId.slice(0, 8)}`,
                registrationId: null,
                venueBookingId: booking.bookingId,
                amount: booking.paymentAmount,
                currency: booking.paymentCurrency || "INR",
                paymentMethod: "CARD",
                customerEmail: booking.bookingOwnerEmail || session.user.email,
                description: `Venue booking payment for ${linkedEvent?.title || booking.eventId}`
            });
            if (payment.status === "SUCCEEDED") {
                setMessage(`Venue payment ${payment.gatewayReference} succeeded. Invoice ${payment.invoiceNumber || ""}`.trim());
                await loadBookings();
                return;
            }
            const loaded = await loadRazorpayScript();
            if (!loaded || !window.Razorpay || !payment.gatewayOrderId || !payment.checkoutKeyId) {
                setError("Payment system unavailable right now. Your booking is still reserved and can be paid later from the bookings table.");
                return;
            }
            const razorpay = new window.Razorpay({
                key: payment.checkoutKeyId,
                amount: payment.checkoutAmount,
                currency: payment.currency,
                name: payment.checkoutName || "EventZen",
                description: payment.checkoutDescription || payment.description,
                order_id: payment.gatewayOrderId,
                prefill: {
                    email: booking.bookingOwnerEmail || session.user.email
                },
                notes: {
                    bookingId: booking.bookingId,
                    eventId: booking.eventId
                },
                theme: {
                    color: "#1132d4"
                },
                handler: async (response) => {
                    const verified = await financeApi.verifyPayment({
                        razorpayOrderId: response.razorpay_order_id,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpaySignature: response.razorpay_signature
                    });
                    setMessage(`Venue booking payment ${verified.gatewayPaymentId || verified.gatewayReference} succeeded.`);
                    await loadBookings();
                },
                modal: {
                    ondismiss: () => {
                        setMessage("Venue booking payment is still pending. You can complete it later from the bookings list.");
                    }
                }
            });
            razorpay.open();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Venue payment could not be started.");
        }
        finally {
            setPayingBookingId("");
        }
    };
    const handleCancelBooking = async (booking) => {
        const confirmed = window.confirm(`Cancel venue booking "${booking.bookingId}"? This will release the reserved venue slot.`);
        if (!confirmed) {
            return;
        }
        setError("");
        setMessage("");
        setCancellingBookingId(booking.bookingId);
        try {
            await venueVendorApi.cancelBooking(booking.bookingId, {});
            setMessage(`Venue booking ${booking.bookingId} was cancelled.`);
            await loadBookings();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to cancel the venue booking.");
        }
        finally {
            setCancellingBookingId("");
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
    const vendorContent = useMemo(() => {
        if (!session?.accessToken) {
            return (<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Vendor listing requires authentication. Please <Link className="font-semibold underline" to="/auth">login</Link> first.
        </div>);
        }
        if (loadingVendors) {
            return <p className="text-sm text-slate-500">Loading vendors...</p>;
        }
        if (vendors.length === 0) {
            return <p className="text-sm text-slate-500">No vendors found for selected filter.</p>;
        }
        return (<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vendors.map((vendor) => (<article key={vendor.vendorId} className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-white/15 dark:bg-[#111a33]">
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
      </div>);
    }, [loadingVendors, session?.accessToken, vendors]);
    const venueLookup = useMemo(() => Object.fromEntries(venues.map((venue) => [venue.venueId, venue])), [venues]);
    const selectedBookingVenue = bookingVenueId ? venueLookup[bookingVenueId] : undefined;
    const eventLookup = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events]);
    const vendorLookup = useMemo(() => Object.fromEntries(allVendors.map((vendor) => [vendor.vendorId, vendor])), [allVendors]);
    const toggleBookingHall = (hallId) => {
        setBookingHallIds((current) => current.includes(hallId) ? current.filter((item) => item !== hallId) : [...current, hallId]);
    };
    return (<main>
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
            <h1 className="eventzen-page-title mt-2">{isAdminPortal ? "Venue Management" : "Venue Booking Workspace"}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{isAdminPortal ? "Monitor venue availability, track who booked each venue, and review the vendor catalog." : "Browse venues, check availability, and book spaces for your events."}</p>
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
                <button type="button" onClick={() => setAvailabilityByVenue({})} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                  Clear Results
                </button>
              </div>
            </div>
          </section>
          {loadingVenues ? (<p className="text-sm text-slate-500">Loading venues...</p>) : (<div className="grid gap-4 xl:grid-cols-2">
              {venues.map((venue) => (<article key={venue.venueId} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-white/15 dark:bg-[#111a33]">
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
            </div>)}

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
                <h2 className="text-2xl font-black">Active Venue Bookings</h2>
                <p className="mt-1 text-sm text-slate-500">Upcoming bookings from `GET /api/v1/venues/bookings`.</p>
              </div>
              <button type="button" onClick={() => void loadBookings()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                Refresh Bookings
              </button>
            </div>

            {!session?.accessToken ? (<p className="mt-4 text-sm text-slate-500">Login is required to view venue bookings.</p>) : loadingBookings ? (<p className="mt-4 text-sm text-slate-500">Loading venue bookings...</p>) : bookings.length === 0 ? (<p className="mt-4 text-sm text-slate-500">No upcoming venue bookings found.</p>) : (<div className="mt-4 overflow-x-auto">
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
                      <th className="px-3 py-3">Payment</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => {
                const venue = venueLookup[booking.venueId];
                const linkedEvent = eventLookup[booking.eventId];
                const vendor = booking.vendorId ? vendorLookup[booking.vendorId] : undefined;
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
                            <p className={`font-semibold ${paymentPending ? "text-amber-600" : "text-emerald-600"}`}>
                              {paymentDisplay}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(booking.paymentCurrency || "INR")} {Number(booking.paymentAmount || 0).toLocaleString()}
                            </p>
                            {booking.invoiceNumber ? <p className="text-xs text-slate-500">Invoice {booking.invoiceNumber}</p> : null}
                            {!isAdminPortal && paymentPending ? (<button type="button" onClick={() => void handleBookingPayment(booking, linkedEvent)} disabled={payingBookingId === booking.bookingId} className="mt-2 rounded-lg bg-[#1132d4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                                {payingBookingId === booking.bookingId ? "Starting..." : "Pay now"}
                              </button>) : null}
                            {booking.paymentId ? (<button type="button" onClick={() => void financeApi.downloadInvoice(booking.paymentId, `venue-booking-${booking.bookingId}.pdf`)} className="mt-2 block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                                Download invoice
                              </button>) : null}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <button type="button" onClick={() => void handleCancelBooking(booking)} disabled={cancellingBookingId === booking.bookingId} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
                              {cancellingBookingId === booking.bookingId ? "Cancelling..." : "Cancel booking"}
                            </button>
                          </td>
                        </tr>);
            })}
                  </tbody>
                </table>
              </div>)}
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black sm:text-3xl">Vendor Catalog</h2>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-base dark:border-white/20 dark:bg-[#111a33]">
                <Filter className="size-4"/> Filter
              </button>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-base dark:border-white/20 dark:bg-[#111a33]">
                <option value="">All</option>
                {serviceCategories.map((item) => (<option key={item} value={item}>
                    {item}
                  </option>))}
              </select>
            </div>
          </div>

          {vendorContent}
      </div>
    </main>);
}
