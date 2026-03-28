import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { AuthSessionMonitor } from "./AuthSessionMonitor";
import { LoadingScreen } from "./LoadingScreen";
import { ScrollToTopButton } from "./ScrollToTopButton";
export function RootLayout() {
    const location = useLocation();
    const path = location.pathname;
    const isTicketPassRoute = /^\/my\/tickets\/[^/]+\/pass$/.test(path);
    const isPortalWorkspaceRoute = path.startsWith("/admin") || path.startsWith("/vendor") || path.startsWith("/customer");
    const hideNavigation = path === "/auth" || isTicketPassRoute;
    const hideFooter = path === "/auth" || isTicketPassRoute || isPortalWorkspaceRoute;
    return (<div className="relative flex min-h-screen flex-col [overflow-x:clip] bg-[#f3f5f9] dark:bg-[#070d1f] print:block print:min-h-0 print:bg-white">
      <AuthSessionMonitor />

      {/* Ambient gradient orbs — atmospheric backdrop for all pages */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] overflow-hidden select-none print:hidden">
        <div className="absolute -top-[20%] right-[5%] h-[700px] w-[600px] rounded-full bg-blue-400/[0.14] blur-[120px] dark:bg-[#1132d4]/[0.22]"/>
        <div className="absolute top-[45%] -left-[15%] h-[600px] w-[600px] rounded-full bg-blue-300/[0.10] blur-[100px] dark:bg-[#1132d4]/[0.10]"/>
        <div className="absolute bottom-[5%] right-[15%] h-[500px] w-[500px] rounded-full bg-indigo-400/[0.09] blur-[100px] dark:bg-[#4f7cff]/[0.07]"/>
      </div>

      {!hideNavigation && <Navigation />}

      <main className={`relative z-10 flex-1 print:pt-0 ${hideNavigation ? "" : "pt-16"}`}>
        <Suspense fallback={<div className="min-h-[calc(100vh-4rem)]"><LoadingScreen /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <ScrollToTopButton />

      {!hideFooter && <Footer />}
    </div>);
}
