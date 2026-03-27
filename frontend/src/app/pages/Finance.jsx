import { AlertTriangle, CreditCard, DollarSign, Receipt, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { DateTimeScheduler, formatLocalDateTimeValue } from "../components/ui/date-time-scheduler";
import { useAuthSession } from "../lib/auth-storage";
import { eventApi } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { ApiClientError } from "../lib/http-client";
import { portalFromPath } from "../lib/roles";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const categoryOptions = ["VENUE", "CATERING", "AV", "MARKETING", "STAFF", "TRAVEL", "SECURITY", "OTHER"];
const defaultExpenseDateValue = () => formatLocalDateTimeValue(new Date(), "09:00");
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
        vendorName: "",
        description: "",
        expenseDate: defaultExpenseDateValue(),
        receiptUrl: ""
    });
    const [lineItemForm, setLineItemForm] = useState({ title: "", category: "OTHER", estimatedAmount: "", notes: "" });
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
    const refreshCurrent = async () => {
        if (selectedEventId) {
            await loadFinance(selectedEventId, true);
        }
    };
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
                vendorName: "",
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
    return (<main className="relative min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900 dark:bg-[#08101f] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-200/80 via-blue-100/35 to-transparent dark:from-[#0d1942]/90 dark:via-[#070d1f]/45 dark:to-transparent"/>
      <div className="relative mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
            <h1 className="eventzen-page-title mt-2">{isAdminPortal ? "Admin Finance Dashboard" : "Vendor Finance Dashboard"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {isAdminPortal ? "Cross-event financial control with approval authority." : "Track revenue, expenses, and budget health across your managed events."}
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
                { label: "Approved Budget", value: formatCurrency(report?.budget?.approvedTotal || budget?.approvedTotal || 0, budget?.currency), icon: DollarSign },
                { label: "Actual Spend", value: formatCurrency(report?.totalExpenses || budget?.actualTotal || 0, budget?.currency), icon: TrendingDown },
                { label: "Revenue", value: formatCurrency(report?.totalRevenue || 0, budget?.currency), icon: CreditCard },
                { label: "Net Profit", value: formatCurrency(report?.netProfit || 0, budget?.currency), icon: TrendingUp }
            ].map((card) => (<article key={card.label} className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                  <card.icon className="size-5 text-[#1132d4]"/>
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-black">{card.value}</p>
                </article>))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <section className="space-y-6 rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">{selectedEvent.title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {isAdminPortal ? "Budget governance, approvals, and transaction visibility." : "Budget tracking and expense control for your event operations."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                    <h3 className="text-lg font-bold">Create Initial Budget</h3>
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
                      Create Budget
                    </button>
                  </div>) : (<>
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

                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
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
                          {budget.items.map((item) => (<tr key={item.id} className="border-t border-slate-200 dark:border-white/10">
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
                  </>)}
              </section>

              <section className="space-y-6">
                <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172e]">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-5 text-[#1132d4]"/>
                    <h3 className="text-lg font-black">Log Expense</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    <FinanceField label="Expense Category" required>
                      <select value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} className={financeFieldClassName}>
                        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </FinanceField>
                    <FinanceField label="Amount" required>
                      <input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Enter expense amount" className={financeFieldClassName}/>
                    </FinanceField>
                    <FinanceField label="Vendor Name" required>
                      <input value={expenseForm.vendorName} onChange={(event) => setExpenseForm((current) => ({ ...current, vendorName: event.target.value }))} placeholder="Enter vendor name" className={financeFieldClassName}/>
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
                    <button onClick={() => void logExpense()} disabled={submitting || !budget} className="w-full rounded-xl bg-[#1132d4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
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
