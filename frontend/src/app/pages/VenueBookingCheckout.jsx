import { ArrowLeft, Building2, CalendarClock, CreditCard, FileText, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { eventApi, getEventStatusLabel } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { venueVendorApi } from "../lib/venue-vendor-api";

const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
}).format(value || 0);

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

export function VenueBookingCheckout() {
    const { bookingId } = useParams();
    const navigate = useNavigate();
    const session = useAuthSession();
    const [booking, setBooking] = useState(null);
    const [venue, setVenue] = useState(null);
    const [linkedEvent, setLinkedEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [actionMessage, setActionMessage] = useState("");

    useEffect(() => {
        if (!bookingId) {
            setError("Venue booking checkout details are incomplete.");
            setLoading(false);
            return;
        }
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const [bookingResponse, venueResponse] = await Promise.all([
                    venueVendorApi.listBookings({ upcomingOnly: true, limit: 200 }),
                    venueVendorApi.listVenues({ limit: 200 })
                ]);
                const matchedBooking = (bookingResponse.items || []).find((item) => item.bookingId === bookingId) || null;
                if (!matchedBooking) {
                    setError("That venue booking is unavailable or no longer pending.");
                    setLoading(false);
                    return;
                }
                setBooking(matchedBooking);
                setVenue((venueResponse.items || []).find((item) => item.venueId === matchedBooking.venueId) || null);
                try {
                    const eventDetail = await eventApi.getEvent(matchedBooking.eventId);
                    setLinkedEvent(eventDetail?.event || null);
                }
                catch {
                    setLinkedEvent(null);
                }
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load venue checkout details.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [bookingId]);

    const paymentPending = booking ? booking.paymentStatus !== "PAID" && Number(booking.paymentAmount) > 0 : false;
    const hallNames = booking && venue
        ? booking.hallIds.length > 0
            ? booking.hallIds.map((hallId) => venue.halls.find((hall) => hall.hallId === hallId)?.hallName || hallId)
            : ["Whole venue"]
        : [];

    const handlePayment = async () => {
        if (!booking || !session?.user?.email) {
            setError("Login again before completing the venue booking payment.");
            return;
        }
        setBusy(true);
        setError("");
        setActionMessage("");
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
                void navigate("/vendor/venues", {
                    replace: true,
                    state: {
                        actionMessage: `Venue payment ${payment.gatewayReference} succeeded.`
                    }
                });
                return;
            }
            const loaded = await loadRazorpayScript();
            if (!loaded || !window.Razorpay || !payment.gatewayOrderId || !payment.checkoutKeyId) {
                setError("Payment system unavailable right now. Your booking is still pending and can be paid later.");
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
                    void navigate("/vendor/venues", {
                        replace: true,
                        state: {
                            actionMessage: `Venue booking payment ${verified.gatewayPaymentId || verified.gatewayReference} succeeded.`,
                            invoicePaymentId: verified.id
                        }
                    });
                },
                modal: {
                    ondismiss: () => {
                        setActionMessage("Venue booking payment is still pending. You can complete it later from the bookings list.");
                    }
                }
            });
            razorpay.open();
            setActionMessage("Complete the Razorpay step to confirm this venue booking.");
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Venue payment could not be started.");
        }
        finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <section className="p-8 text-sm text-slate-500">Loading venue checkout...</section>;
    }

    if (error || !booking) {
        return (
            <section className="p-8">
                <p className="text-sm text-red-600">{error || "Venue checkout is unavailable."}</p>
                <Link to="/vendor/venues" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1132d4]">
                    <ArrowLeft className="size-4" />
                    Back to venue bookings
                </Link>
            </section>
        );
    }

    return (
        <section className="min-h-screen bg-[#f3f5f9] px-4 py-8 text-slate-900 dark:bg-[#09132a] dark:text-slate-100 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <button
                    type="button"
                    onClick={() => void navigate("/vendor/venues")}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#1132d4]"
                >
                    <ArrowLeft className="size-4" />
                    Back to venue bookings
                </button>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1132d4]">Venue Checkout</p>
                        <h1 className="mt-3 text-3xl font-black">{linkedEvent?.title || "Venue booking"}</h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            Review the booking summary below before continuing to payment.
                        </p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <Building2 className="size-4" />
                                    Venue
                                </p>
                                <p className="mt-2 text-base font-bold">{venue?.venueName || booking.venueId}</p>
                                <p className="text-sm text-slate-500">{venue?.city || "City unavailable"}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <FileText className="size-4" />
                                    Booking Id
                                </p>
                                <p className="mt-2 break-all text-sm font-semibold">{booking.bookingId}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <CalendarClock className="size-4" />
                                    Schedule
                                </p>
                                <p className="mt-2 text-sm font-semibold">
                                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.bookingStart))}
                                </p>
                                <p className="text-sm text-slate-500">
                                    to {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.bookingEnd))}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <MapPin className="size-4" />
                                    Booking Scope
                                </p>
                                <p className="mt-2 text-sm font-semibold">{hallNames.join(", ")}</p>
                            </div>
                        </div>

                        {actionMessage ? (
                            <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-white/10 dark:text-slate-200">
                                {actionMessage}
                            </p>
                        ) : null}

                        {error ? (
                            <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                                {error}
                            </p>
                        ) : null}

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => void handlePayment()}
                                disabled={!paymentPending || busy}
                                className="inline-flex items-center justify-center rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {busy ? "Preparing payment..." : paymentPending ? "Proceed to Pay" : "Payment not required"}
                            </button>
                            <Link
                                to="/vendor/venues"
                                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200"
                            >
                                Back to bookings
                            </Link>
                            {booking.paymentId ? (
                                <button
                                    type="button"
                                    onClick={() => void financeApi.downloadInvoice(booking.paymentId, `venue-booking-${booking.bookingId}.pdf`)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-slate-200"
                                >
                                    Download invoice
                                </button>
                            ) : null}
                        </div>
                    </article>

                    <aside className="space-y-4 rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                                <CreditCard className="size-4" />
                                Amount due
                            </p>
                            <p className="mt-2 text-3xl font-black">{formatCurrency(booking.paymentAmount, booking.paymentCurrency || "INR")}</p>
                            <p className={`mt-2 text-sm font-semibold ${paymentPending ? "text-amber-600" : "text-emerald-600"}`}>
                                {paymentPending ? "Payment pending" : "Paid / no payment due"}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                            <p className="text-sm font-semibold text-slate-500">Event status</p>
                            <p className="mt-2 text-base font-bold">{linkedEvent ? getEventStatusLabel(linkedEvent.status) : "Unavailable"}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                            <p className="inline-flex items-center gap-2 font-semibold text-slate-500">
                                <ShieldCheck className="size-4" />
                                Payment step
                            </p>
                            <p className="mt-2">
                                This page is only for settling a reserved venue booking. The booking already exists; payment confirms it.
                            </p>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                If you leave now, the booking stays pending and you can complete payment later from the venue bookings page.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </section>
    );
}
