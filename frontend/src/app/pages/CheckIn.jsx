import { BarChart3, CalendarDays, Camera, CameraOff, QrCode, RefreshCcw, Search, Settings, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useLocation } from "react-router";
import { eventApi, getEventStatusLabel } from "../lib/event-api";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
import { useAuthSession } from "../lib/auth-storage";
import { portalFromPath } from "../lib/roles";
const formatPercent = (value) => `${value ?? 0}%`;
const formatDateTime = (value) => new Date(value).toLocaleString();
export function CheckIn() {
    const location = useLocation();
    const session = useAuthSession();
    const portal = portalFromPath(location.pathname) || "ADMIN";
    const isAdminPortal = portal === "ADMIN";
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [stats, setStats] = useState(null);
    const [qrPayload, setQrPayload] = useState("");
    const [scanMessage, setScanMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [cameraSupported, setCameraSupported] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [cameraStatus, setCameraStatus] = useState("Camera idle.");
    const [consoleView, setConsoleView] = useState("scanner");
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const detectorRef = useRef(null);
    const scanFrameRef = useRef(null);
    const scanningLockRef = useRef(false);
    const canvasRef = useRef(null);
    useEffect(() => {
        setCameraSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    }, []);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const response = await eventApi.listEvents({
                    organizerId: isAdminPortal ? undefined : session?.user.id,
                    size: 20
                });
                setEvents(response.content);
                if (response.content[0]) {
                    setSelectedEventId((current) => current || response.content[0].id);
                }
            }
            catch (err) {
                setScanMessage(err instanceof ApiClientError ? err.message : "Unable to load events for check-in.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [isAdminPortal, session?.user.id]);
    useEffect(() => {
        if (!selectedEventId) {
            return;
        }
        const loadStats = async () => {
            try {
                setStats(await ticketingApi.getCheckInStats(selectedEventId));
            }
            catch (err) {
                setScanMessage(err instanceof ApiClientError ? err.message : "Unable to load check-in stats.");
            }
        };
        void loadStats();
    }, [selectedEventId]);
    useEffect(() => {
        return () => {
            if (scanFrameRef.current) {
                window.cancelAnimationFrame(scanFrameRef.current);
            }
            streamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, []);
    const scan = async () => {
        if (!qrPayload) {
            return;
        }
        setBusy(true);
        setScanMessage("");
        try {
            const registration = await ticketingApi.scanCheckIn({ qrPayload, gate: "MAIN" });
            setScanMessage(`Checked in ${registration.eventTitle} attendee with ticket ${registration.ticket.ticketNumber}.`);
            setQrPayload("");
            if (selectedEventId) {
                setStats(await ticketingApi.getCheckInStats(selectedEventId));
            }
        }
        catch (err) {
            setScanMessage(err instanceof ApiClientError ? err.message : "Check-in failed.");
        }
        finally {
            setBusy(false);
        }
    };
    const stopCamera = () => {
        if (scanFrameRef.current) {
            window.cancelAnimationFrame(scanFrameRef.current);
            scanFrameRef.current = null;
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        setCameraStatus("Camera stopped.");
        scanningLockRef.current = false;
    };
    const startCamera = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError("Camera scanning is not supported in this browser. Use the manual payload field instead.");
            return;
        }
        setCameraError("");
        setScanMessage("");
        setCameraStatus("Requesting camera access...");
        try {
            detectorRef.current ??= window.BarcodeDetector
                ? new window.BarcodeDetector({ formats: ["qr_code"] })
                : null;
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" }
                },
                audio: false
            });
            streamRef.current = stream;
            setCameraActive(true);
            setCameraStatus("Camera connected. Point the QR at the preview.");
            window.setTimeout(async () => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    try {
                        await videoRef.current.play();
                        setCameraStatus("Camera live. Ready to scan.");
                    }
                    catch (err) {
                        setCameraError(err instanceof Error ? err.message : "Unable to start the video preview.");
                    }
                }
            }, 0);
            const tick = async () => {
                if (!videoRef.current || scanningLockRef.current) {
                    scanFrameRef.current = window.requestAnimationFrame(() => void tick());
                    return;
                }
                try {
                    let qrValue = "";
                    if (detectorRef.current) {
                        const barcodes = await detectorRef.current.detect(videoRef.current);
                        qrValue = barcodes.find((item) => item.rawValue?.trim())?.rawValue?.trim() || "";
                    }
                    else if (canvasRef.current) {
                        const video = videoRef.current;
                        const canvas = canvasRef.current;
                        const width = video.videoWidth;
                        const height = video.videoHeight;
                        if (width > 0 && height > 0) {
                            canvas.width = width;
                            canvas.height = height;
                            const context = canvas.getContext("2d", { willReadFrequently: true });
                            if (context) {
                                context.drawImage(video, 0, 0, width, height);
                                const imageData = context.getImageData(0, 0, width, height);
                                const result = jsQR(imageData.data, width, height);
                                qrValue = result?.data?.trim() || "";
                            }
                        }
                    }
                    if (qrValue) {
                        scanningLockRef.current = true;
                        setQrPayload(qrValue);
                        setScanMessage("QR detected. Validating ticket...");
                        setCameraStatus("QR detected. Validating...");
                        try {
                            setBusy(true);
                            const registration = await ticketingApi.scanCheckIn({ qrPayload: qrValue, gate: "MAIN" });
                            setScanMessage(`Checked in ${registration.eventTitle} attendee with ticket ${registration.ticket.ticketNumber}.`);
                            setCameraStatus("Check-in successful. Ready for the next attendee.");
                            setQrPayload("");
                            if (selectedEventId) {
                                setStats(await ticketingApi.getCheckInStats(selectedEventId));
                            }
                        }
                        catch (err) {
                            setScanMessage(err instanceof ApiClientError ? err.message : "Check-in failed.");
                            setCameraStatus("Scan failed. Hold the QR steady and try again.");
                        }
                        finally {
                            setBusy(false);
                            window.setTimeout(() => {
                                scanningLockRef.current = false;
                            }, 1500);
                        }
                    }
                }
                catch (err) {
                    setCameraError(err instanceof Error ? err.message : "Unable to scan from camera.");
                }
                scanFrameRef.current = window.requestAnimationFrame(() => void tick());
            };
            scanFrameRef.current = window.requestAnimationFrame(() => void tick());
        }
        catch (err) {
            setCameraError(err instanceof Error ? err.message : "Unable to access the device camera.");
            stopCamera();
        }
    };
    const refreshStats = async () => {
        if (!selectedEventId) {
            return;
        }
        try {
            setStats(await ticketingApi.getCheckInStats(selectedEventId));
        }
        catch (err) {
            setScanMessage(err instanceof ApiClientError ? err.message : "Unable to refresh check-in stats.");
        }
    };
    const selectedEvent = events.find((eventItem) => eventItem.id === selectedEventId);
    const consoleViews = [
        { id: "scanner", label: "Scanner", icon: QrCode },
        { id: "guest-list", label: "Guest List", icon: Users },
        { id: "stats", label: "Stats", icon: BarChart3 },
        { id: "settings", label: "Settings", icon: Settings }
    ];
    return (<section className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
          <h1 className="eventzen-page-title mt-2">Check-In Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Scan attendee tickets, monitor entry progress, and keep event operations moving from one responsive control surface.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
            <p className="text-sm text-slate-500 dark:text-slate-400">Checked In</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{stats?.checkedInCount ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
            <p className="text-sm text-slate-500 dark:text-slate-400">Guests</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{stats?.totalRegistrations ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
            <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{stats?.pendingCount ?? 0}</p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
            <p className="text-sm text-slate-500 dark:text-slate-400">Rate</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{formatPercent(stats?.checkInRate)}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/10 bg-white/75 p-5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,46,0.92),rgba(15,23,46,0.78))]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1132d4] dark:text-sky-300">Current Event</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{selectedEvent?.title || "Select an event"}</h2>
                </div>
                <div className="w-full md:max-w-sm">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Event Selector</label>
                  <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-[#0b1327] dark:text-white">
                    {loading && <option>Loading events...</option>}
                    {!loading && events.map((eventItem) => (<option key={eventItem.id} value={eventItem.id}>
                        {eventItem.title}
                      </option>))}
                  </select>
                </div>
              </div>

              {selectedEvent && (<div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <CalendarDays className="size-4"/> Event Window
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{new Date(selectedEvent.startTime).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <Users className="size-4"/> Capacity
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedEvent.capacity} seats</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <BarChart3 className="size-4"/> Status
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{getEventStatusLabel(selectedEvent.status)}</p>
                  </div>
                </div>)}
            </div>

            <div className="rounded-[2rem] border border-[#bfd4ff] bg-[linear-gradient(180deg,rgba(245,249,255,0.98),rgba(233,241,255,0.94))] p-6 shadow-xl dark:border-sky-400/20 dark:bg-[linear-gradient(180deg,rgba(20,28,56,0.95),rgba(12,19,40,0.88))]">
              {consoleView === "scanner" && (<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex rounded-full bg-[#1132d4]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1132d4] dark:bg-sky-400/10 dark:text-sky-300">
                      Scanner
                    </div>
                    <h3 className="text-3xl font-black text-slate-950 dark:text-white">Paste QR Payload</h3>
                    <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Use the signed `qrPayload` from the attendee wallet to simulate or process gate scans.
                    </p>
                    <div className="rounded-3xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-[#08101f]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950 dark:text-white">Live Camera Scanner</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Point the camera at the attendee QR. Detected codes are validated automatically.
                          </p>
                        </div>
                        <button type="button" onClick={() => void (cameraActive ? stopCamera() : startCamera())} disabled={!cameraSupported && !cameraActive} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
                          {cameraActive ? <CameraOff className="size-4"/> : <Camera className="size-4"/>}
                          {cameraActive ? "Stop Camera" : "Start Camera"}
                        </button>
                      </div>
                      <div className="mt-4 overflow-hidden rounded-3xl border border-black/10 bg-slate-950/5 dark:border-white/10 dark:bg-black/30">
                        <div className="relative aspect-video w-full">
                          <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover transition ${cameraActive ? "opacity-100" : "opacity-0"}`}/>
                          {!cameraActive && (<div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
                              {cameraSupported
                    ? "Camera scanner is ready. Start the camera to scan attendee tickets."
                    : "This browser does not support camera QR scanning here. Use manual payload scan instead."}
                            </div>)}
                          {cameraActive && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <div className="h-[62%] w-[42%] rounded-[2rem] border-2 border-sky-300/80 shadow-[0_0_0_999px_rgba(2,6,23,0.18)]"/>
                            </div>)}
                          <canvas ref={canvasRef} className="hidden"/>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {cameraStatus}
                      </div>
                      {cameraError && (<div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                          {cameraError}
                        </div>)}
                    </div>
                    <textarea value={qrPayload} onChange={(event) => setQrPayload(event.target.value)} placeholder="ticketId|registrationId|eventId" className="min-h-36 w-full rounded-3xl border border-black/10 bg-white px-5 py-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:border-white/10 dark:bg-[#08101f] dark:text-white"/>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button onClick={() => void scan()} disabled={!qrPayload || busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2f3da5] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#3748bf] disabled:opacity-60">
                        <QrCode className="size-4"/>
                        {busy ? "Checking in..." : "Validate and Check In"}
                      </button>
                      <button onClick={() => void refreshStats()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                        <RefreshCcw className="size-4"/>
                        Refresh stats
                      </button>
                    </div>
                  </div>

                  <div className="grid w-full gap-4 sm:grid-cols-3 lg:w-[20rem] lg:grid-cols-1">
                    <div className="rounded-3xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Checked-in</p>
                      <p className="mt-3 text-4xl font-black text-slate-950 dark:text-white">{stats?.checkedInCount ?? 0}</p>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending</p>
                      <p className="mt-3 text-4xl font-black text-slate-950 dark:text-white">{stats?.pendingCount ?? 0}</p>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Check-in Rate</p>
                      <p className="mt-3 text-4xl font-black text-slate-950 dark:text-white">{formatPercent(stats?.checkInRate)}</p>
                    </div>
                  </div>
                </div>)}

              {consoleView === "guest-list" && (<div className="space-y-5">
                  <div className="inline-flex rounded-full bg-[#1132d4]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1132d4] dark:bg-sky-400/10 dark:text-sky-300">
                    Guest List
                  </div>
                  <h3 className="text-3xl font-black text-slate-950 dark:text-white">Recent Check-In Guests</h3>
                  <div className="grid gap-4">
                    {stats?.recentCheckIns?.length ? (stats.recentCheckIns.map((item) => (<div key={item.ticketId} className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[#08101f]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-bold text-slate-950 dark:text-white">Registration {item.registrationId.slice(0, 8).toUpperCase()}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ticket {item.ticketId.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Gate {item.gate}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Checked in at {formatDateTime(item.checkInTime)}</p>
                        </div>))) : (<div className="rounded-3xl border border-dashed border-black/10 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No recent guest activity yet for this event.
                      </div>)}
                  </div>
                </div>)}

              {consoleView === "stats" && (<div className="space-y-5">
                  <div className="inline-flex rounded-full bg-[#1132d4]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1132d4] dark:bg-sky-400/10 dark:text-sky-300">
                    Stats
                  </div>
                  <h3 className="text-3xl font-black text-slate-950 dark:text-white">Check-In Performance</h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                ["Total Registrations", String(stats?.totalRegistrations ?? 0)],
                ["Checked In", String(stats?.checkedInCount ?? 0)],
                ["Pending", String(stats?.pendingCount ?? 0)],
                ["Check-In Rate", formatPercent(stats?.checkInRate)]
            ].map(([label, value]) => (<div key={label} className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[#08101f]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                        <p className="mt-3 text-4xl font-black text-slate-950 dark:text-white">{value}</p>
                      </div>))}
                  </div>
                  <button onClick={() => void refreshStats()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                    <RefreshCcw className="size-4"/>
                    Refresh stats
                  </button>
                </div>)}

              {consoleView === "settings" && (<div className="space-y-5">
                  <div className="inline-flex rounded-full bg-[#1132d4]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1132d4] dark:bg-sky-400/10 dark:text-sky-300">
                    Settings
                  </div>
                  <h3 className="text-3xl font-black text-slate-950 dark:text-white">Console Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[#08101f]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Portal</p>
                      <p className="mt-3 text-xl font-bold text-slate-950 dark:text-white">{isAdminPortal ? "Admin Console" : "Vendor Console"}</p>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[#08101f]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Camera Support</p>
                      <p className="mt-3 text-xl font-bold text-slate-950 dark:text-white">{cameraSupported ? "Supported" : "Manual mode only"}</p>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[#08101f]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Camera Status</p>
                      <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">{cameraStatus}</p>
                    </div>
                    <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[#08101f]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Selected Event</p>
                      <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">{selectedEvent?.title || "No event selected"}</p>
                    </div>
                  </div>
                </div>)}
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/75 p-6 shadow-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,46,0.9),rgba(15,23,46,0.75))]">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-white/5">
                <Search className="size-5 text-slate-500 dark:text-slate-400"/>
                <input value={qrPayload} onChange={(event) => setQrPayload(event.target.value)} placeholder="Search or paste attendee payload..." className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white"/>
              </div>

              {scanMessage && (<div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {scanMessage}
                </div>)}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-black/10 bg-white/75 p-6 shadow-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,46,0.92),rgba(15,23,46,0.78))]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1132d4] dark:text-sky-300">Live Event Stats</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Operations Snapshot</h3>
                </div>
                <div className="hidden rounded-2xl border border-black/10 bg-white/70 p-3 lg:block dark:border-white/10 dark:bg-white/5">
                  <BarChart3 className="size-6 text-[#1132d4] dark:text-sky-300"/>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Registrations</p>
                  <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{stats?.totalRegistrations ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending Attendees</p>
                  <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{stats?.pendingCount ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Check-in Rate</p>
                  <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{formatPercent(stats?.checkInRate)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/75 p-6 shadow-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,46,0.92),rgba(15,23,46,0.78))]">
              <h3 className="text-xl font-black text-slate-950 dark:text-white">Recent Activity</h3>
              <div className="mt-4 space-y-3">
                {stats?.recentCheckIns?.length ? (stats.recentCheckIns.map((item) => (<div key={item.ticketId} className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">Ticket {item.ticketId.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Gate {item.gate}</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{new Date(item.checkInTime).toLocaleString()}</p>
                    </div>))) : (<div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No one has checked in for this event yet.
                  </div>)}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/75 p-6 shadow-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,46,0.92),rgba(15,23,46,0.78))]">
              <h3 className="text-xl font-black text-slate-950 dark:text-white">Console Views</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {consoleViews.map((view) => {
            const Icon = view.icon;
            const active = consoleView === view.id;
            return (<button key={view.id} type="button" onClick={() => setConsoleView(view.id)} className={`rounded-2xl border p-4 text-center transition ${active
                    ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
                    : "border-black/10 bg-white/70 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"}`}>
                      <Icon className="mx-auto size-5"/>
                      <p className="mt-2 text-sm font-semibold">{view.label}</p>
                    </button>);
        })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>);
}
