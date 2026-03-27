import { Calendar, ChartColumn, DollarSign, Map, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useSidebar } from "./SidebarContext";
const navItems = [
    { label: "Dashboard", to: "/admin/dashboard", icon: Calendar },
    { label: "Events", to: "/admin/events", icon: Calendar },
    { label: "Attendees", to: "/admin/attendees", icon: Users },
    { label: "Venues", to: "/admin/venues", icon: Map },
    { label: "Vendors", to: "/admin/vendors", icon: Users },
    { label: "Finance", to: "/admin/finance", icon: DollarSign },
    { label: "Reports", to: "/admin/reports", icon: ChartColumn },
];
export function AdminLayout() {
    const location = useLocation();
    const { sidebarOpen, setSidebarOpen } = useSidebar();
    // Delay transition class until after first paint to prevent initial-load CLS.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    return (<section className="relative flex min-h-screen overflow-x-hidden bg-[radial-gradient(ellipse_at_top_left,rgba(122,170,255,0.26)_0%,rgba(232,240,253,0.96)_34%,rgba(228,235,250,1)_68%,rgba(241,245,252,1)_100%)] text-slate-900 dark:bg-[radial-gradient(ellipse_at_top_left,#243a7e_0%,#111d40_36%,#091126_100%)] dark:text-foreground">
      {/* Ambient gradient orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#d6e5ff]/50 via-[#dde8ff]/18 to-transparent dark:from-[#152558]/46 dark:via-[#0f1940]/14 dark:to-transparent"/>
        <div className="absolute -top-[16%] -left-[8%] h-[560px] w-[560px] rounded-full bg-blue-200/[0.18] blur-[150px] dark:bg-[#3150c8]/[0.16]"/>
        <div className="absolute -top-[18%] right-[4%] h-[700px] w-[620px] rounded-full bg-blue-300/[0.14] blur-[150px] dark:bg-[#4f7cff]/[0.18]"/>
        <div className="absolute top-[34%] -left-[12%] h-[620px] w-[620px] rounded-full bg-indigo-200/[0.12] blur-[145px] dark:bg-[#1837b8]/[0.13]"/>
        <div className="absolute bottom-[-4%] right-[18%] h-[460px] w-[460px] rounded-full bg-sky-200/[0.10] blur-[130px] dark:bg-[#4f7cff]/[0.08]"/>
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (<div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

      {/* Sidebar - fixed overlay on mobile, sticky inline on desktop */}
      <aside className={`fixed top-16 bottom-0 left-0 z-40 shrink-0 overflow-hidden border-r border-black/10 bg-white/58 backdrop-blur-2xl dark:border-border dark:bg-[#0d1429]/58 lg:sticky lg:top-16${mounted ? " transition-[width] duration-300 ease-in-out" : ""} ${sidebarOpen ? "w-[310px]" : "w-0 border-r-0"}`}>
        <div className="flex h-full w-[310px] flex-col overflow-y-auto p-5">
          <nav className="space-y-2 text-base">
            {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (<Link key={item.to} to={item.to} onClick={() => { if (window.innerWidth < 1024)
                setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${isActive ? "bg-[#1132d4]/10 text-[#1132d4] dark:bg-[#7aa3ff]/15 dark:text-[#7aa3ff] font-semibold" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}>
                  <Icon className="size-5"/>
                  {item.label}
                </Link>);
        })}
          </nav>

          <div className="mt-8 rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50/70 to-slate-50 p-4 dark:border-white/10 dark:from-[#0d1635] dark:to-[#0a1229]">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">SYSTEM STATUS</p>
            <p className="mt-2 text-base">All systems online</p>
            <button className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-base">View Logs</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="relative min-w-0 flex-1">
        <Outlet />
      </div>

    </section>);
}
