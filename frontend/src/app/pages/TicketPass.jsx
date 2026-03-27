import { ArrowLeft, Calendar, Download, MapPin, Ticket as TicketIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ticketingApi } from "../lib/ticketing-api";
import { ApiClientError } from "../lib/http-client";
import { getDisplayQrDataUri } from "../lib/ticket-pass";
import { getEventPlaceholderImage } from "../lib/placeholder-images";
const formatDate = (value) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export function TicketPass() {
    const { registrationId } = useParams();
    const [registration, setRegistration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const load = async () => {
            if (!registrationId) {
                setError("Ticket pass not found.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError("");
            try {
                const registrations = await ticketingApi.listMyRegistrations();
                const match = registrations.find((item) => item.registrationId === registrationId);
                if (!match) {
                    setError("Ticket pass not found.");
                    return;
                }
                setRegistration(match);
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load ticket pass.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [registrationId]);
    const displayQrDataUri = useMemo(() => (registration ? getDisplayQrDataUri(registration.ticket.qrCodeSvgDataUri) : ""), [registration]);
    const downloadPass = () => {
        if (registration?.ticket?.ticketPassUrl) {
            window.open(registration.ticket.ticketPassUrl, "_blank", "noopener,noreferrer");
            return;
        }
        window.print();
    };
    if (loading) {
        return <section className="min-h-screen px-6 py-10 text-sm text-slate-500">Loading ticket pass...</section>;
    }
    if (error || !registration) {
        return <section className="min-h-screen px-6 py-10 text-sm text-red-600">{error || "Ticket pass not found."}</section>;
    }
    const venue = `${registration.venueName || "Venue TBD"}${registration.venueCity ? `, ${registration.venueCity}` : ""}`;
    const ticketSerial = registration.ticket.ticketNumber.split("-").slice(-1)[0] || registration.ticket.ticketNumber;
    return (<section className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(129,170,255,0.28)_0%,rgba(243,245,249,1)_36%,rgba(232,238,251,1)_100%)] px-4 py-8 text-slate-900 dark:bg-[#0b1430] dark:text-slate-100 print:min-h-0 print:bg-white print:px-0 print:py-0 print:text-slate-900" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
        <div className="absolute -top-20 right-[8%] h-[420px] w-[420px] rounded-full bg-blue-300/25 blur-[120px] dark:bg-[#4f7cff]/20"/>
        <div className="absolute bottom-0 left-[4%] h-[380px] w-[380px] rounded-full bg-blue-200/30 blur-[120px] dark:bg-[#1132d4]/18"/>
      </div>
      <div className="relative mx-auto max-w-5xl print:max-w-none print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link to="/my/tickets" className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm dark:border-white/15">
            <ArrowLeft className="size-4"/>
            Back to wallet
          </Link>
          <button type="button" onClick={downloadPass} className="inline-flex items-center gap-2 rounded-xl bg-[#1132d4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
            <Download className="size-4"/>
            Download PDF
          </button>
        </div>

        <div className="mx-auto max-w-[980px] overflow-hidden rounded-[36px] border border-black/10 bg-white/92 shadow-[0_24px_64px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-white/95 dark:shadow-[0_30px_80px_rgba(4,12,30,0.45)] print:max-w-none print:min-h-[250mm] print:break-inside-avoid print:rounded-[28px] print:border-[#cfdcff] print:bg-white print:shadow-[0_18px_48px_rgba(17,50,212,0.16)]" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
          <div className="relative">
            <img src={getEventPlaceholderImage(registration.registrationId)} alt={registration.eventTitle} className="h-44 w-full object-cover print:h-40"/>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,14,36,0.08),rgba(6,14,36,0.65))]"/>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-8 pb-6 print:px-6 print:pb-5">
              <div>
                <p className="inline-flex rounded-full border border-white/25 bg-white/18 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                  EventZen Ticket Pass
                </p>
                <h1 className="mt-4 max-w-[520px] text-4xl font-black tracking-tight text-white print:text-[2rem]">
                  {registration.eventTitle}
                </h1>
              </div>
              <div className="hidden rounded-[22px] border border-white/20 bg-white/14 px-4 py-3 text-right text-white backdrop-blur-sm md:block print:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">Ticket Serial</p>
                <p className="mt-1 text-xl font-black">{ticketSerial}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-8 md:grid-cols-[0.95fr_1.05fr] print:min-h-[calc(250mm-10rem)] print:grid-cols-[0.92fr_1.08fr] print:gap-6 print:p-6">
            <div className="space-y-5 print:flex print:flex-col print:justify-between">
              {registration.ticket.seatRow && registration.ticket.seatColumn && (
                <div className="rounded-2xl bg-[linear-gradient(135deg,#1132d4,#4f7cff)] px-5 py-4 text-white shadow-md print:rounded-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">Your Seat</p>
                  <p className="mt-1 text-3xl font-black">{registration.ticket.seatRow}{registration.ticket.seatColumn}</p>
                  <p className="mt-0.5 text-sm text-blue-200">Row {registration.ticket.seatRow} &nbsp;&middot;&nbsp; Seat No. {registration.ticket.seatColumn}</p>
                </div>
              )}
              <div className="grid gap-3 text-base text-slate-600">
                <p className="inline-flex items-center gap-3 rounded-2xl border border-[#dbe4ff] bg-[#f5f8ff] px-4 py-3">
                  <Calendar className="size-5 text-[#1132d4]"/>
                  {formatDate(registration.eventStartTime)}
                </p>
                <p className="inline-flex items-center gap-3 rounded-2xl border border-[#dbe4ff] bg-[#f5f8ff] px-4 py-3">
                  <MapPin className="size-5 text-[#1132d4]"/>
                  {venue}
                </p>
              </div>

              <div className="rounded-[28px] border border-[#dbe4ff] bg-[linear-gradient(180deg,#f7f9ff,#eef3ff)] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-white shadow-sm">
                    <TicketIcon className="size-5 text-[#1132d4]"/>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6f89d7]">Admission Tier</p>
                    <p className="text-xl font-black text-slate-900">{registration.ticketTypeName}</p>
                  </div>
                </div>
                <p className="mt-4 text-lg text-slate-700">Ticket No: {registration.ticket.ticketNumber}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                <div className="rounded-[22px] border border-[#e0e8ff] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Registration</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{registration.registrationId}</p>
                </div>
                <div className="rounded-[22px] border border-[#e0e8ff] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{registration.status.replaceAll("_", " ")}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-dashed border-[#c8d7ff] bg-[#f8fbff] px-5 py-4 text-sm leading-6 text-slate-500">
                Present this pass at the venue entrance. The QR code is unique to this registration and should remain clearly visible in the PDF.
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-full rounded-[32px] border border-[#dbe4ff] bg-[linear-gradient(180deg,#f8fbff,#eef4ff)] p-6 shadow-inner print:flex print:min-h-full print:flex-col print:justify-between print:border-[#d6e0f8] print:bg-[linear-gradient(180deg,#f8fbff,#eef4ff)]">
                <div className="rounded-[26px] border border-[#d6e0f8] bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="mx-auto grid aspect-square max-w-[380px] place-items-center rounded-[24px] border border-[#d6e0f8] bg-white p-8">
                  <img src={displayQrDataUri} alt={`Scannable QR code for ${registration.eventTitle}`} className="block h-[280px] w-[280px] object-contain" width={280} height={280}/>
                  </div>
                </div>
                <div className="mt-5 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6f89d7]">Scanner Payload</p>
                </div>
                <p className="mx-auto mt-3 max-w-[380px] break-all text-center font-mono text-[13px] leading-6 text-slate-500 print:text-[12px]">
                  {registration.ticket.qrPayload}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);
}
