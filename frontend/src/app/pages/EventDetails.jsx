import { Calendar, MapPin, Users, Info, Minus, Plus, CheckCircle2, HelpCircle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { eventApi, getEventStatusLabel, isRegistrationOpen } from "../lib/event-api";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
import clsx from "clsx";
const formatShortDate = (value) => {
    const d = new Date(value);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const formatTime = (value) => {
    const d = new Date(value);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const getSpeakerInitials = (name) => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
export function EventDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const session = useAuthSession();
    const [eventDetail, setEventDetail] = useState(null);
    const [ticketTypes, setTicketTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [ticketTypeError, setTicketTypeError] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [busyTicketId, setBusyTicketId] = useState("");
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);
    const [existingRegistrationId, setExistingRegistrationId] = useState(null);
    const [brokenSpeakerPhotos, setBrokenSpeakerPhotos] = useState({});
    const [selectedTickets, setSelectedTickets] = useState({});
    useEffect(() => {
        if (!id)
            return;
        const load = async () => {
            setLoading(true);
            setError("");
            setTicketTypeError("");
            try {
                const eventData = await eventApi.getEvent(id);
                setEventDetail(eventData);
                try {
                    const ticketTypeData = await ticketingApi.listTicketTypes(id);
                    setTicketTypes(ticketTypeData);
                    if (ticketTypeData.length > 0) {
                        setSelectedTickets({ [ticketTypeData[0].ticketTypeId]: 1 });
                    }
                }
                catch (ticketErr) {
                    setTicketTypes([]);
                    setTicketTypeError(ticketErr instanceof ApiClientError ? ticketErr.message : "Unable to load ticket tiers right now.");
                }
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load event.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [id]);
    // Check if user is already registered for this event.
    // Check if user is already registered for this event.
    // Use strict eventId + active ticket matching to avoid false positives.
    useEffect(() => {
        if (!session || !id || !eventDetail) {
            setAlreadyRegistered(false);
            setExistingRegistrationId(null);
            return;
        }
        const checkRegistration = async () => {
            try {
                const registrations = await ticketingApi.listMyRegistrations();
                const existingReg = registrations.find((reg) => {
                    const matchesEventId = reg.eventId === id;
            const hasActiveRegistrationStatus = reg.status !== "CANCELED" && reg.status !== "PENDING";
            const hasActiveTicket = reg.ticket?.status !== "CANCELED";
            return matchesEventId && hasActiveRegistrationStatus && hasActiveTicket;
                });
                if (existingReg) {
                    setAlreadyRegistered(true);
                    setExistingRegistrationId(existingReg.registrationId);
                    setActionMessage("");
                }
                else {
                    setAlreadyRegistered(false);
                    setExistingRegistrationId(null);
                }
            }
            catch {
                setAlreadyRegistered(false);
                setExistingRegistrationId(null);
            }
        };
        void checkRegistration();
    }, [session, id, eventDetail]);
    const handleTicketChange = (ticketTypeId, change, isDirectClick = false) => {
        setSelectedTickets((prev) => {
            const current = prev[ticketTypeId] || 0;
            // Limit to 1 ticket total across all tiers for checkout
            if (isDirectClick) {
                if (current === 0)
                    return { [ticketTypeId]: 1 };
                return prev;
            }
            const next = Math.max(0, current + change);
            if (next > 0) {
                return { [ticketTypeId]: 1 }; // Force max 1
            }
            return {};
        });
    };
    const currentSelection = useMemo(() => {
        let subtotal = 0;
        let selectedId = null;
        let qty = 0;
        for (const tId in selectedTickets) {
            if (selectedTickets[tId] > 0) {
                const t = ticketTypes.find(x => x.ticketTypeId === tId);
                if (t) {
                    selectedId = tId;
                    qty = selectedTickets[tId];
                    subtotal += t.price * qty;
                }
            }
        }
        const taxes = subtotal * 0.08; // dummy 8% tax
        return { selectedId, qty, subtotal, taxes, total: subtotal + taxes };
    }, [selectedTickets, ticketTypes]);
    const speakers = useMemo(() => {
        if (!eventDetail) {
            return [];
        }
        const speakerMap = new Map();
        for (const session of eventDetail.sessions) {
            const rawName = session.speakerName?.trim();
            if (!rawName) {
                continue;
            }
            const key = (session.speakerId || rawName).toLowerCase();
            const roleBits = [session.speakerRole?.trim(), session.speakerCompany?.trim()].filter(Boolean);
            const existing = speakerMap.get(key);
            const nextSpeaker = {
                id: session.speakerId || key,
                name: rawName,
                photoUrl: session.speakerPhotoUrl?.trim() || "",
                roleLine: roleBits.join(", "),
                bio: session.speakerBio?.trim() || "",
                sessionTitle: session.sessionTitle
            };
            if (!existing) {
                speakerMap.set(key, nextSpeaker);
                continue;
            }
            speakerMap.set(key, {
                ...existing,
                photoUrl: existing.photoUrl || nextSpeaker.photoUrl,
                roleLine: existing.roleLine || nextSpeaker.roleLine,
                bio: existing.bio || nextSpeaker.bio,
                sessionTitle: existing.sessionTitle || nextSpeaker.sessionTitle
            });
        }
        return [...speakerMap.values()];
    }, [eventDetail]);
    const openCheckout = () => {
        if (!session) {
            setActionMessage("Please sign in before registering.");
            return;
        }
        if (alreadyRegistered) {
            setActionMessage("You have already registered for this event.");
            return;
        }
        if (!currentSelection.selectedId) {
            setActionMessage("Please select a ticket tier.");
            return;
        }
        setActionMessage(""); // Clear any previous messages
        const selectedTicketType = ticketTypes.find(t => t.ticketTypeId === currentSelection.selectedId);
        if (selectedTicketType && selectedTicketType.totalQuantity > 0) {
            void navigate(`/events/${id}/seats/${currentSelection.selectedId}`);
        } else {
            void navigate(`/events/${id}/checkout/${currentSelection.selectedId}?qty=${currentSelection.qty}`);
        }
    };
    if (loading) {
        return <section className="min-h-screen p-8 text-sm text-slate-500 flex items-center justify-center">Loading event details...</section>;
    }
    if (error || !eventDetail) {
        return <section className="min-h-screen p-8 text-sm text-red-600 flex items-center justify-center">{error || "Event not found."}</section>;
    }
    const event = eventDetail.event;
    const canRegister = isRegistrationOpen(event.status);
    const registrationBlockedReason = (() => {
        if (canRegister) {
            return "";
        }
        if (event.status === "PUBLISHED") {
            return "Registration has not opened yet for this published event.";
        }
        if (event.status === "REGISTRATION_CLOSED") {
            return "Registration has been closed for this event.";
        }
        if (event.status === "ONGOING") {
            return "Registration is closed because this event is already ongoing.";
        }
        if (event.status === "COMPLETED") {
            return "Registration is closed because this event has been completed.";
        }
        if (event.status === "ARCHIVED") {
            return "Registration is unavailable because this event has been archived.";
        }
        return `Registration is unavailable while the event is in ${getEventStatusLabel(event.status).toLowerCase()}.`;
    })();
    // Capacity calculations
    const capacity = event.capacity || 100;
    const pctFilled = eventDetail.registrationUtilizationPercent || 0;
    const attendingCount = Math.round((pctFilled / 100) * capacity);
    // Group agenda items by date
    const agendaByDate = (eventDetail.agendaItems || []).reduce((acc, item) => {
        const dateKey = new Date(item.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        if (!acc[dateKey])
            acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {});
    // For venue embedding
    const encodedAddress = encodeURIComponent(event.venueCity ? `${event.venueName}, ${event.venueCity}` : "San Francisco, CA");
    return (<section className="min-h-screen bg-slate-50 py-10 dark:bg-[#0a0f1d] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          
          {/* Left Column */}
          <div className="space-y-12">
            
            {/* Header / Hero */}
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-white/10">
                <img src={event.bannerImageUrl || getEventPlaceholderImage(event.id)} alt={event.title} className="h-80 w-full object-cover"/>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {event.tags.length ? (event.tags.map(t => (<span key={t} className="inline-flex rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700 dark:bg-[#1132d4]/20 dark:text-[#7aa3ff] uppercase tracking-wider">
                        {t}
                      </span>))) : (<span className="inline-flex rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700 dark:bg-[#1132d4]/20 dark:text-[#7aa3ff] uppercase tracking-wider">
                      {event.categoryName}
                    </span>)}
                </div>
                <h1 className="text-4xl font-black tracking-tight ds-display">{event.title}</h1>
                
                <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400 mt-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-blue-600 dark:text-[#7aa3ff]"/>
                    {formatShortDate(event.startTime)} - {formatShortDate(event.endTime)}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-blue-600 dark:text-[#7aa3ff]"/>
                    {event.venueCity || "Virtual"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-blue-600 dark:text-[#7aa3ff]"/>
                    {attendingCount.toLocaleString()} Attending
                  </div>
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-[#0f172e] dark:border-white/10 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="uppercase tracking-wider text-slate-500">Ticket Capacity</span>
                  <span className="text-blue-600 dark:text-[#7aa3ff]">{pctFilled}% Filled</span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-blue-600 dark:bg-[#1132d4] rounded-full transition-all duration-500" style={{ width: `${pctFilled}%` }}/>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Info className="size-4"/>
                  Limited seats remaining. Reserve yours today!
                </div>
              </div>
            </div>

            {/* About */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">About the Event</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[15px]">
                {event.description || "Join us for an amazing experience with industry leaders and unforgettable moments. More details coming soon."}
              </p>
            </div>

            {/* Agenda */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Agenda</h2>
              {Object.keys(agendaByDate).length === 0 ? (<p className="text-slate-500 dark:text-slate-400">Agenda will be announced soon.</p>) : (<div className="relative border-l-2 border-blue-100 dark:border-blue-900/50 pl-6 ml-3 space-y-10">
                  {Object.entries(agendaByDate).map(([date, items], dayIdx) => (<div key={date} className="relative">
                      <div className="absolute -left-[35px] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white dark:bg-[#7aa3ff] dark:ring-[#0a0f1d]"/>
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                        Day {dayIdx + 1} • {date}
                      </h3>
                      <div className="space-y-4">
                        {items.map(item => (<div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-[#0f172e] dark:border-white/10">
                            <h4 className="font-bold text-lg">{item.agendaTitle}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {formatTime(item.startTime)} - {formatTime(item.endTime)}
                            </p>
                            {item.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>}
                          </div>))}
                      </div>
                    </div>))}
                </div>)}
            </div>

            {/* Speakers */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Speakers</h2>
              {speakers.length === 0 ? (<p className="text-slate-500 dark:text-slate-400">Speaker lineup will be announced soon.</p>) : (<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                  {speakers.map((speaker) => (<div key={speaker.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                      <div className="mx-auto mb-4 size-28 shrink-0 overflow-hidden rounded-full border-4 border-slate-50 bg-slate-100 shadow-md dark:border-[#1a223f]">
                        {speaker.photoUrl && !brokenSpeakerPhotos[speaker.id] ? (<img src={speaker.photoUrl} alt={speaker.name} className="h-full w-full object-cover" onError={() => setBrokenSpeakerPhotos((current) => ({
                        ...current,
                        [speaker.id]: true
                    }))}/>) : (<div className="flex h-full w-full items-center justify-center bg-[#1132d4] text-2xl font-black text-white">
                            {getSpeakerInitials(speaker.name)}
                          </div>)}
                      </div>
                      <h3 className="font-bold text-lg">{speaker.name}</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {speaker.roleLine || "Featured speaker"}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-[#7aa3ff]">
                        {speaker.sessionTitle}
                      </p>
                      {speaker.bio && (<p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{speaker.bio}</p>)}
                    </div>))}
                </div>)}
            </div>

            {/* Venue Map */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Venue</h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-[#0f172e] dark:border-white/10">
                <div className="h-[250px] w-full bg-slate-200 dark:bg-slate-800 relative">
                  <iframe width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" src={`https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik&marker=${encodedAddress}`}/>
                  {/* Better styled overlay addressing actual location */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4" style={{ backdropFilter: "blur(2px)", backgroundColor: "rgba(255,255,255,0.2)" }}>
                    <div className="bg-white dark:bg-[#0f172e] shadow-xl p-3 pr-4 rounded-xl flex items-center gap-3 border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in duration-500 pointer-events-auto">
                      <div className="rounded-full bg-blue-600 p-2 text-white shadow-md">
                        <MapPin className="size-5"/>
                      </div>
                      <div className="font-bold">{event.venueName || "Venue Location"}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-5">
                  <div>
                    <h3 className="font-bold">{event.venueName || "Main Event Venue"}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {event.venueCity || "San Francisco, CA"}
                    </p>
                  </div>
                  <a href={`https://maps.google.com/?q=${encodedAddress}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-slate-50 dark:border-white/10 dark:text-[#7aa3ff] dark:hover:bg-white/5 transition-colors">
                    Get Directions
                  </a>
                </div>
              </div>
            </div>
            
          </div>

          {/* Right Column (Sticky Registration) */}
          <div className="relative">
            <div className="sticky top-24 space-y-6">
              
              {/* Registration Card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:bg-[#0f172e] dark:border-white/10 dark:shadow-none">
                <h2 className="text-xl font-bold">Registration</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Select your ticket tier</p>
                
                {ticketTypeError && (<p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {ticketTypeError}
                  </p>)}
                {actionMessage && !alreadyRegistered && (<div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                    <p className="font-semibold mb-1">Info</p>
                    <p>{actionMessage}</p>
                  </div>)}
                {alreadyRegistered && (<div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <p className="font-semibold mb-1">Already Registered!</p>
                    <p>You have successfully registered for this event. <Link to="/my/registrations" className="underline font-semibold">View your tickets</Link></p>
                  </div>)}
                {!canRegister && (<p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    {registrationBlockedReason}
                  </p>)}
                
                <div className="space-y-4 mb-8">
                  {ticketTypes.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-white/10">
                      <p className="text-sm text-slate-500">Tickets available soon.</p>
                    </div>) : (ticketTypes.map((tier) => {
            const qty = selectedTickets[tier.ticketTypeId] || 0;
            const isSelected = qty > 0;
            return (<div key={tier.ticketTypeId} onClick={() => handleTicketChange(tier.ticketTypeId, 1, true)} className={clsx("relative overflow-hidden rounded-xl border p-4 transition-all duration-200 cursor-pointer", isSelected
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 dark:border-[#7aa3ff] dark:bg-[#1132d4]/10 dark:ring-[#7aa3ff]"
                    : "border-slate-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-[#0f172e] dark:hover:border-white/20")}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white">{tier.ticketName}</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tier.description || "General access to all base sessions"}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{formatCurrency(tier.price)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                              <button onClick={(e) => { e.stopPropagation(); handleTicketChange(tier.ticketTypeId, -1); }} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10" disabled={qty <= 0}>
                                  <Minus className="size-4"/>
                                </button>
                                <span className="w-4 text-center font-bold text-sm">{qty}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleTicketChange(tier.ticketTypeId, 1); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 disabled:opacity-50 dark:bg-[#1132d4]/30 dark:text-[#7aa3ff] dark:hover:bg-[#1132d4]/50" disabled={!canRegister || tier.availableQuantity <= 0 || qty >= 1}>
                                  <Plus className="size-4"/>
                                </button>
                            </div>
                            
                            {isSelected && (<div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-[#7aa3ff]">
                                <CheckCircle2 className="size-4"/>
                                SELECTED
                              </div>)}
                          </div>
                        </div>);
        }))}
                </div>

                <div className="border-t border-slate-200 pt-6 space-y-3 dark:border-white/10 mb-6">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(currentSelection.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Taxes & Fees</span>
                    <span>{formatCurrency(currentSelection.taxes)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <span>Total</span>
                    <span>{formatCurrency(currentSelection.total)}</span>
                  </div>
                </div>

                <button onClick={openCheckout} disabled={!canRegister || currentSelection.qty === 0 || alreadyRegistered} className="w-full rounded-xl bg-blue-600 py-4 text-base font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 dark:bg-[#1132d4] dark:hover:bg-[#1132d4]/80 shadow-md shadow-blue-600/20">
                  {alreadyRegistered ? "Already Registered" : "Register Now"}
                </button>
                <p className="text-center text-xs text-slate-400 mt-4 uppercase tracking-wider font-semibold">
                  No refunds after Oct 1, 2026
                </p>

                {actionMessage && alreadyRegistered && <p className="mt-4 text-center text-sm font-medium text-red-600 dark:text-red-400">{actionMessage}</p>}
              </div>

              {/* Need Help Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-start gap-4 dark:bg-white/5 dark:border-white/10">
                <div className="rounded-full bg-blue-600 p-2 text-white shrink-0 shadow-sm dark:bg-[#1132d4]">
                  <HelpCircle className="size-5"/>
                </div>
                <div>
                  <h3 className="font-bold text-sm">Need help?</h3>
                  <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Contact our support team</p>
                  <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">
                    <strong>Note:</strong> For paid tickets, you'll receive email notifications about registration status and payment updates.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>);
}
