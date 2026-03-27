import { BarChart3, Calendar, DollarSign, LayoutDashboard, Map, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useSidebar } from "./SidebarContext";
import { getPortalLabel, portalFromPath } from "../lib/roles";
const navByPortal = {
    ADMIN: [
        { label: "Admin Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
        { label: "Event Operations", to: "/admin/events", icon: Calendar },
        { label: "Venue Operations", to: "/admin/venues", icon: Map },
        { label: "Check-In Command Center", to: "/admin/check-in", icon: ScanLine },
        { label: "Admin Finance", to: "/admin/finance", icon: DollarSign },
        { label: "Admin Reports", to: "/admin/reports", icon: BarChart3 }
    ],
    VENDOR: [
        { label: "Vendor Dashboard", to: "/vendor/dashboard", icon: LayoutDashboard },
        { label: "Event Operations", to: "/vendor/events", icon: Calendar },
        { label: "Venue Bookings", to: "/vendor/venues", icon: Map },
        { label: "Check-In Command Center", to: "/vendor/check-in", icon: ScanLine },
        { label: "Vendor Finance", to: "/vendor/finance", icon: DollarSign },
        { label: "Vendor Reports", to: "/vendor/reports", icon: BarChart3 }
    ],
    CUSTOMER: [
        { label: "Customer Portal", to: "/customer/dashboard", icon: LayoutDashboard },
        { label: "Security", to: "/account/settings", icon: ShieldCheck }
    ]
};
export function PortalLayout() {
    const location = useLocation();
    const portal = portalFromPath(location.pathname) || "ADMIN";
    const navItems = navByPortal[portal];
    const { sidebarOpen, setSidebarOpen } = useSidebar();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    return (<section className="relative flex min-h-screen overflow-x-hidden bg-[radial-gradient(ellipse_at_top_left,rgba(122,170,255,0.26)_0%,rgba(232,240,253,0.96)_34%,rgba(228,235,250,1)_68%,rgba(241,245,252,1)_100%)] text-slate-900 dark:bg-[radial-gradient(ellipse_at_top_left,#243a7e_0%,#111d40_36%,#091126_100%)] dark:text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#d6e5ff]/50 via-[#dde8ff]/18 to-transparent dark:from-[#152558]/46 dark:via-[#0f1940]/14 dark:to-transparent"/>
        <div className="absolute -top-[16%] -left-[8%] h-[560px] w-[560px] rounded-full bg-blue-200/[0.18] blur-[150px] dark:bg-[#3150c8]/[0.16]"/>
        <div className="absolute -top-[18%] right-[4%] h-[700px] w-[620px] rounded-full bg-blue-300/[0.14] blur-[150px] dark:bg-[#4f7cff]/[0.18]"/>
      </div>

      {sidebarOpen && (<div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

      <aside className={`fixed top-16 bottom-0 left-0 z-40 shrink-0 overflow-hidden border-r border-black/10 bg-white/58 backdrop-blur-2xl dark:border-border dark:bg-[#0d1429]/58 lg:sticky lg:top-16${mounted ? " transition-[width] duration-300 ease-in-out" : ""} ${sidebarOpen ? "w-[320px]" : "w-0 border-r-0"}`}>
        <div className="flex h-full w-[320px] flex-col overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#1132d4] dark:text-[#7aa3ff]">
              {getPortalLabel(portal)} Portal
            </p>
            <p className="mt-2 text-lg font-bold">
              {portal === "ADMIN" ? "Full system control" : portal === "VENDOR" ? "Event operations workspace" : "Customer self-service workspace"}
            </p>
          </div>

          <nav className="mt-5 space-y-2 text-base">
            {navItems.map((item) => {
            const Icon = item.icon;
            const [itemPath, itemHash = ""] = item.to.split("#");
            const currentHash = location.hash.replace(/^#/, "");
            const isActive = location.pathname === itemPath && (!itemHash || itemHash === currentHash);
            return (<Link key={item.to} to={item.to} onClick={() => {
                    if (itemHash && location.pathname === itemPath && itemHash === currentHash) {
                        const target = document.getElementById(itemHash);
                        if (target instanceof HTMLElement) {
                            target.focus({ preventScroll: true });
                            target.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                    }
                    if (window.innerWidth < 1024) {
                        setSidebarOpen(false);
                    }
                }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${isActive ? "bg-[#1132d4]/10 text-[#1132d4] dark:bg-[#7aa3ff]/15 dark:text-[#7aa3ff] font-semibold" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}>
                  <Icon className="size-5"/>
                  {item.label}
                </Link>);
        })}
          </nav>
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <Outlet />
      </div>
    </section>);
}
