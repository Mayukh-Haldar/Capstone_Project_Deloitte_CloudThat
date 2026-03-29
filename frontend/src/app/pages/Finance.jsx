import { AlertTriangle, CreditCard, DollarSign, Download, Receipt, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { DateTimeScheduler, formatLocalDateTimeValue } from "../components/ui/date-time-scheduler";
import { useAuthSession } from "../lib/auth-storage";
import { eventApi } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { exportFinanceWorkbook } from "../lib/finance-workbook";
import { ApiClientError } from "../lib/http-client";
import { portalFromPath } from "../lib/roles";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const categoryOptions = ["VENUE", "CATERING", "AV", "MARKETING", "STAFF", "TRAVEL", "SECURITY", "OTHER"];
const defaultExpenseDateValue = () => formatLocalDateTimeValue(new Date(), "09:00");
const getDisplayVendorName = (user) => `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
const formatDateTimeDisplay = (value) => value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "N/A";
const financeFieldClassName = "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-[#0c152b]";
function FinanceField({ label, required = false, className = "", children }) {
    return (<label className={`space-y-1 text-sm font-medium ${className}`.trim()}>
      <span>
        {label}
        {required ? <span className="required-mark">*</span> : null}
      </span>
      {children}
    </label>);
}
export function Finance() {
    const location = useLocation();
    const session = useAuthSession();
    const portal = portalFromPath(location.pathname) || "ADMIN";
    const isAdminPortal = portal === "ADMIN";
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [report, setReport] = useState(null);
    const [budget, setBudget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [budgetForm, setBudgetForm] = useState({ currency: "INR", venue: "", marketing: "", staffing: "" });
    const [expenseForm, setExpenseForm] = useState({
        category: "MARKETING",
        amount: "",
        vendorName: getDisplayVendorName(session?.user),
        description: "",
        expenseDate: defaultExpenseDateValue(),
        receiptUrl: ""
    });
    const [lineItemForm, setLineItemForm] = useState({ title: "", category: "OTHER", estimatedAmount: "", notes: "" });
    const [lineItemSearch, setLineItemSearch] = useState("");
    const [lineItemSort, setLineItemSort] = useState("title");
    const [activitySearch, setActivitySearch] = useState("");
    const [activityTypeFilter, setActivityTypeFilter] = useState("ALL");
    const [activitySort, setActivitySort] = useState("newest");
    const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) || null, [events, selectedEventId]);
    const loadEvents = async () => {
        const result = await eventApi.listEvents({
            organizerId: isAdminPortal ? undefined : session?.user.id,
            size: 50
        });
        setEvents(result.content);
        if (!selectedEventId && result.content[0]) {
            setSelectedEventId(result.content[0].id);
        }
    };
    const loadFinance = async (eventId, silent = false) => {
        if (silent) {
            setRefreshing(true);
        }
        else {
            setLoading(true);
        }
        setError("");
        try {
            const [budgetResult, reportResult] = await Promise.all([
                financeApi.getBudget(eventId).catch(() => null),
                financeApi.getFinancialReport(eventId).catch(() => null)
            ]);
            setBudget(budgetResult);
            setReport(reportResult);
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to load finance data.");
        }
        finally {
            if (silent) {
                setRefreshing(false);
            }
            else {
                setLoading(false);
            }
        }
    };
    useEffect(() => {
        void loadEvents().catch((err) => setError(err instanceof ApiClientError ? err.message : "Unable to load events."));
    }, [isAdminPortal, session?.user.id]);
    useEffect(() => {
        if (selectedEventId) {
            void loadFinance(selectedEventId);
        }
    }, [selectedEventId]);
    const effectiveApprovedBudget = useMemo(() => (
        report?.budget?.approvedTotal
        ?? budget?.approvedTotal
        ?? selectedEvent?.approvedBudget
        ?? selectedEvent?.estimatedBudget
        ?? 0
    ), [report?.budget?.approvedTotal, budget?.approvedTotal, selectedEvent?.approvedBudget, selectedEvent?.estimatedBudget]);
    const effectiveActualSpend = useMemo(() => (
        isAdminPortal
            ? (report?.totalExpenses || budget?.actualTotal || 0)
            : ((report?.totalExpenses || budget?.actualTotal || 0) + (report?.venueBookingRevenue || 0))
    ), [isAdminPortal, report?.totalExpenses, budget?.actualTotal, report?.venueBookingRevenue]);
    const effectiveRevenue = useMemo(() => (
        isAdminPortal
            ? (report?.venueBookingRevenue || 0)
            : (report?.ticketBookingRevenue || 0)
    ), [isAdminPortal, report?.venueBookingRevenue, report?.ticketBookingRevenue]);
    const effectiveNetProfit = useMemo(() => effectiveRevenue - effectiveActualSpend, [effectiveRevenue, effectiveActualSpend]);
    const budgetSectionTitle = !budget && selectedEvent?.approvedBudget != null ? "Create Detailed Budget" : "Create Initial Budget";
    const budgetSectionDescription = !budget && selectedEvent?.approvedBudget != null
        ? "Break the approved event budget into trackable finance line items for venue, marketing, staffing, and other costs."
        : "Create the first detailed finance budget for this event.";
    const activityLogs = useMemo(() => report?.recentTransactions || [], [report?.recentTransactions]);
    const filteredLineItems = useMemo(() => {
        if (!budget?.items) {
            return [];
        }
        const searchKey = lineItemSearch.trim().toLowerCase();
        const nextItems = budget.items.filter((item) => {
            if (!searchKey) {
                return true;
            }
            return [
                item.title,
                item.category,
                item.notes
            ].some((value) => String(value || "").toLowerCase().includes(searchKey));
        });
        nextItems.sort((left, right) => {
            switch (lineItemSort) {
                case "estimated-desc":
                    return right.estimatedAmount - left.estimatedAmount;
                case "actual-desc":
                    return right.actualAmount - left.actualAmount;
                case "category":
                    return String(left.category).localeCompare(String(right.category));
                default:
                    return String(left.title).localeCompare(String(right.title));
            }
        });
        return nextItems;
    }, [budget?.items, lineItemSearch, lineItemSort]);
    const filteredActivityLogs = useMemo(() => {
        const searchKey = activitySearch.trim().toLowerCase();
        const nextLogs = activityLogs.filter((item) => {
            if (activityTypeFilter !== "ALL" && item.type !== activityTypeFilter) {
                return false;
            }
            if (!searchKey) {
                return true;
            }
            return [
                item.type,
                item.category,
                item.counterparty,
                item.reference,
                item.description,
                item.status
            ].some((value) => String(value || "").toLowerCase().includes(searchKey));
        });
        nextLogs.sort((left, right) => {
            switch (activitySort) {
                case "oldest":
                    return new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
                case "amount-desc":
                    return right.amount - left.amount;
                case "amount-asc":
                    return left.amount - right.amount;
                case "type":
                    return String(left.type).localeCompare(String(right.type));
                default:
                    return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
            }
        });
        return nextLogs;
    }, [activityLogs, activitySearch, activityTypeFilter, activitySort]);
    const refreshCurrent = async () => {
        if (selectedEventId) {
            await loadFinance(selectedEventId, true);
        }
    };
    useEffect(() => {
        if (isAdminPortal) {
            return;
        }
        const displayVendorName = getDisplayVendorName(session?.user);
        if (!displayVendorName) {
            return;
        }
        setExpenseForm((current) => current.vendorName === displayVendorName || current.vendorName === ""
            ? { ...current, vendorName: displayVendorName }
            : current);
    }, [isAdminPortal, session?.user?.firstName, session?.user?.lastName]);
    const createBudget = async () => {
        if (!selectedEvent) {
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        try {
            const items = [
                { title: "Venue & Facilities", category: "VENUE", estimatedAmount: Number(budgetForm.venue || 0) },
                { title: "Marketing Campaigns", category: "MARKETING", estimatedAmount: Number(budgetForm.marketing || 0) },
                { title: "Staffing & Operations", category: "STAFF", estimatedAmount: Number(budgetForm.staffing || 0) }
            ];
            const created = await financeApi.createBudget(selectedEvent.id, {
                eventName: selectedEvent.title,
                currency: budgetForm.currency,
                items: items.filter((item) => item.estimatedAmount > 0)
            });
            setBudget(created);
            setMessage("Budget created successfully.");
            await refreshCurrent();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to create budget.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const approveBudget = async () => {
        if (!budget || !isAdminPortal) {
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        try {
            const approved = await financeApi.approveBudget(budget.id, budget.estimatedTotal);
            setBudget(approved);
            setMessage("Budget approved.");
            await refreshCurrent();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to approve budget.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const addLineItem = async () => {
        if (!budget) {
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        try {
            const updated = await financeApi.addBudgetItem(budget.id, {
                title: lineItemForm.title,
                category: lineItemForm.category,
                estimatedAmount: Number(lineItemForm.estimatedAmount),
                notes: lineItemForm.notes || undefined
            });
            setBudget(updated);
            setLineItemForm({ title: "", category: "OTHER", estimatedAmount: "", notes: "" });
            setMessage("Budget line item added.");
            await refreshCurrent();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to add line item.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const logExpense = async () => {
        if (!selectedEvent) {
            return;
        }
        if (!budget) {
            setError("Create the detailed finance budget first before logging expenses for this event.");
            setMessage("");
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        try {
            await financeApi.logExpense({
                eventId: selectedEvent.id,
                eventName: selectedEvent.title,
                category: expenseForm.category,
                amount: Number(expenseForm.amount),
                currency: budget?.currency || "INR",
                vendorName: expenseForm.vendorName,
                description: expenseForm.description,
                expenseDate: expenseForm.expenseDate.slice(0, 10),
                receiptUrl: expenseForm.receiptUrl || undefined
            });
            setExpenseForm({
                category: "MARKETING",
                amount: "",
                vendorName: getDisplayVendorName(session?.user),
                description: "",
                expenseDate: defaultExpenseDateValue(),
                receiptUrl: ""
            });
            setMessage("Expense logged.");
            await refreshCurrent();
        }
        catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Unable to log expense.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleExportWorkbook = () => {
        if (!selectedEvent) {
            return;
        }
        exportFinanceWorkbook({
            fileName: `${selectedEvent.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}-finance-workbook.xls`,
            sheets: [
                {
                    name: "Summary",
                    columns: [
                        { key: "metric", label: "Metric" },
                        { key: "value", label: "Value" }
                    ],
                    rows: [
                        { metric: "Event", value: selectedEvent.title },
                        { metric: "Approved Budget", value: effectiveApprovedBudget },
                        { metric: isAdminPortal ? "Actual Spend" : "Actual Spend + Venue Costs", value: effectiveActualSpend },
                        { metric: isAdminPortal ? "Venue Revenue" : "Ticket Revenue", value: effectiveRevenue },
                        { metric: "Net Profit", value: effectiveNetProfit }
                    ]
                },
                {
                    name: "Budget Items",
                    columns: [
                        { key: "title", label: "Line Item" },
                        { key: "category", label: "Category" },
                        { key: "estimatedAmount", label: "Estimated Amount" },
                        { key: "actualAmount", label: "Actual Amount" },
                        { key: "notes", label: "Notes" }
                    ],
                    rows: filteredLineItems
                },
                {
                    name: "Activity Log",
                    columns: [
                        { key: "type", label: "Type" },
                        { key: "category", label: "Category" },
                        { key: "counterparty", label: "Counterparty" },
                        { key: "amount", label: "Amount" },
                        { key: "currency", label: "Currency" },
                        { key: "status", label: "Status" },
                        { key: "reference", label: "Reference" },
                        { key: "description", label: "Description" },
                        { key: "occurredAt", label: "Occurred At" }
                    ],
                    rows: filteredActivityLogs.map((item) => ({
                        ...item,
                        occurredAt: formatDateTimeDisplay(item.occurredAt)
                    }))
                }
            ]
        });
    };
    return (<main className="relative min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900 dark:bg-[#08101f] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-200/80 via-blue-100/35 to-transparent dark:from-[#0d1942]/90 dark:via-[#070d1f]/45 dark:to-transparent"/>
      <div className="relative mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
            <h1 className="eventzen-page-title mt-2">{isAdminPortal ? "Admin Finance Dashboard" : "Vendor Finance Dashboard"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {isAdminPortal ? "Cross-event financial control with approval authority." : "Track approved budget, ticket revenue, and event costs across your managed events."}
            </p>
          </div>
          <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="max-w-full min-w-[280px] rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-slate-900 shadow-sm outline-none dark:border-white/15 dark:bg-[#0f172e] dark:text-white">
            <option value="">Select event</option>
            {events.map((event) => (<option key={event.id} value={event.id}>{event.title}</option>))}
          </select>
        </header>

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}

        {!selectedEvent ? (<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172e]">
            Select an event to manage its financial plan.
          </div>) : loading ? (<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172e]">
            Loading finance data...
          </div>) : (<>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Approved Budget", value: formatCurrency(effectiveApprovedBudget, budget?.currency), icon: DollarSign },
                { label: isAdminPortal ? "Actual Spend" : "Actual Spend + Venue Costs", value: formatCurrency(effectiveActualSpend, budget?.currency), icon: TrendingDown },
                { label: isAdminPortal ? "Venue Revenue" : "Ticket Revenue", value: formatCurrency(effectiveRevenue, budget?.currency), icon: CreditCard },
                { label: "Net Profit", value: formatCurrency(effectiveNetProfit, budget?.currency), icon: TrendingUp }
            ].map((card) => (<article key={card.label} className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                  <card.icon className="size-5 text-[#1132d4]"/>
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-black">{card.value}</p>
                </article>))}
            </div>

            {budget && (
              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl bg-slate-100 p-4 dark:bg-white/10">
                  <p className="text-sm text-slate-500">Estimated</p>
                  <p className="mt-2 text-xl font-black">{formatCurrency(budget.estimatedTotal, budget.currency)}</p>
                </article>
                <article className="rounded-2xl bg-slate-100 p-4 dark:bg-white/10">
                  <p className="text-sm text-slate-500">Approved</p>
                  <p className="mt-2 text-xl font-black">{formatCurrency(budget.approvedTotal, budget.currency)}</p>
                </article>
                <article className="rounded-2xl bg-slate-100 p-4 dark:bg-white/10">
                  <p className="text-sm text-slate-500">Utilization</p>
                  <p className="mt-2 text-xl font-black">{budget.utilizationPercent.toFixed(2)}%</p>
                </article>
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <section className="min-w-0 space-y-6 rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">{selectedEvent.title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {isAdminPortal ? "Budget governance, approvals, and transaction visibility." : "Budget tracking and expense control for your event operations."}
                    </p>
                    {!budget && selectedEvent?.approvedBudget != null && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Finance line items have not been created yet. Showing the event's approved budget until a detailed finance budget is added.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportWorkbook} disabled={!selectedEvent} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-white/15 disabled:opacity-60">
                      <Download className="size-4"/>
                      Export Workbook
                    </button>
                    <button onClick={() => void refreshCurrent()} disabled={refreshing || loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-white/15 disabled:opacity-60">
                      <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`}/>
                      {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                    {isAdminPortal && budget && budget.status !== "APPROVED" && (<button onClick={() => void approveBudget()} disabled={submitting} className="rounded-xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                        Approve Budget
                      </button>)}
                  </div>
                </div>

                {!budget ? (<div className="grid gap-3 rounded-3xl border border-dashed border-slate-300 p-5 dark:border-white/10">
                    <h3 className="text-lg font-bold">{budgetSectionTitle}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{budgetSectionDescription}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <FinanceField label="Currency" required>
                        <input value={budgetForm.currency} onChange={(event) => setBudgetForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="Enter currency code" className={financeFieldClassName}/>
                      </FinanceField>
                      <FinanceField label="Venue Budget" required>
                        <input type="number" min="0" step="0.01" value={budgetForm.venue} onChange={(event) => setBudgetForm((current) => ({ ...current, venue: event.target.value }))} placeholder="Enter venue budget" className={financeFieldClassName}/>
                      </FinanceField>
                      <FinanceField label="Marketing Budget" required>
                        <input type="number" min="0" step="0.01" value={budgetForm.marketing} onChange={(event) => setBudgetForm((current) => ({ ...current, marketing: event.target.value }))} placeholder="Enter marketing budget" className={financeFieldClassName}/>
                      </FinanceField>
                      <FinanceField label="Staffing Budget" required>
                        <input type="number" min="0" step="0.01" value={budgetForm.staffing} onChange={(event) => setBudgetForm((current) => ({ ...current, staffing: event.target.value }))} placeholder="Enter staffing budget" className={financeFieldClassName}/>
                      </FinanceField>
                    </div>
                    <button onClick={() => void createBudget()} disabled={submitting || !budgetForm.currency.trim()} className="rounded-xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                      {budgetSectionTitle}
                    </button>
                  </div>) : (<>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-sm">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                          <input value={lineItemSearch} onChange={(event) => setLineItemSearch(event.target.value)} placeholder="Search line items, category, notes..." className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 text-sm dark:border-white/15 dark:bg-[#0c152b]"/>
                        </div>
                        <select value={lineItemSort} onChange={(event) => setLineItemSort(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm dark:border-white/15 dark:bg-[#0c152b]">
                          <option value="title">Sort: Title</option>
                          <option value="category">Sort: Category</option>
                          <option value="estimated-desc">Sort: Estimated High-Low</option>
                          <option value="actual-desc">Sort: Actual High-Low</option>
                        </select>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-white/5">
                          <tr>
                            <th className="px-4 py-3">Line Item</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Estimated</th>
                            <th className="px-4 py-3">Actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLineItems.length === 0 ? (
                            <tr className="border-t border-slate-200 dark:border-white/10">
                              <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-300">No budget line items matched the current search.</td>
                            </tr>
                          ) : filteredLineItems.map((item) => (<tr key={item.id} className="border-t border-slate-200 dark:border-white/10">
                              <td className="px-4 py-3 font-semibold">{item.title}</td>
                              <td className="px-4 py-3">{item.category}</td>
                              <td className="px-4 py-3">{formatCurrency(item.estimatedAmount, budget.currency)}</td>
                              <td className="px-4 py-3">{formatCurrency(item.actualAmount, budget.currency)}</td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <FinanceField label="Line Item Title" required>
                        <input value={lineItemForm.title} onChange={(event) => setLineItemForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter line item title" className={financeFieldClassName}/>
                      </FinanceField>
                      <FinanceField label="Category" required>
                        <select value={lineItemForm.category} onChange={(event) => setLineItemForm((current) => ({ ...current, category: event.target.value }))} className={financeFieldClassName}>
                          {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </FinanceField>
                      <FinanceField label="Estimated Amount" required>
                        <input type="number" min="0" step="0.01" value={lineItemForm.estimatedAmount} onChange={(event) => setLineItemForm((current) => ({ ...current, estimatedAmount: event.target.value }))} placeholder="Enter estimated amount" className={financeFieldClassName}/>
                      </FinanceField>
                      <FinanceField label="Notes">
                        <input value={lineItemForm.notes} onChange={(event) => setLineItemForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Add optional notes" className={financeFieldClassName}/>
                      </FinanceField>
                      <button onClick={() => void addLineItem()} disabled={submitting || !lineItemForm.title || !lineItemForm.estimatedAmount} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold dark:border-white/15 md:col-span-2 xl:col-span-4">
                        Add Line Item
                      </button>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">Activity Log</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Recent expense and payment entries stored for this event.</p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
                          <input value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Search description, counterparty, reference..." className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 text-sm dark:border-white/15 dark:bg-[#0c152b]"/>
                        </div>
                        <select value={activityTypeFilter} onChange={(event) => setActivityTypeFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm dark:border-white/15 dark:bg-[#0c152b]">
                          <option value="ALL">All Types</option>
                          <option value="EXPENSE">Expenses</option>
                          <option value="PAYMENT">Payments</option>
                        </select>
                        <select value={activitySort} onChange={(event) => setActivitySort(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm dark:border-white/15 dark:bg-[#0c152b]">
                          <option value="newest">Sort: Newest</option>
                          <option value="oldest">Sort: Oldest</option>
                          <option value="amount-desc">Sort: Amount High-Low</option>
                          <option value="amount-asc">Sort: Amount Low-High</option>
                          <option value="type">Sort: Type</option>
                        </select>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
                        <table className="min-w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 dark:bg-white/5">
                            <tr>
                              <th className="px-4 py-3">When</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Counterparty</th>
                              <th className="px-4 py-3">Amount</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Reference</th>
                              <th className="px-4 py-3">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredActivityLogs.length === 0 ? (
                              <tr className="border-t border-slate-200 dark:border-white/10">
                                <td colSpan={8} className="px-4 py-6 text-center text-slate-500 dark:text-slate-300">No activity logs matched the current search/filter settings.</td>
                              </tr>
                            ) : filteredActivityLogs.map((item) => (
                              <tr key={item.id} className="border-t border-slate-200 dark:border-white/10">
                                <td className="px-4 py-3">{formatDateTimeDisplay(item.occurredAt)}</td>
                                <td className="px-4 py-3 font-semibold">{item.type}</td>
                                <td className="px-4 py-3">{item.category}</td>
                                <td className="px-4 py-3">{item.counterparty || "N/A"}</td>
                                <td className="px-4 py-3">{formatCurrency(item.amount, item.currency)}</td>
                                <td className="px-4 py-3">{item.status}</td>
                                <td className="px-4 py-3">{item.reference || "N/A"}</td>
                                <td className="px-4 py-3">{item.description || "N/A"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>)}
              </section>

              <section className="sticky top-8 self-start space-y-6">
                <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-5 text-[#1132d4]"/>
                    <h3 className="text-lg font-black">Log Expense</h3>
                  </div>
                  {!budget && (
                    <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      Create the detailed finance budget first. Expense logging is enabled only after the finance budget record exists for this event.
                    </p>
                  )}
                  <div className="mt-4 space-y-3">
                    <FinanceField label="Expense Category" required>
                      <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} className={financeFieldClassName}>
                        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </FinanceField>
                    <FinanceField label="Amount" required>
                      <input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Enter expense amount" className={financeFieldClassName}/>
                    </FinanceField>
                    <FinanceField label={isAdminPortal ? "Vendor Name" : "Vendor Name (auto-filled)"} required>
                      <input value={expenseForm.vendorName} onChange={(event) => setExpenseForm((current) => ({ ...current, vendorName: event.target.value }))} placeholder={isAdminPortal ? "Enter vendor name" : "Auto-filled from your profile"} className={financeFieldClassName} readOnly={!isAdminPortal}/>
                    </FinanceField>
                    <FinanceField label="Description" required>
                      <input value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder="Enter expense description" className={financeFieldClassName}/>
                    </FinanceField>
                    <FinanceField label="Expense Date" required>
                      <DateTimeScheduler value={expenseForm.expenseDate} onChange={(value) => setExpenseForm((current) => ({ ...current, expenseDate: value }))} placeholder="Choose expense date" className="w-full" required/>
                    </FinanceField>
                    <FinanceField label="Receipt URL">
                      <input value={expenseForm.receiptUrl} onChange={(event) => setExpenseForm((current) => ({ ...current, receiptUrl: event.target.value }))} placeholder="Add receipt URL if available" className={financeFieldClassName}/>
                    </FinanceField>
                    <button onClick={() => void logExpense()} disabled={submitting || !selectedEvent} className="w-full rounded-xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                      Save Expense
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-[#1132d4]"/>
                    <h3 className="text-lg font-black">Alerts</h3>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {(report?.alerts || budget?.alerts || []).length === 0 ? (<p className="rounded-2xl bg-slate-100 p-4 text-slate-500 dark:bg-white/10 dark:text-slate-300">No active finance alerts.</p>) : ((report?.alerts || budget?.alerts || []).map((alert) => (<div key={`${alert.code}-${alert.message}`} className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                          {alert.message}
                        </div>)))}
                  </div>
                </div>
              </section>
            </div>
          </>)}
      </div>
    </main>);
}
