import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Clock, X } from "lucide-react";
import { useAuthSession } from "../lib/auth-storage";
import { ApiClientError } from "../lib/http-client";
import { ticketingApi } from "../lib/ticketing-api";
import { useSeatHub } from "../lib/useSeatHub";

const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
};

// Tier colour palettes: each tier gets a hue used for available seats in that section
const TIER_PALETTES = [
    // index 0 = most expensive / front section
    { bg: "bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-500/15 dark:border-purple-500/50 dark:text-purple-300", hover: "hover:bg-purple-200 dark:hover:bg-purple-500/30", label: "bg-purple-600", sectionBorder: "border-purple-300 dark:border-purple-500/30", sectionBg: "bg-purple-50 dark:bg-purple-500/5" },
    // index 1 = second tier
    { bg: "bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/50 dark:text-blue-300", hover: "hover:bg-blue-200 dark:hover:bg-blue-500/30", label: "bg-blue-600", sectionBorder: "border-blue-300 dark:border-blue-500/30", sectionBg: "bg-blue-50 dark:bg-blue-500/5" },
    // index 2
    { bg: "bg-teal-100 border-teal-400 text-teal-700 dark:bg-teal-500/15 dark:border-teal-500/50 dark:text-teal-300", hover: "hover:bg-teal-200 dark:hover:bg-teal-500/30", label: "bg-teal-600", sectionBorder: "border-teal-300 dark:border-teal-500/30", sectionBg: "bg-teal-50 dark:bg-teal-500/5" },
    // fallback for index 3+
    { bg: "bg-slate-100 border-slate-400 text-slate-600 dark:bg-slate-500/15 dark:border-slate-500/50 dark:text-slate-300", hover: "hover:bg-slate-200 dark:hover:bg-slate-500/30", label: "bg-slate-600", sectionBorder: "border-slate-300 dark:border-slate-500/30", sectionBg: "bg-slate-50 dark:bg-slate-500/5" },
];

const formatCurrency = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

/**
 * Build section->row mapping for all ticket types.
 * Sorts tiers by price descending (most expensive = front rows).
 * Returns an array of section objects, each with startRow/endRow indices (0-based),
 * paletteIndex, tier name, price, and whether it's the current ticket type.
 */
function buildSections(allTicketTypes, currentTicketTypeId) {
    if (!allTicketTypes || allTicketTypes.length === 0) return [];
    const sorted = [...allTicketTypes].sort((a, b) => b.price - a.price);
    let rowCursor = 0;
    return sorted.map((tt, idx) => {
        const seatsPerRow = Math.min(20, Math.max(10, Math.ceil(Math.sqrt(tt.totalQuantity))));
        const rowCount = Math.ceil(tt.totalQuantity / seatsPerRow);
        const section = {
            ticketTypeId: tt.ticketTypeId,
            name: tt.ticketName,
            price: tt.price,
            tierCode: tt.tierCode,
            startRow: rowCursor,
            endRow: rowCursor + rowCount - 1,
            rowCount,
            seatsPerRow,
            totalQuantity: tt.totalQuantity,
            isCurrent: tt.ticketTypeId === currentTicketTypeId,
            paletteIndex: Math.min(idx, TIER_PALETTES.length - 1),
        };
        rowCursor += rowCount;
        return section;
    });
}

export function SeatSelection() {
    const { id, ticketTypeId } = useParams();
    const navigate = useNavigate();
    const session = useAuthSession();

    const [seatMap, setSeatMap] = useState(null);
    const [allTicketTypes, setAllTicketTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedSeat, setSelectedSeat] = useState(null); // { row, column, label }
    const [reservation, setReservation] = useState(null);
    const [reserving, setReserving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    // Optimistic overrides: immediately reflect own actions on the grid before server confirms
    const [optimisticOverrides, setOptimisticOverrides] = useState({});

    const fetchSeatMap = useCallback(async () => {
        if (!id || !ticketTypeId) return;
        const data = await ticketingApi.getSeatMap(ticketTypeId, id);
        setSeatMap(data);
        // Real server data arrived — clear any pending optimistic patches
        setOptimisticOverrides({});
    }, [id, ticketTypeId]);

    // Apply a single-seat delta pushed by the SignalR hub so only the changed
    // seat needs updating without a full round-trip.
    const handleHubSeatUpdate = useCallback((row, column, status) => {
        setSeatMap((prev) => {
            if (!prev) return prev;
            const upperStatus = status.toUpperCase();
            const updatedRows = prev.rows.map((rowData) => {
                if (rowData.row !== row) return rowData;
                const updatedSeats = rowData.seats.map((seat) =>
                    seat.column === column ? { ...seat, status: upperStatus } : seat
                );
                return { ...rowData, seats: updatedSeats };
            });
            // Recalculate summary counts
            let available = 0, reserved = 0, booked = 0;
            for (const r of updatedRows) {
                for (const s of r.seats) {
                    if (s.status === "AVAILABLE") available++;
                    else if (s.status === "RESERVED") reserved++;
                    else if (s.status === "BOOKED") booked++;
                }
            }
            return {
                ...prev,
                rows: updatedRows,
                availableCount: available,
                reservedCount: reserved,
                bookedCount: booked,
            };
        });
        // Do NOT touch optimisticOverrides here. The seatMap patch above is the
        // source of truth for remote updates; mixing it with optimisticOverrides
        // caused the own-user's post-reserve fetchSeatMap clear to race against
        // hub messages from other clients.
    }, []);

    // Real-time seat updates via SignalR hub — replaces the 3-second polling loop
    const { isConnected: hubConnected } = useSeatHub(id, ticketTypeId, handleHubSeatUpdate);

    // Sparse fallback poll (15 s) only while the hub is not connected.
    // Ensures the map catches up after a missed message or delayed hub start.
    useEffect(() => {
        if (loading || hubConnected) return;
        const interval = setInterval(() => void fetchSeatMap().catch(() => {}), 15_000);
        return () => clearInterval(interval);
    }, [loading, hubConnected, fetchSeatMap]);

    // Build a lookup: "ROW-COL" => status; optimistic overrides applied on top for instant UI feedback
    const seatStatusMap = useMemo(() => {
        const map = {};
        if (seatMap) {
            for (const rowData of seatMap.rows) {
                for (const seat of rowData.seats) {
                    map[`${seat.row}-${seat.column}`] = seat.status;
                }
            }
        }
        return { ...map, ...optimisticOverrides };
    }, [seatMap, optimisticOverrides]);

    const sections = useMemo(() => buildSections(allTicketTypes, ticketTypeId), [allTicketTypes, ticketTypeId]);
    const currentSection = useMemo(() => sections.find(s => s.isCurrent), [sections]);

    // Initial load
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const [mapData, ttList] = await Promise.all([
                    ticketingApi.getSeatMap(ticketTypeId, id),
                    ticketingApi.listTicketTypes(id),
                ]);
                if (!cancelled) {
                    setSeatMap(mapData);
                    setAllTicketTypes(ttList);
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Unable to load seat map.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [id, ticketTypeId]);

    // Countdown timer
    useEffect(() => {
        if (!reservation) return;
        const tick = () => {
            const expiry = new Date(reservation.expiresAt).getTime();
            const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining === 0) {
                setReservation(null);
                setSelectedSeat(null);
                void fetchSeatMap().catch(() => {});
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [reservation, fetchSeatMap]);

    const handleCancelReservation = async () => {
        if (!reservation || cancelling) return;
        setCancelling(true);
        setError("");
        // Optimistically free the seat immediately
        if (selectedSeat) {
            setOptimisticOverrides(prev => ({ ...prev, [`${selectedSeat.row}-${selectedSeat.column}`]: "AVAILABLE" }));
        }
        setReservation(null);
        setSelectedSeat(null);
        try {
            await ticketingApi.cancelReservation(ticketTypeId, reservation.reservationId);
        } catch {
            // Best-effort -- even if the server call fails, clear local state
        } finally {
            setCancelling(false);
            void fetchSeatMap().catch(() => {});
        }
    };

    const handleSeatClick = async (seatRow, seatColumn, label) => {
        if (reserving) return;
        if (!session) { setError("Please sign in to select a seat."); return; }
        setReserving(true);
        setError("");
        // Optimistically mark the new seat as reserved and free the previous one immediately
        setOptimisticOverrides(prev => {
            const next = { ...prev, [`${seatRow}-${seatColumn}`]: "RESERVED" };
            if (selectedSeat && !(selectedSeat.row === seatRow && selectedSeat.column === seatColumn)) {
                next[`${selectedSeat.row}-${selectedSeat.column}`] = "AVAILABLE";
            }
            return next;
        });
        try {
            const res = await ticketingApi.reserveSeat(ticketTypeId, id, seatRow, seatColumn);
            setSelectedSeat({ row: seatRow, column: seatColumn, label });
            setReservation(res);
            void fetchSeatMap().catch(() => {});
        } catch (err) {
            // Revert optimistic update on failure
            setOptimisticOverrides(prev => {
                const next = { ...prev };
                delete next[`${seatRow}-${seatColumn}`];
                return next;
            });
            setError(err instanceof ApiClientError ? err.message : "Unable to reserve seat \u2014 it may have just been taken.");
        } finally {
            setReserving(false);
        }
    };

    // Auto-cancel the reservation when leaving the page (back button, nav away, unmount).
    // Uses a ref so the cleanup always sees the latest reservation without being a dep.
    const reservationRef = useRef(null);
    reservationRef.current = reservation;
    const ticketTypeIdRef = useRef(ticketTypeId);
    ticketTypeIdRef.current = ticketTypeId;

    useEffect(() => {
        return () => {
            const active = reservationRef.current;
            if (active) {
                // Fire-and-forget — best effort, page is leaving
                ticketingApi.cancelReservation(ticketTypeIdRef.current, active.reservationId).catch(() => {});
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // empty deps: run cleanup only on unmount

    const handleBack = async () => {
        if (reservation) {
            await ticketingApi.cancelReservation(ticketTypeId, reservation.reservationId).catch(() => {});
        }
        void navigate(`/events/${id}`);
    };

    const handleContinue = () => {
        if (!reservation || !selectedSeat || timeLeft === 0) return;
        // Clear the ref so unmount cleanup doesn't cancel a reservation we intentionally kept
        reservationRef.current = null;
        void navigate(
            `/events/${id}/checkout/${ticketTypeId}` +
            `?seatRow=${encodeURIComponent(selectedSeat.row)}` +
            `&seatCol=${encodeURIComponent(String(selectedSeat.column))}` +
            `&reservationId=${encodeURIComponent(reservation.reservationId)}`
        );
    };

    if (loading) {
        return (
            <section className="min-h-screen p-8 text-sm text-slate-500 flex items-center justify-center">
                Loading seat map...
            </section>
        );
    }

    if (!seatMap && error) {
        return (
            <section className="min-h-screen p-8">
                <p className="text-sm text-red-600">{error}</p>
                {id && (
                    <button onClick={handleBack} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1132d4]">
                        <ArrowLeft className="size-4" />Back to event
                    </button>
                )}
            </section>
        );
    }

    return (
        <section className="min-h-screen bg-[#f3f5f9] px-4 py-8 text-slate-900 dark:bg-[#09132a] dark:text-slate-100 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1132d4]">
                    <ArrowLeft className="size-4" />Back to event
                </button>

                {/* Header */}
                <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1132d4]">Select your seat</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                hubConnected
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400"
                                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400"
                            }`}>
                            <span className="relative flex size-1.5">
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                                    hubConnected ? "bg-emerald-400" : "bg-amber-400"
                                }`} />
                                <span className={`relative inline-flex size-1.5 rounded-full ${
                                    hubConnected ? "bg-emerald-500" : "bg-amber-500"
                                }`} />
                            </span>
                            {hubConnected ? "Live" : "Syncing..."}
                        </span>
                    </div>
                    <h1 className="mt-2 text-2xl font-black">{seatMap?.ticketTypeName}</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {seatMap?.availableCount} available &nbsp;&middot;&nbsp; {seatMap?.reservedCount} reserved &nbsp;&middot;&nbsp; {seatMap?.bookedCount} booked
                    </p>

                    {/* Section legend */}
                    {sections.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-3">
                            {sections.map((s) => {
                                const pal = TIER_PALETTES[s.paletteIndex];
                                return (
                                    <div key={s.ticketTypeId} className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${pal.sectionBorder} ${pal.sectionBg} ${s.isCurrent ? "ring-2 ring-offset-1 ring-[#1132d4]" : ""}`}>
                                        <span className={`inline-block size-3 rounded-sm ${pal.label}`} />
                                        <span className="text-slate-700 dark:text-slate-200">{s.name}</span>
                                        <span className="text-slate-400">&middot;</span>
                                        <span className="text-slate-500 dark:text-slate-400">{formatCurrency(s.price)}</span>
                                        {s.isCurrent && <span className="ml-1 rounded-full bg-[#1132d4] px-1.5 py-0.5 text-[10px] text-white">YOUR TIER</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Seat status legend */}
                    <div className="mt-4 flex flex-wrap gap-5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block size-4 rounded bg-amber-100 border border-amber-300 dark:bg-amber-500/15" />
                            Reserved (10 min)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block size-4 rounded bg-slate-200 border border-slate-300 dark:bg-slate-700 dark:border-slate-600" />
                            Booked
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block size-4 rounded bg-emerald-400 border border-emerald-500" />
                            Your selection
                        </span>
                    </div>
                </div>

                {/* Hall grid */}
                <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172e] overflow-x-auto">
                    <div className="w-fit mx-auto">
                    {/* Stage */}
                    <div className="mb-8 mx-auto max-w-sm rounded-2xl bg-gradient-to-r from-[#1132d4]/20 via-[#4f7cff]/15 to-[#1132d4]/20 border border-[#1132d4]/20 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-[#1132d4]">
                        {"\u2605"} &nbsp;Stage / Screen&nbsp; {"\u2605"}
                    </div>

                    {/* Render each section with a label band */}
                    <div className="space-y-1">
                        {sections.map((section) => {
                            const pal = TIER_PALETTES[section.paletteIndex];
                            // rows in this section
                            const rowLabels = Array.from({ length: section.rowCount }, (_, i) =>
                                i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`
                            );

                            return (
                                <div key={section.ticketTypeId} className="mb-4">
                                    {/* Section header band */}
                                    <div className={`flex items-center gap-3 mb-2 px-3 py-1.5 rounded-xl border ${pal.sectionBorder} ${pal.sectionBg}`}>
                                        <span className={`inline-block size-2.5 rounded-sm flex-shrink-0 ${pal.label}`} />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">{section.name}</span>
                                        <span className="text-xs text-slate-400">{formatCurrency(section.price)}</span>
                                        {!section.isCurrent && (
                                            <span className="ml-auto text-[10px] text-slate-400 italic">not your tier</span>
                                        )}
                                    </div>

                                    {/* Rows */}
                                    <div className="flex flex-col items-center space-y-1.5">
                                        {rowLabels.map((rowLabel, localRowIdx) => {
                                            const seatsInThisRow =
                                                localRowIdx === section.rowCount - 1
                                                    ? section.totalQuantity - section.seatsPerRow * (section.rowCount - 1)
                                                    : section.seatsPerRow;

                                            return (
                                                <div key={rowLabel} className="flex items-center gap-2">
                                                    <span className="w-7 flex-shrink-0 text-center text-xs font-bold text-slate-400">{rowLabel}</span>
                                                    <div className="flex gap-1">
                                                        {Array.from({ length: seatsInThisRow }, (_, colIdx) => {
                                                            const col = colIdx + 1;
                                                            const key = `${rowLabel}-${col}`;
                                                            const isMySelected = selectedSeat?.row === rowLabel && selectedSeat?.column === col;
                                                            const status = section.isCurrent ? (seatStatusMap[key] ?? "AVAILABLE") : null;
                                                            // Seats not in current tier are non-interactive, shown in tier colour
                                                            if (!section.isCurrent) {
                                                                return (
                                                                    <div key={key} title={`${section.name} \u2014 not your tier`}
                                                                        className={`size-7 rounded-md border text-[9px] flex items-center justify-center opacity-40 cursor-not-allowed ${pal.bg}`}>
                                                                        {col}
                                                                    </div>
                                                                );
                                                            }

                                                            let cls = "size-7 rounded-md text-[9px] font-bold flex items-center justify-center border transition-all select-none ";
                                                            if (isMySelected) {
                                                                cls += "bg-emerald-400 border-2 border-emerald-600 text-white scale-110 shadow-md cursor-default";
                                                            } else if (status === "AVAILABLE") {
                                                                cls += `${pal.bg} ${pal.hover} cursor-pointer hover:scale-105 active:scale-95`;
                                                            } else if (status === "RESERVED") {
                                                                cls += "bg-amber-50 border-amber-300 text-amber-400 cursor-not-allowed dark:bg-amber-500/10";
                                                            } else {
                                                                cls += "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500";
                                                            }

                                                            return (
                                                                <button key={key} type="button"
                                                                    title={`Seat ${rowLabel}${col} \u00B7 ${status}`}
                                                                    disabled={status !== "AVAILABLE" || reserving}
                                                                    onClick={() => void handleSeatClick(rowLabel, col, `${rowLabel}${col}`)}
                                                                    className={cls}
                                                                    aria-label={`Seat ${rowLabel}${col}, ${status?.toLowerCase()}`}>
                                                                    {col}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <span className="w-7 flex-shrink-0 text-center text-xs font-bold text-slate-400">{rowLabel}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    </div>
                </div>

                {/* Reservation banner */}
                {reservation && selectedSeat ? (
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-500/25 dark:bg-emerald-500/8">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                                    Seat held for you
                                </p>
                                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                                    Seat {selectedSeat.label}
                                </p>
                                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                    <Clock className="size-4" />
                                    {timeLeft > 0
                                        ? `Expires in ${formatTime(timeLeft)}`
                                        : "Reservation expired \u2014 please pick another seat"}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button type="button" onClick={() => void handleCancelReservation()} disabled={cancelling}
                                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors dark:border-red-500/30 dark:bg-transparent dark:hover:bg-red-500/10">
                                    <X className="size-4" />
                                    {cancelling ? "Cancelling\u2026" : "Cancel seat"}
                                </button>
                                <button type="button" onClick={handleContinue} disabled={timeLeft === 0}
                                    className="rounded-xl bg-[#1132d4] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d27b0] disabled:opacity-50 transition-colors">
                                    Continue to Checkout {"\u2192"}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                        Click an available seat in your tier to hold it for 10 minutes.
                    </p>
                )}

                {error && (
                    <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                        {error}
                    </p>
                )}
            </div>
        </section>
    );
}
