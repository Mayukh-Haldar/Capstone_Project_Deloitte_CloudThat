import { BarChart3, Calendar, Download, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuthSession } from "../lib/auth-storage";
import { eventApi } from "../lib/event-api";
import { financeApi } from "../lib/finance-api";
import { ApiClientError } from "../lib/http-client";
import { exportReportsToPDF } from "../lib/pdf-export";
import { portalFromPath } from "../lib/roles";
import { ticketingApi } from "../lib/ticketing-api";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const chartTooltipStyle = {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    borderRadius: "12px",
    boxShadow: "0 18px 40px rgba(2, 6, 23, 0.45)",
    color: "#e5eefb"
};
const chartTooltipLabelStyle = {
    color: "#f8fafc",
    fontWeight: 700
};
const chartTooltipItemStyle = {
    color: "#cbd5e1",
    fontWeight: 600
};
const formatCompactAxisCurrency = (value) => {
    const absoluteValue = Math.abs(value);
    if (absoluteValue >= 10000000) {
        return `Rs ${(value / 10000000).toFixed(1)}Cr`;
    }
    if (absoluteValue >= 100000) {
        return `Rs ${(value / 100000).toFixed(1)}L`;
    }
    if (absoluteValue >= 1000) {
        return `Rs ${(value / 1000).toFixed(1)}K`;
    }
    return `Rs ${value.toFixed(0)}`;
};
const getTrendMetrics = (values) => {
    if (values.length < 2) {
        return null;
    }
    const start = values[0];
    const end = values[values.length - 1];
    const delta = end - start;
    if (delta === 0) {
        return {
            change: 0,
            isIncrease: true
        };
    }
    if (start === 0) {
        return {
            change: 100,
            isIncrease: delta > 0
        };
    }
    return {
        change: Math.round((Math.abs(delta) / Math.abs(start)) * 100),
        isIncrease: delta > 0
    };
};
export function Reports() {
    const location = useLocation();
    const session = useAuthSession();
    const portal = portalFromPath(location.pathname) || "ADMIN";
    const isAdminPortal = portal === "ADMIN";
    const [events, setEvents] = useState([]);
    const [reports, setReports] = useState([]);
    const [checkInStats, setCheckInStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [exporting, setExporting] = useState(false);
    const registrationChartRef = useRef(null);
    const revenueChartRef = useRef(null);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const eventPage = await eventApi.listEvents({
                    organizerId: isAdminPortal ? undefined : session?.user.id,
                    size: 30
                });
                setEvents(eventPage.content);
                // Fetch financial reports and check-in stats in parallel
                const reportResults = await Promise.all(eventPage.content.slice(0, 30).map((event) => financeApi.getFinancialReport(event.id).catch(() => null)));
                const statsResults = await Promise.all(eventPage.content.slice(0, 30).map(async (event) => {
                    try {
                        const stats = await ticketingApi.getCheckInStats(event.id);
                        return { eventId: event.id, stats };
                    }
                    catch {
                        return null;
                    }
                }));
                setReports(reportResults.filter(Boolean));
                setCheckInStats(statsResults.filter(Boolean));
            }
            catch (err) {
                setError(err instanceof ApiClientError ? err.message : "Unable to load reports.");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [isAdminPortal, session?.user.id]);
    const summary = useMemo(() => ({
        revenue: reports.reduce((sum, report) => sum + report.totalRevenue, 0),
        expenses: reports.reduce((sum, report) => sum + report.totalExpenses, 0),
        profit: reports.reduce((sum, report) => sum + report.netProfit, 0),
        events: reports.length
    }), [reports]);
    // Compute real registrations trend data from check-in stats grouped by month
    const registrationData = useMemo(() => {
        const monthlyData = {};
        checkInStats.forEach(({ eventId, stats }) => {
            const event = events.find(e => e.id === eventId);
            if (event) {
                const month = new Date(event.startTime).toLocaleDateString('en-US', { month: 'short' });
                monthlyData[month] = (monthlyData[month] || 0) + stats.totalRegistrations;
            }
        });
        // Sort by month order (assuming last 6 months)
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthOrder
            .filter(month => monthlyData[month])
            .map(month => ({ month, value: monthlyData[month] }));
    }, [checkInStats, events]);
    // Compute real revenue overview data from financial reports grouped by month
    const revenueData = useMemo(() => {
        const monthlyData = {};
        reports.forEach((report) => {
            const event = events.find(e => e.id === report.eventId);
            if (event) {
                const month = new Date(event.startTime).toLocaleDateString('en-US', { month: 'short' });
                monthlyData[month] = (monthlyData[month] || 0) + report.totalRevenue;
            }
        });
        // Sort by month order
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthOrder
            .filter(month => monthlyData[month])
            .map(month => ({ month, value: monthlyData[month] }));
    }, [reports, events]);
    // Compute totals for chart headers
    const totalRegistrations = useMemo(() => checkInStats.reduce((sum, { stats }) => sum + stats.totalRegistrations, 0), [checkInStats]);
    const totalRevenue = useMemo(() => reports.reduce((sum, report) => sum + report.totalRevenue, 0), [reports]);
    const registrationTrend = useMemo(() => getTrendMetrics(registrationData.map((item) => item.value)), [registrationData]);
    const revenueTrend = useMemo(() => getTrendMetrics(revenueData.map((item) => item.value)), [revenueData]);
    const reportsAccent = "var(--reports-accent)";
    const handleExportPDF = async () => {
        setExporting(true);
        try {
            const summaryMetrics = {
                events: summary.events,
                revenue: formatCurrency(summary.revenue),
                expenses: formatCurrency(summary.expenses),
                profit: formatCurrency(summary.profit)
            };
            const reportRows = reports.map(report => ({
                eventName: report.eventName,
                eventId: report.eventId,
                revenue: formatCurrency(report.totalRevenue),
                expenses: formatCurrency(report.totalExpenses),
                profit: formatCurrency(report.netProfit),
                transactions: report.recentTransactions.length
            }));
            await exportReportsToPDF(isAdminPortal ? "Admin" : "Vendor", summaryMetrics, registrationChartRef.current, revenueChartRef.current, reportRows);
        }
        catch (err) {
            console.error("Failed to export PDF:", err);
            alert("Failed to export PDF. Please try again.");
        }
        finally {
            setExporting(false);
        }
    };
    return (<main>
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--reports-accent)]">{isAdminPortal ? "ADMIN PORTAL" : "VENDOR PORTAL"}</p>
            <h1 className="eventzen-page-title mt-2">{isAdminPortal ? "Admin Reports Dashboard" : "Vendor Reports Dashboard"}</h1>
            <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
              {isAdminPortal ? "Cross-portfolio reporting for every live event." : "Performance and profitability reporting across your managed events."}
            </p>
          </div>
          <button onClick={handleExportPDF} disabled={exporting || loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/10 dark:bg-[#111a33]">
            {exporting ? <Loader2 className="size-4 animate-spin"/> : <Download className="size-4"/>}
            {exporting ? "Exporting..." : "Export Snapshot"}
          </button>
        </div>

        {error && <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Tracked Events", value: summary.events, icon: Calendar },
            { label: "Revenue", value: formatCurrency(summary.revenue), icon: TrendingUp },
            { label: "Expenses", value: formatCurrency(summary.expenses), icon: TrendingDown },
            { label: "Net Profit", value: formatCurrency(summary.profit), icon: Wallet }
        ].map((card) => (<article key={card.label} className="rounded-2xl border border-slate-300 bg-white p-5 dark:border-white/15 dark:bg-[#111a33]">
              <card.icon className="size-5 text-[var(--reports-accent)]"/>
              <p className="mt-4 text-base text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="mt-3 text-2xl font-black sm:text-3xl">{card.value}</p>
            </article>))}
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Registrations Trend Chart */}
          <div ref={registrationChartRef} data-chart="registration" className="rounded-2xl border border-slate-300 bg-white p-6 dark:border-white/15 dark:bg-[#111a33]">
            <h3 className="text-lg font-bold">Registrations Trend</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">{totalRegistrations.toLocaleString()}</span>
              {registrationTrend && (<span className={`flex items-center text-sm font-medium ${registrationTrend.isIncrease ? "text-green-600" : "text-red-600"}`}>
                  {registrationTrend.isIncrease ? <TrendingUp className="size-4"/> : <TrendingDown className="size-4"/>}
                  {registrationTrend.isIncrease ? "+" : "-"}
                  {registrationTrend.change}%
                </span>)}
            </div>
            <div className="mt-6 h-64">
              {registrationData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                  <LineChart data={registrationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                    <XAxis dataKey="month" stroke="#94a3b8"/>
                    <YAxis stroke="#94a3b8"/>
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} cursor={{ stroke: "rgba(148, 163, 184, 0.45)", strokeWidth: 1.5 }}/>
                    <Line type="monotone" dataKey="value" stroke={reportsAccent} strokeWidth={2.5} dot={{ fill: reportsAccent, r: 4.5 }}/>
                  </LineChart>
                </ResponsiveContainer>) : (<div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No registration data available
                </div>)}
            </div>
          </div>

          {/* Revenue Overview Chart */}
          <div ref={revenueChartRef} data-chart="revenue" className="rounded-2xl border border-slate-300 bg-white p-6 dark:border-white/15 dark:bg-[#111a33]">
            <h3 className="text-lg font-bold">Revenue Overview</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatCurrency(totalRevenue)}</span>
              {revenueTrend && (<span className={`flex items-center text-sm font-medium ${revenueTrend.isIncrease ? "text-green-600" : "text-red-600"}`}>
                  {revenueTrend.isIncrease ? <TrendingUp className="size-4"/> : <TrendingDown className="size-4"/>}
                  {revenueTrend.isIncrease ? "+" : "-"}
                  {revenueTrend.change}%
                </span>)}
            </div>
            <div className="mt-6 h-64">
              {revenueData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                    <XAxis dataKey="month" stroke="#94a3b8"/>
                    <YAxis width={88} stroke="#94a3b8" tickCount={5} tickFormatter={(value) => formatCompactAxisCurrency(value)}/>
                    <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} cursor={{ fill: "rgba(148, 163, 184, 0.16)" }}/>
                    <Bar dataKey="value" fill={reportsAccent} radius={[8, 8, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>) : (<div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No revenue data available
                </div>)}
            </div>
          </div>
        </div>

        {/* Financial Report Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-white/15 dark:bg-[#111a33]">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-[var(--reports-accent)]"/>
                <h3 className="text-xl font-bold">Financial Report Table</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead className="bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Expenses</th>
                    <th className="px-4 py-3">Net Profit</th>
                    <th className="px-4 py-3">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (<tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading reports...</td>
                    </tr>) : reports.length === 0 ? (<tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No reports available yet.</td>
                    </tr>) : (reports.map((report) => (<tr key={report.eventId} className="border-t border-slate-200 dark:border-white/10">
                        <td className="px-4 py-4">
                          <p className="font-semibold">{report.eventName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{report.eventId}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold">{formatCurrency(report.totalRevenue)}</td>
                        <td className="px-4 py-4">{formatCurrency(report.totalExpenses)}</td>
                        <td className="px-4 py-4">{formatCurrency(report.netProfit)}</td>
                        <td className="px-4 py-4">{report.recentTransactions.length}</td>
                      </tr>)))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </main>);
}
