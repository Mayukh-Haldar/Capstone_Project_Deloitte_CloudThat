import * as React from "react";
import { createPortal } from "react-dom";
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    parse,
    startOfMonth,
    startOfWeek
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { cn } from "./utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TWELVE_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];
const PERIOD_OPTIONS = ["AM", "PM"];
const OPEN_EVENT_NAME = "eventzen-date-time-scheduler-open";

const findScrollableAncestors = (element) => {
    const ancestors = [];
    let current = element?.parentElement ?? null;
    while (current) {
        const styles = window.getComputedStyle(current);
        const overflowY = styles.overflowY;
        const overflowX = styles.overflowX;
        const canScrollY = /(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight;
        const canScrollX = /(auto|scroll|overlay)/.test(overflowX) && current.scrollWidth > current.clientWidth;
        if (canScrollY || canScrollX) {
            ancestors.push(current);
        }
        current = current.parentElement;
    }
    return ancestors;
};

const smoothScrollSchedulerIntoView = (element) => {
    if (!element) {
        return;
    }
    const elementRect = element.getBoundingClientRect();
    const viewportTarget = window.scrollY + elementRect.top - Math.max(96, (window.innerHeight - elementRect.height) / 2);
    window.scrollTo({
        top: Math.max(0, viewportTarget),
        behavior: "smooth"
    });

    const ancestors = findScrollableAncestors(element);
    ancestors.forEach((ancestor) => {
        const ancestorRect = ancestor.getBoundingClientRect();
        const offsetWithinAncestor = elementRect.top - ancestorRect.top + ancestor.scrollTop;
        const targetTop = offsetWithinAncestor - Math.max(32, (ancestor.clientHeight - elementRect.height) / 2);
        ancestor.scrollTo({
            top: Math.max(0, targetTop),
            behavior: "smooth"
        });
    });
};

const createTimeSlots = (slotMinutes, startHour, endHour) => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour += 1) {
        for (let minute = 0; minute < 60; minute += slotMinutes) {
            if (hour === endHour && minute > 0) {
                break;
            }
            const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
            slots.push({
                value,
                label: format(parse(value, "HH:mm", new Date()), "hh:mm a")
            });
        }
    }
    return slots;
};

const parseLocalDateTime = (value) => {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatLocalDateTimeValue = (date, time) => {
    if (!date || !time) {
        return "";
    }
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, "0");
    const day = String(next.getDate()).padStart(2, "0");
    const hour = String(next.getHours()).padStart(2, "0");
    const minute = String(next.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
};

const extractTime = (value) => {
    const parsed = parseLocalDateTime(value);
    if (!parsed) {
        return "";
    }
    return format(parsed, "HH:mm");
};

const parseTimeParts = (time) => {
    if (!time) {
        return { hour12: "", minute: "", period: "AM" };
    }
    const [rawHour, rawMinute] = time.split(":").map(Number);
    if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) {
        return { hour12: "", minute: "", period: "AM" };
    }
    const period = rawHour >= 12 ? "PM" : "AM";
    const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
    return {
        hour12: String(hour12).padStart(2, "0"),
        minute: String(rawMinute).padStart(2, "0"),
        period
    };
};

const buildTimeFromParts = (hour12, minute, period) => {
    if (!hour12 || !minute || !period) {
        return "";
    }
    const parsedHour = Number(hour12);
    const parsedMinute = Number(minute);
    if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
        return "";
    }
    const normalizedHour = parsedHour % 12 + (period === "PM" ? 12 : 0);
    return `${String(normalizedHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`;
};

function DateTimeScheduler({
    value,
    onChange,
    placeholder = "Choose date and time",
    className,
    slotMinutes = 30,
    startHour = 6,
    endHour = 22,
    required = false,
    disabled = false
}) {
    const schedulerId = React.useMemo(() => {
        if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }
        return `scheduler-${Math.random().toString(36).slice(2, 10)}`;
    }, []);
    const parsedValue = React.useMemo(() => parseLocalDateTime(value), [value]);
    const [open, setOpen] = React.useState(false);
    const [visibleMonth, setVisibleMonth] = React.useState(parsedValue ?? new Date());
    const [draftDate, setDraftDate] = React.useState(parsedValue ?? undefined);
    const [draftTime, setDraftTime] = React.useState(extractTime(value));
    const [customTimeParts, setCustomTimeParts] = React.useState(() => parseTimeParts(extractTime(value)));
    const rootRef = React.useRef(null);
    const panelRef = React.useRef(null);
    const closeButtonRef = React.useRef(null);
    const selectedDateButtonRef = React.useRef(null);
    const [panelStyle, setPanelStyle] = React.useState(null);

    React.useEffect(() => {
        const nextParsed = parseLocalDateTime(value);
        const nextDraftTime = extractTime(value);
        setDraftDate(nextParsed ?? undefined);
        setDraftTime(nextDraftTime);
        setCustomTimeParts(parseTimeParts(nextDraftTime));
        if (nextParsed) {
            setVisibleMonth(nextParsed);
        }
    }, [value]);

    React.useEffect(() => {
        if (!open) {
            return undefined;
        }
        const syncPanelPosition = () => {
            if (!rootRef.current) {
                return;
            }
            const rootRect = rootRef.current.getBoundingClientRect();
            const viewportPadding = 16;
            const maxWidth = Math.min(window.innerWidth - viewportPadding * 2, 704);
            const minWidth = Math.min(window.innerWidth - viewportPadding * 2, 320);
            const width = Math.max(minWidth, Math.min(maxWidth, rootRect.width > 560 ? rootRect.width : 704));
            const left = Math.min(
                Math.max(viewportPadding, rootRect.left),
                Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
            );
            const top = Math.min(rootRect.bottom + 12, window.innerHeight - viewportPadding - 320);
            const maxHeight = Math.max(360, window.innerHeight - Math.max(viewportPadding, top) - viewportPadding);
            setPanelStyle({
                position: "fixed",
                top: Math.max(viewportPadding, top),
                left,
                width: `min(calc(100vw - ${viewportPadding * 2}px), ${width}px)`,
                maxHeight: `${maxHeight}px`,
                height: `${maxHeight}px`
            });
        };
        const frame = window.requestAnimationFrame(syncPanelPosition);
        window.addEventListener("resize", syncPanelPosition);
        window.addEventListener("scroll", syncPanelPosition, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", syncPanelPosition);
            window.removeEventListener("scroll", syncPanelPosition, true);
        };
    }, [open]);

    React.useEffect(() => {
        if (!open) {
            return undefined;
        }
        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            smoothScrollSchedulerIntoView(rootRef.current);
            secondFrame = window.requestAnimationFrame(() => {
                selectedDateButtonRef.current?.focus({ preventScroll: true });
            });
        });
        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame) {
                window.cancelAnimationFrame(secondFrame);
            }
        };
    }, [open]);

    React.useEffect(() => {
        const handleSchedulerOpen = (event) => {
            if (event.detail?.schedulerId !== schedulerId) {
                setOpen(false);
            }
        };
        window.addEventListener(OPEN_EVENT_NAME, handleSchedulerOpen);
        return () => window.removeEventListener(OPEN_EVENT_NAME, handleSchedulerOpen);
    }, [schedulerId]);

    const days = React.useMemo(() => eachDayOfInterval({
        start: startOfWeek(startOfMonth(visibleMonth)),
        end: endOfWeek(endOfMonth(visibleMonth))
    }), [visibleMonth]);

    const timeSlots = React.useMemo(() => createTimeSlots(slotMinutes, startHour, endHour), [endHour, slotMinutes, startHour]);
    const displayValue = parsedValue ? format(parsedValue, "EEE, MMM d, yyyy 'at' hh:mm a") : "";
    const activeTime = draftTime || (draftDate ? format(draftDate, "HH:mm") : "");

const updateCustomTimePart = (field, fieldValue) => {
        setCustomTimeParts((current) => {
            const next = { ...current, [field]: fieldValue };
            const nextTime = buildTimeFromParts(next.hour12, next.minute, next.period);
            setDraftTime(nextTime);
            return next;
        });
    };

    const handleMinuteInputChange = (rawValue) => {
        const digitsOnly = rawValue.replace(/\D/g, "").slice(0, 2);
        if (!digitsOnly) {
            updateCustomTimePart("minute", "");
            return;
        }
        updateCustomTimePart("minute", digitsOnly);
    };

    const handleMinuteInputBlur = () => {
        if (!customTimeParts.minute) {
            return;
        }
        const parsedMinute = Number(customTimeParts.minute);
        if (!Number.isFinite(parsedMinute)) {
            updateCustomTimePart("minute", "");
            return;
        }
        const boundedMinute = Math.min(59, Math.max(0, parsedMinute));
        updateCustomTimePart("minute", String(boundedMinute).padStart(2, "0"));
    };

    const handleApply = () => {
        onChange(formatLocalDateTimeValue(draftDate, draftTime));
        setOpen(false);
    };

    const handleReset = () => {
        setDraftDate(undefined);
        setDraftTime("");
        setCustomTimeParts({ hour12: "", minute: "", period: "AM" });
        onChange("");
        setOpen(false);
    };

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                type="button"
                disabled={disabled}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                    setOpen((current) => {
                        const next = !current;
                        if (next) {
                            window.dispatchEvent(new CustomEvent(OPEN_EVENT_NAME, {
                                detail: { schedulerId }
                            }));
                        }
                        return next;
                    });
                }}
                className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm transition hover:border-[#1132d4]/40 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#0f172e] dark:hover:bg-white/5",
                    open && "border-[#1132d4] ring-4 ring-[#1132d4]/10"
                )}
                aria-expanded={open}
                aria-required={required}
            >
                <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#1132d4]">Schedule</span>
                    <span className={cn("mt-1 block truncate text-sm", displayValue ? "text-slate-900 dark:text-slate-100" : "text-slate-400")}>
                        {displayValue || placeholder}
                    </span>
                </span>
                <CalendarDays className="size-5 shrink-0 text-[#1132d4]"/>
            </button>

            {open && typeof document !== "undefined" ? createPortal(
                <>
                    <div
                        className="fixed inset-0 z-20 bg-slate-950/10 backdrop-blur-[2px] dark:bg-black/25"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                    />
                    <div
                        ref={panelRef}
                        className="z-30 min-w-[20rem] max-w-[44rem] overflow-hidden"
                        style={panelStyle ?? undefined}
                        tabIndex={-1}
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                    >
                    <Card className="flex h-full max-h-full flex-col overflow-hidden border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111a33]">
                        <CardHeader className="shrink-0 pb-4">
                            <CardTitle className="text-base font-semibold">Pick date and time</CardTitle>
                        </CardHeader>
                        <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                          <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <Button type="button" variant="outline" size="icon" onClick={() => setVisibleMonth((current) => addMonths(current, -1))}>
                                        <ChevronLeft className="size-4"/>
                                    </Button>
                                    <p className="text-center text-base font-semibold leading-tight">{format(visibleMonth, "MMMM yyyy")}</p>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setVisibleMonth((current) => addMonths(current, 1))}>
                                        <ChevronRight className="size-4"/>
                                    </Button>
                                </div>

                                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    {WEEKDAY_LABELS.map((label) => (
                                        <span key={label} className="py-2">{label}</span>
                                    ))}
                                </div>

                                <div className="mt-1 grid grid-cols-7 gap-1.5">
                                    {days.map((day) => {
                                        const selected = draftDate ? isSameDay(day, draftDate) : false;
                                        return (
                                            <button
                                                key={day.toISOString()}
                                                ref={selected ? selectedDateButtonRef : null}
                                                type="button"
                                                onClick={() => setDraftDate(day)}
                                                className={cn(
                                                    "flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm font-semibold transition",
                                                    isSameMonth(day, visibleMonth)
                                                        ? "text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
                                                        : "text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-white/5",
                                                    isToday(day) && !selected && "border border-[#1132d4]/30 text-[#1132d4]",
                                                    selected && "bg-[#1132d4] text-white shadow-lg shadow-blue-700/25 hover:bg-[#1132d4]"
                                                )}
                                            >
                                                {format(day, "d")}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                    <Clock3 className="size-4 text-[#1132d4]"/>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Pick a time</p>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    Flexible slots every {slotMinutes} minutes. You can also type an exact time.
                                </p>

                                <label className="mt-4 block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Custom time</span>
                                    <div className="grid grid-cols-[1fr_1fr_0.9fr] gap-2">
                                        <select
                                            value={customTimeParts.hour12}
                                            onChange={(event) => updateCustomTimePart("hour12", event.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-white/15 dark:bg-[#0f172e] dark:text-slate-100"
                                        >
                                            <option value="">Hour</option>
                                            {TWELVE_HOUR_OPTIONS.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={customTimeParts.minute}
                                            onChange={(event) => handleMinuteInputChange(event.target.value)}
                                            onBlur={handleMinuteInputBlur}
                                            placeholder="Min"
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-white/15 dark:bg-[#0f172e] dark:text-slate-100"
                                        />
                                        <select
                                            value={customTimeParts.period}
                                            onChange={(event) => updateCustomTimePart("period", event.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-white/15 dark:bg-[#0f172e] dark:text-slate-100"
                                        >
                                            {PERIOD_OPTIONS.map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </div>
                                </label>

                                <div className="mt-4 max-h-[280px] overflow-y-auto pr-1">
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                                        {timeSlots.map((slot) => (
                                            <Button
                                                key={slot.value}
                                                type="button"
                                                variant={activeTime === slot.value ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-10 justify-center text-sm", activeTime === slot.value && "ring-2 ring-[#1132d4]/30")}
                                                onClick={() => setDraftTime(slot.value)}
                                            >
                                                {slot.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="sticky bottom-0 z-10 shrink-0 justify-between gap-3 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#111a33]/95">
                                <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                                    Reset
                                </Button>
                            <div className="flex items-center gap-2">
                                <Button ref={closeButtonRef} type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                                    Close
                                </Button>
                                <Button type="button" size="sm" onClick={handleApply} disabled={!draftDate || !draftTime}>
                                    Apply
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                    </div>
                </>,
                document.body
            ) : null}
        </div>
    );
}

export { DateTimeScheduler, formatLocalDateTimeValue, parseLocalDateTime };
