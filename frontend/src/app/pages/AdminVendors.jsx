import { useEffect, useMemo, useState } from "react";
import { FileText, Search, Star, Users } from "lucide-react";
import { Link } from "react-router";
import { ApiClientError } from "../lib/http-client";
import { venueVendorApi } from "../lib/venue-vendor-api";
import { eventApi } from "../lib/event-api";
const serviceCategories = ["CATERING", "AV", "DECOR", "SECURITY", "PHOTOGRAPHY"];
export function AdminVendors() {
    const [vendors, setVendors] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [search, setSearch] = useState("");
    const [reviewVendorId, setReviewVendorId] = useState("");
    const [reviewEventId, setReviewEventId] = useState("");
    const [reviewRating, setReviewRating] = useState("");
    const [reviewComment, setReviewComment] = useState("");
    const loadVendors = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await venueVendorApi.listVendors({ limit: 50 });
            setVendors(response.items);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load vendors.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadVendors();
    }, []);
    useEffect(() => {
        const loadEvents = async () => {
            try {
                const response = await eventApi.listEvents({ size: 50 });
                setEvents(response.content);
            }
            catch {
                setEvents([]);
            }
        };
        void loadEvents();
    }, []);
    const handleAddReview = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!reviewVendorId || !reviewEventId || !reviewRating) {
            setError("Please choose a vendor, event, and rating.");
            return;
        }
        setSubmitting(true);
        try {
            await venueVendorApi.addVendorReview(reviewVendorId, {
                eventId: reviewEventId,
                rating: Number(reviewRating),
                comment: reviewComment || undefined
            });
            setMessage("Review submitted successfully.");
            setReviewVendorId("");
            setReviewEventId("");
            setReviewRating("");
            setReviewComment("");
            await loadVendors();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Review submission failed.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const filteredVendors = useMemo(() => vendors.filter((vendor) => {
        const matchesCategory = selectedCategory ? vendor.serviceType === selectedCategory : true;
        const searchText = `${vendor.vendorName} ${vendor.serviceType} ${vendor.email} ${vendor.phone}`.toLowerCase();
        const matchesSearch = search.trim() ? searchText.includes(search.trim().toLowerCase()) : true;
        return matchesCategory && matchesSearch;
    }), [selectedCategory, search, vendors]);
    return (<main>
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">ADMIN PORTAL</p>
            <h1 className="eventzen-page-title mt-2">Vendor Management</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review the vendor catalog, monitor service partners, and record vendor feedback for completed events.</p>
          </div>
        </header>

        <nav className="flex gap-6 border-b border-slate-200 text-lg font-bold dark:border-white/10">
          <Link to="/admin/venues" className="pb-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Venues</Link>
          <Link to="/admin/vendors" className="-mb-px border-b-2 border-[#1132d4] pb-2 text-[#1132d4]">Vendors</Link>
        </nav>

        {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {message && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Vendor Catalog</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Browse the current vendor list by service type and contact details.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendor name or contact" className="w-full rounded-lg border border-slate-300 px-10 py-2.5 text-sm dark:border-white/20 dark:bg-[#0f172e]"/>
                </label>
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-[#0f172e]">
                  <option value="">All services</option>
                  {serviceCategories.map((item) => (<option key={item} value={item}>{item}</option>))}
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Vendors</p>
                <p className="mt-2 text-2xl font-black">{vendors.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Visible Catalog</p>
                <p className="mt-2 text-2xl font-black">{filteredVendors.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Top Rated</p>
                <p className="mt-2 text-2xl font-black">
                  {vendors.length === 0 ? "0.0" : Math.max(...vendors.map((vendor) => vendor.rating)).toFixed(1)}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
            <h2 className="text-lg font-bold">Add Vendor Review</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Record an admin review for a vendor against a completed or tracked event.</p>
            <form onSubmit={handleAddReview} className="mt-4 space-y-3">
              <label className="space-y-1 text-sm font-medium">
                <span>Vendor<span className="required-mark">*</span></span>
                <select required value={reviewVendorId} onChange={(event) => setReviewVendorId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/20 dark:bg-[#0f172e]">
                  <option value="">Select a vendor</option>
                  {vendors.map((vendor) => (<option key={vendor.vendorId} value={vendor.vendorId}>
                      {vendor.vendorName}
                    </option>))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Event<span className="required-mark">*</span></span>
                <select required value={reviewEventId} onChange={(event) => setReviewEventId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/20 dark:bg-[#0f172e]">
                  <option value="">Select an event</option>
                  {events.map((item) => (<option key={item.id} value={item.id}>
                      {item.title}
                    </option>))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Rating<span className="required-mark">*</span></span>
                <input required type="number" min={1} max={5} value={reviewRating} onChange={(event) => setReviewRating(event.target.value)} placeholder="Rate from 1 to 5" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/20 dark:bg-[#0f172e]"/>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Comment</span>
                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Share feedback about the vendor service" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal dark:border-white/20 dark:bg-[#0f172e]"/>
              </label>
              <button type="submit" disabled={submitting} className="w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold dark:border-white/20 disabled:opacity-60">
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
            </form>
          </article>
        </div>

        {loading ? (<p className="text-sm text-slate-600 dark:text-slate-300">Loading vendors...</p>) : (<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredVendors.map((vendor) => (<article key={vendor.vendorId} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{vendor.vendorName}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{vendor.serviceType}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>
                    {vendor.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                  <Star className="size-4 fill-current"/> {vendor.rating.toFixed(1)} ({vendor.reviewCount} reviews)
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="inline-flex items-center gap-2"><FileText className="size-4"/> Vendor ID: {vendor.vendorId}</p>
                  <p className="inline-flex items-center gap-2"><Users className="size-4"/> Contact: {vendor.phone}</p>
                  <p className="truncate">{vendor.email}</p>
                </div>
              </article>))}
          </div>)}
      </div>
    </main>);
}
