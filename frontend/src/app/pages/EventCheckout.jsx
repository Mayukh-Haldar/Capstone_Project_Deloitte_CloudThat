import { ArrowLeft, CreditCard, ShieldCheck, Ticket, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useAuthSession } from "../lib/auth-storage";
import { eventApi, getEventStatusLabel, isRegistrationOpen } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { ApiClientError } from "../lib/http-client";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
import { ticketingApi } from "../lib/ticketing-api";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
let razorpayScriptPromise = null;
const isLocalDevHost = () => {
    if (typeof window === "undefined") {
        return false;
    }
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
};
const loadRazorpayScript = async () => {
    if (typeof window === "undefined") {
        return false;
    }
    if (window.Razorpay) {
        return true;
    }
    if (!razorpayScriptPromise) {
        razorpayScriptPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }
    return razorpayScriptPromise;
};
export function EventCheckout() {
    const { id, ticketTypeId } = useParams();
    const [searchParams] = useSearchParams();
    const seatRowParam = searchParams.get("seatRow");
    const seatColParam = searchParams.get("seatCol");
    const reservationIdParam = searchParams.get("reservationId");
    const hasSeat = Boolean(seatRowParam && seatColParam);
    const reservationIdRef = useRef(hasSeat && reservationIdParam ? reservationIdParam : null);
    const navigate = useNavigate();
    const session = useAuthSession();
    const [eventDetail, setEventDetail] = useState(null);
    const [ticketType, setTicketType] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [checkoutError, setCheckoutError] = useState("");
    const [busy, setBusy] = useState(false);
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);
    const [checkoutMode, setCheckoutMode] = useState("AUTO");
    const [checkoutDraft, setCheckoutDraft] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: ""
    });
    useEffect(() => {
        if (!session) {
            setCheckoutDraft({ firstName: "", lastName: "", email: "", phone: "" });
            setCheckoutMode("AUTO");
            return;
        }
        setCheckoutDraft({
            firstName: session.user.firstName || "",
            lastName: session.user.lastName || "",
            email: session.user.email || "",
            phone: session.user.phone || ""
        });
        setCheckoutMode(session.user.phone ? "AUTO" : "MANUAL");
    }, [session]);
    useEffect(() => {
        if (!id || !ticketTypeId) {
            setError("Checkout details are incomplete.");
            setLoading(false);
            return;
        }
        const load = async () => {
            setLoading(true);
            setError("");
            setAlreadyRegistered(false);
            try {
                // Check if user is already registered for this event
                if (session) {
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
                            setError("You have successfully registered for this event. Please check your tickets page.");
                            setLoading(false);
                            return;
                        }
                    }
                    catch (regErr) {
                        // Continue with checkout even if registration check fails
                        console.error("Error checking existing registrations:", regErr);
                    }
                }
                const [eventData, ticketTypeData] = await Promise.all([
                    eventApi.getEvent(id),
                    ticketingApi.listTicketTypes(id)
                ]);
                setEventDetail(eventData);
                if (!isRegistrationOpen(eventData.event.status)) {
                    setError(`Checkout is unavailable while this event is in ${getEventStatusLabel(eventData.event.status).toLowerCase()}.`);
                    setLoading(false);
                    return;
                }
                const matchedTicketType = ticketTypeData.find((item) => item.ticketTypeId === ticketTypeId) || null;
                setTicketType(matchedTicketType);
                if (!matchedTicketType) {
                    setError("That ticket tier is no longer available.");
                }
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load checkout details.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [id, ticketTypeId, session]);
    const profileHasPhone = Boolean(session?.user.phone?.trim());
    const effectiveCheckoutMode = profileHasPhone ? checkoutMode : "MANUAL";
    useEffect(() => {
        return () => {
            if (reservationIdRef.current && ticketTypeId) {
                ticketingApi.cancelReservation(ticketTypeId, reservationIdRef.current).catch(() => {});
            }
        };
    }, [ticketTypeId]);
    const handleBack = async () => {
        if (reservationIdRef.current && ticketTypeId) {
            try {
                await ticketingApi.cancelReservation(ticketTypeId, reservationIdRef.current);
            } catch {
                // best-effort
            }
            reservationIdRef.current = null;
        }
        void navigate(`/events/${id}`);
    };
    const confirmCheckout = async () => {
        if (!id || !ticketTypeId || !session || !ticketType || !eventDetail) {
            setCheckoutError("Unable to continue with checkout.");
            return;
        }
        if (!isRegistrationOpen(eventDetail.event.status)) {
            setCheckoutError(`Registration is currently unavailable because this event is in ${getEventStatusLabel(eventDetail.event.status).toLowerCase()}.`);
            return;
        }
        if (alreadyRegistered) {
            setCheckoutError("You have already registered for this event.");
            return;
        }
        // Double-check for existing registrations before proceeding
        try {
            const registrations = await ticketingApi.listMyRegistrations();
            const existingReg = registrations.find((reg) => {
                const matchesEventId = reg.eventId === id;
                const hasActiveRegistrationStatus = reg.status !== "CANCELED" && reg.status !== "PENDING";
                const hasActiveTicket = reg.ticket?.status !== "CANCELED";
                return matchesEventId && hasActiveRegistrationStatus && hasActiveTicket;
            });
            if (existingReg) {
                setCheckoutError("You have successfully registered for this event. Redirecting to your tickets...");
                setTimeout(() => {
                    reservationIdRef.current = null;
                    void navigate("/my/registrations");
                }, 2000);
                return;
            }
        }
        catch (regCheckErr) {
            // Proceed with checkout if check fails
            console.error("Error checking registrations:", regCheckErr);
        }
        const customerDetails = effectiveCheckoutMode === "AUTO"
            ? {
                firstName: session.user.firstName,
                lastName: session.user.lastName,
                email: session.user.email,
                phone: session.user.phone || ""
            }
            : {
                firstName: checkoutDraft.firstName.trim(),
                lastName: checkoutDraft.lastName.trim(),
                email: checkoutDraft.email.trim(),
                phone: checkoutDraft.phone.trim()
            };
        if (!customerDetails.firstName || !customerDetails.lastName || !customerDetails.email) {
            setCheckoutError("Enter first name, last name, and email before continuing.");
            return;
        }
        if (!customerDetails.phone) {
            setCheckoutError("Enter a phone number before continuing to checkout.");
            return;
        }
        setBusy(true);
        setCheckoutError("");
        setActionMessage("");
        try {
            const registration = await ticketingApi.createRegistration({
                eventId: id,
                ticketTypeId,
                firstName: customerDetails.firstName,
                lastName: customerDetails.lastName,
                email: customerDetails.email,
                phone: customerDetails.phone || undefined,
                ...(hasSeat && {
                    seatRow: seatRowParam,
                    seatColumn: parseInt(seatColParam, 10),
                    seatReservationId: reservationIdParam || undefined
                })
            }, `${id}-${ticketTypeId}-${Date.now()}`);
            if (ticketType.price > 0) {
                try {
                    const taxes = Math.round(ticketType.price * 0.08 * 100) / 100;
                    const totalAmount = Math.round((ticketType.price + taxes) * 100) / 100;
                    const payment = await financeApi.initiatePayment({
                        eventId: id,
                        eventName: eventDetail.event.title || "Event registration",
                        registrationId: registration.registrationId,
                        amount: totalAmount,
                        currency: "INR",
                        paymentMethod: "CARD",
                        customerEmail: customerDetails.email,
                        description: `${ticketType.ticketName} payment for ${eventDetail.event.title || "event"}`
                    });
                    const loaded = await loadRazorpayScript();
                    if (!loaded || !window.Razorpay || !payment.gatewayOrderId || !payment.checkoutKeyId) {
                        // Razorpay setup failed - cancel the registration and clean up
                        try {
                            await ticketingApi.cancelRegistration(registration.registrationId, "PAYMENT_FAILED");
                            console.log("Registration cancelled due to Razorpay setup failure");
                        }
                        catch (cancelErr) {
                            console.error("Error cancelling registration after Razorpay setup failure:", cancelErr);
                        }
                        setActionMessage(`Payment system unavailable. Your registration has been cancelled. Please try registering again.`);
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
                            name: `${customerDetails.firstName} ${customerDetails.lastName}`.trim(),
                            email: customerDetails.email,
                            contact: customerDetails.phone
                        },
                        notes: {
                            registrationId: registration.registrationId,
                            eventId: id
                        },
                        theme: {
                            color: "#1132d4"
                        },
                        handler: async (response) => {
                            try {
                                const verified = await financeApi.verifyPayment({
                                    razorpayOrderId: response.razorpay_order_id,
                                    razorpayPaymentId: response.razorpay_payment_id,
                                    razorpaySignature: response.razorpay_signature
                                });
                                void navigate("/my/registrations", {
                                    replace: true,
                                    state: {
                                        actionMessage: `Razorpay payment ${verified.gatewayPaymentId || verified.gatewayReference} succeeded and ticket ${registration.ticket.ticketNumber} is now in your wallet.`,
                                        invoicePaymentId: verified.id,
                                        invoiceNumber: verified.invoiceNumber
                                    }
                                });
                            }
                            catch (verifyErr) {
                                if (isLocalDevHost()) {
                                    reservationIdRef.current = null;
                                    void navigate("/my/registrations", {
                                        replace: true,
                                        state: {
                                            actionMessage: `Local payment flow completed for ticket ${registration.ticket.ticketNumber}. Refresh My Registrations in a moment if the invoice link does not appear immediately.`
                                        }
                                    });
                                    return;
                                }
                                // A gateway success callback followed by backend verification failure is ambiguous.
                                // Do not auto-cancel here because the payment may have been captured successfully.
                                console.error("Payment verification failed after Razorpay success callback:", verifyErr);
                                setActionMessage(verifyErr instanceof ApiClientError
                                    ? `Payment verification is pending because the finance service returned: ${verifyErr.message}. Your registration has been kept. Please check My Registrations / My Tickets before retrying payment.`
                                    : "Payment verification is pending. Your registration has been kept. Please check My Registrations / My Tickets before retrying payment.");
                                reservationIdRef.current = null;
                                void navigate("/my/registrations", {
                                    replace: true,
                                    state: {
                                        actionMessage: verifyErr instanceof ApiClientError
                                            ? `Payment verification is pending because the finance service returned: ${verifyErr.message}. Please confirm your ticket status in My Registrations before making another payment.`
                                            : "Payment verification is pending. Please confirm your ticket status in My Registrations before making another payment."
                                    }
                                });
                            }
                        },
                        modal: {
                            ondismiss: async () => {
                                // User cancelled payment - cancel the registration and clean up
                                try {
                                    await ticketingApi.cancelRegistration(registration.registrationId, "USER_CANCELLED");
                                    console.log("Registration cancelled due to payment cancellation");
                                }
                                catch (cancelErr) {
                                    console.error("Error cancelling registration after payment dismissal:", cancelErr);
                                }
                                setActionMessage("Payment was cancelled. Your registration has been removed. You can try registering again.");
                            }
                        }
                    });
                    razorpay.open();
                    setActionMessage(`Complete payment to confirm your registration. If you cancel, your registration will be automatically removed.`);
                    return;
                }
                catch (paymentErr) {
                    // Payment setup failed - cancel the registration and clean up
                    try {
                        await ticketingApi.cancelRegistration(registration.registrationId, "PAYMENT_FAILED");
                        console.log("Registration cancelled due to payment setup failure");
                    }
                    catch (cancelErr) {
                        console.error("Error cancelling registration after payment setup failure:", cancelErr);
                    }
                    setActionMessage(paymentErr instanceof ApiClientError
                        ? `Payment setup failed: ${paymentErr.message}. Your registration has been cancelled. Please try registering again.`
                        : "Payment setup failed. Your registration has been cancelled. Please try registering again.");
                    return;
                }
            }
            reservationIdRef.current = null;
            void navigate("/my/registrations", {
                replace: true,
                state: {
                    actionMessage: `Registration confirmed. Ticket ${registration.ticket.ticketNumber} is now in your wallet.`
                }
            });
        }
        catch (err) {
            setActionMessage(err instanceof ApiClientError ? err.message : "Registration failed.");
        }
        finally {
            setBusy(false);
        }
    };
    if (loading) {
        return <section className="p-8 text-sm text-slate-500">Loading checkout...</section>;
    }
    if (error || !eventDetail || !ticketType) {
        return (<section className="p-8">
        <p className="text-sm text-red-600">{error || "Checkout is unavailable."}</p>
        {id && (<>
            <button type="button" onClick={() => void handleBack()} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1132d4]">
              <ArrowLeft className="size-4"/>
              Back to event
            </button>
            {alreadyRegistered && (<Link to="/my/registrations" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 block">
                View your tickets
              </Link>)}
          </>)}
      </section>);
    }
    return (<section className="min-h-screen bg-[#f3f5f9] px-4 py-8 text-slate-900 dark:bg-[#09132a] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button type="button" onClick={() => void handleBack()} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1132d4]">
          <ArrowLeft className="size-4"/>
          Back to event
        </button>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1132d4]">Confirm Checkout</p>
            <h1 className="mt-3 text-3xl font-black">{eventDetail.event.title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Review attendee details before continuing to {ticketType.price > 0 ? "Razorpay payment" : "ticket confirmation"}.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {profileHasPhone && (<button type="button" onClick={() => setCheckoutMode("AUTO")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${checkoutMode === "AUTO" ? "bg-[#1132d4] text-white" : "border border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200"}`}>
                  Auto data fetch
                </button>)}
              <button type="button" onClick={() => setCheckoutMode("MANUAL")} className={`rounded-xl px-3 py-2 text-sm font-semibold ${effectiveCheckoutMode === "MANUAL" ? "bg-[#1132d4] text-white" : "border border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200"}`}>
                Manual form entry
              </button>
            </div>

            {!profileHasPhone && (<p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Your profile does not have a phone number yet, so manual entry is required before checkout.
              </p>)}

            {alreadyRegistered && (<div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <p className="font-semibold mb-1">Already Registered</p>
                <p>You have already registered for this event. <Link to="/my/tickets" className="underline font-semibold">View your tickets</Link></p>
              </div>)}

            {effectiveCheckoutMode === "AUTO" ? (<div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</p>
                  <p className="mt-1 text-sm font-semibold">{session?.user.firstName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</p>
                  <p className="mt-1 text-sm font-semibold">{session?.user.lastName}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-1 text-sm font-semibold">{session?.user.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                  <p className="mt-1 text-sm font-semibold">{session?.user.phone}</p>
                </div>
              </div>) : (<div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  First name<span className="required-mark">*</span>
                  <input value={checkoutDraft.firstName} onChange={(event) => setCheckoutDraft((current) => ({ ...current, firstName: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/15 dark:bg-[#09132a] dark:text-slate-100" placeholder="Enter first name"/>
                </label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Last name<span className="required-mark">*</span>
                  <input value={checkoutDraft.lastName} onChange={(event) => setCheckoutDraft((current) => ({ ...current, lastName: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/15 dark:bg-[#09132a] dark:text-slate-100" placeholder="Enter last name"/>
                </label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Email<span className="required-mark">*</span>
                  <input type="email" value={checkoutDraft.email} onChange={(event) => setCheckoutDraft((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/15 dark:bg-[#09132a] dark:text-slate-100" placeholder="Enter email"/>
                </label>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Phone<span className="required-mark">*</span>
                  <input value={checkoutDraft.phone} onChange={(event) => setCheckoutDraft((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/15 dark:bg-[#09132a] dark:text-slate-100" placeholder="Enter phone number"/>
                </label>
              </div>)}

            {checkoutError && (<p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {checkoutError}
              </p>)}

            {actionMessage && (<p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {actionMessage}
              </p>)}

            <button type="button" onClick={() => void confirmCheckout()} disabled={busy || alreadyRegistered || !isRegistrationOpen(eventDetail.event.status)} className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy
            ? "Preparing checkout..."
            : alreadyRegistered
                ? "Already Registered"
                : !isRegistrationOpen(eventDetail.event.status)
                    ? "Registration Closed"
                    : ticketType.price > 0
                        ? "Confirm checkout"
                        : "Confirm ticket"}
            </button>
          </article>

          <aside className="space-y-4 rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
            <div className="relative overflow-hidden rounded-2xl p-5 text-white">
              <img src={getEventPlaceholderImage(`${eventDetail?.event.id ?? id ?? "checkout"}-${ticketType.ticketTypeId}`)} alt={eventDetail?.event.title || "Event"} className="absolute inset-0 h-full w-full object-cover"/>
              <div className="absolute inset-0 bg-slate-950/45"/>
              <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">Order Summary</p>
              <h2 className="mt-3 text-2xl font-black">{ticketType.ticketName}</h2>
              <p className="mt-2 text-sm text-white/85">{ticketType.description || "Entry pass for this event."}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Ticket className="size-4"/>
                Tier
              </p>
              <p className="mt-1 text-base font-bold">{ticketType.tierCode}</p>
            </div>

            {hasSeat && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/8">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <Ticket className="size-4"/>
                  Seat
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  Row {seatRowParam} · Seat {seatColParam}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <CreditCard className="size-4"/>
                Payable now
              </p>
              {ticketType.price > 0 ? (() => {
                const taxes = Math.round(ticketType.price * 0.08 * 100) / 100;
                const totalAmount = Math.round((ticketType.price + taxes) * 100) / 100;
                return (
                  <>
                    <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(ticketType.price, "INR")}</span></div>
                      <div className="flex justify-between"><span>Taxes &amp; Fees (8%)</span><span>{formatCurrency(taxes, "INR")}</span></div>
                    </div>
                    <p className="mt-2 pt-2 border-t border-slate-100 dark:border-white/10 text-2xl font-black">{formatCurrency(totalAmount, "INR")}</p>
                  </>
                );
              })() : <p className="mt-1 text-2xl font-black">Free</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <UserRound className="size-4"/>
                Data source
              </p>
              <p className="mt-1 text-sm font-semibold">
                {effectiveCheckoutMode === "AUTO" ? "Profile auto fetch" : "Manual form entry"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
              <p className="inline-flex items-center gap-2 font-semibold text-slate-500">
                <ShieldCheck className="size-4"/>
                Payment step
              </p>
              <p className="mt-2">
                After confirmation, paid tickets continue to Razorpay. Free tickets are confirmed immediately.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <strong>Important:</strong> If payment fails or is cancelled, your registration will be automatically removed.
                This ensures clean ticket availability and prevents incomplete registrations.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <strong>Note:</strong> Paid tickets stay pending until Razorpay payment is verified successfully.
                Your ticket wallet only updates after that confirmation step completes.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>);
}
