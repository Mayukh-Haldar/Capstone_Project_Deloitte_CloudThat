import { Link, useLocation, useNavigate } from "react-router";
import { Bell, Calendar, Home, LayoutDashboard, Menu, Settings, Ticket, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { ThemeToggle } from "./ThemeToggle";
import { clearAuthSession, useAuthSession } from "../lib/auth-storage";
import { authApi } from "../lib/auth-api";
import { useSidebar } from "./SidebarContext";
import { notificationApi } from "../lib/notification-api";
import { NOTIFICATION_STATE_CHANGED_EVENT } from "../lib/notification-events";
import { getPortalHomePath, getPortalLabel, getPrimaryPortal, portalFromPath } from "../lib/roles";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { eventApi } from "../lib/event-api";
const NOTIFICATION_FETCH_SIZE = 100;
const isNotificationRead = (notification) => Boolean(notification?.readAt) || notification?.status === "READ";
const publicTabs = [
    { name: "Home", path: "/", icon: Home },
    { name: "Events", path: "/events", icon: Calendar },
];
const authenticatedTabs = [
    { name: "My Tickets", path: "/my/tickets", icon: Ticket },
    { name: "Registrations", path: "/my/registrations", icon: Ticket }
];
export function Navigation() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const session = useAuthSession();
    const { sidebarOpen, setSidebarOpen } = useSidebar();
    const searchContainerRef = useRef(null);
    const suppressNextSuggestionsRef = useRef(false);
    const primaryPortal = getPrimaryPortal(session);
    const activePortal = portalFromPath(location.pathname) || primaryPortal;
    const shouldShowSidebarToggle = location.pathname.startsWith("/admin") ||
        location.pathname.startsWith("/vendor") ||
        location.pathname.startsWith("/customer");
    const isActive = (path) => {
        if (path === "/") {
            return location.pathname === "/";
        }
        return location.pathname.startsWith(path);
    };
    const renderTab = (tab, onClick) => {
        const Icon = tab.icon;
        return (<Link key={tab.path} to={tab.path} onClick={onClick} className={clsx("inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition", isActive(tab.path)
                ? "bg-[#1132d4]/10 text-[#1132d4] dark:bg-[#7aa3ff]/15 dark:text-[#7aa3ff]"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10")}>
        <Icon className="size-4 shrink-0"/>
        <span className="whitespace-nowrap">{tab.name}</span>
      </Link>);
    };
    const avatarFallback = session?.user
        ? `${session.user.firstName[0] ?? ""}${session.user.lastName[0] ?? ""}`.toUpperCase() || "EZ"
        : "EZ";
    useEffect(() => {
        if (!session) {
            setUnreadCount(0);
            return;
        }
        let cancelled = false;
        const refreshUnreadCount = () => {
            notificationApi
                .list({ size: NOTIFICATION_FETCH_SIZE })
                .then((page) => {
                if (!cancelled) {
                    setUnreadCount(page.content.filter((notification) => !isNotificationRead(notification)).length);
                }
            })
                .catch(() => {
                if (!cancelled) {
                    setUnreadCount(0);
                }
            });
        };
        refreshUnreadCount();
        const handleNotificationStateChanged = () => refreshUnreadCount();
        window.addEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationStateChanged);
        return () => {
            cancelled = true;
            window.removeEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationStateChanged);
        };
    }, [session]);
    useEffect(() => {
        const trimmedQuery = searchQuery.trim();
        if (suppressNextSuggestionsRef.current) {
            suppressNextSuggestionsRef.current = false;
            setSearchSuggestions([]);
            setSuggestionsOpen(false);
            setSearchLoading(false);
            return;
        }
        if (trimmedQuery.length < 2) {
            setSearchSuggestions([]);
            setSuggestionsOpen(false);
            setSearchLoading(false);
            return;
        }
        let cancelled = false;
        setSearchLoading(true);
        const timeoutId = window.setTimeout(() => {
            eventApi
                .listEvents({ q: trimmedQuery, size: 6 })
                .then((page) => {
                if (cancelled) {
                    return;
                }
                setSearchSuggestions(page.content);
                setSuggestionsOpen(true);
            })
                .catch(() => {
                if (!cancelled) {
                    setSearchSuggestions([]);
                }
            })
                .finally(() => {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            });
        }, 220);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [searchQuery]);
    useEffect(() => {
        const handlePointerDown = (event) => {
            if (!searchContainerRef.current?.contains(event.target)) {
                setSuggestionsOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, []);
    useEffect(() => {
        setSuggestionsOpen(false);
    }, [location.pathname, location.search]);
    const openSuggestedEvent = (event) => {
        suppressNextSuggestionsRef.current = true;
        setSearchQuery(event.title);
        setSearchSuggestions([]);
        setSuggestionsOpen(false);
        navigate(`/events?eventId=${encodeURIComponent(event.id)}&q=${encodeURIComponent(event.title)}`);
    };
    const handleSearchSubmit = () => {
        const trimmedQuery = searchQuery.trim();
        suppressNextSuggestionsRef.current = true;
        if (!trimmedQuery) {
            navigate("/events");
            setSearchSuggestions([]);
            setSuggestionsOpen(false);
            return;
        }
        navigate(`/events?q=${encodeURIComponent(trimmedQuery)}`);
        setSearchSuggestions([]);
        setSuggestionsOpen(false);
    };
    const handleLogout = async () => {
        try {
            setLogoutLoading(true);
            if (session?.refreshToken) {
                await authApi.logout(session.refreshToken);
            }
        }
        catch {
            // Ignore logout API failures and clear local state.
        }
        finally {
            clearAuthSession();
            setLogoutLoading(false);
            setMobileMenuOpen(false);
        }
    };
    return (<nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="flex h-16 items-center">
        {shouldShowSidebarToggle && (<button onClick={() => setSidebarOpen((prev) => !prev)} className="ml-4 hidden shrink-0 lg:flex rounded-xl border border-black/10 bg-white/80 p-2 text-slate-600 shadow-sm hover:bg-slate-100 dark:border-border dark:bg-[#0d1429]/80 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Toggle sidebar">
            {sidebarOpen ? <X className="size-5"/> : <Menu className="size-5"/>}
          </button>)}

        <div className="min-w-0 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              {shouldShowSidebarToggle && (<button onClick={() => setSidebarOpen((prev) => !prev)} className="lg:hidden rounded-xl border border-black/10 bg-white/80 p-2 text-slate-600 shadow-sm hover:bg-slate-100 dark:border-border dark:bg-[#0d1429]/80 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Toggle sidebar">
                  {sidebarOpen ? <X className="size-5"/> : <Menu className="size-5"/>}
                </button>)}

              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="size-8 bg-[#1132d4] rounded-xl flex items-center justify-center shadow-sm shadow-blue-700/30 transition-[transform,box-shadow] duration-200 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-blue-700/40">
                  <Calendar className="size-[18px] text-white"/>
                </div>
                <span className="font-display text-xl font-bold bg-gradient-to-r from-[#1132d4] to-[#4f7cff] dark:from-[#7aa3ff] dark:to-[#a5c3ff] bg-clip-text text-transparent tracking-tight">
                  EventZen
                </span>
              </Link>

              <div className="hidden lg:flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {publicTabs.map((tab) => renderTab(tab))}
                  {session && authenticatedTabs.map((tab) => renderTab(tab))}
                </div>
                {session && primaryPortal && (<div className="flex items-center rounded-full border border-black/10 bg-white/70 p-1 dark:border-white/10 dark:bg-white/5">
                    <Link to={getPortalHomePath(primaryPortal)} className={clsx("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition", activePortal === primaryPortal
                ? "bg-[#1132d4] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10")}>
                      <LayoutDashboard className="size-4"/>
                      {getPortalLabel(primaryPortal)}
                    </Link>
                  </div>)}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <div ref={searchContainerRef} className="relative group mr-2">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400 group-focus-within:text-[#1132d4] dark:text-slate-500 dark:group-focus-within:text-[#7aa3ff] transition-colors" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                  </svg>
                </div>
                <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onFocus={() => {
            if (searchSuggestions.length > 0 || searchLoading) {
                setSuggestionsOpen(true);
            }
        }} onKeyDown={(event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                handleSearchSubmit();
            }
        }} className="block w-64 p-2 pl-10 text-sm text-slate-900 border border-slate-200 rounded-full bg-slate-50 focus:ring-[#1132d4] focus:border-[#1132d4] dark:bg-[#0f172e] dark:border-white/10 dark:placeholder-slate-400 dark:text-white dark:focus:ring-[#7aa3ff] dark:focus:border-[#7aa3ff] transition-all focus:w-72 shadow-sm" placeholder="Search events..."/>
                {suggestionsOpen && (searchLoading || searchSuggestions.length > 0) && (<div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0f172e]">
                    {searchLoading ? (<div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">Searching events...</div>) : (<div className="py-2">
                        {searchSuggestions.map((event) => (<button key={event.id} type="button" onMouseDown={(pointerEvent) => {
                        pointerEvent.preventDefault();
                        openSuggestedEvent(event);
                    }} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {event.categoryName} · {event.venueCity || event.venueName || event.eventType}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#1132d4]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1132d4] dark:bg-[#7aa3ff]/15 dark:text-[#7aa3ff]">
                              View
                            </span>
                          </button>))}
                      </div>)}
                  </div>)}
              </div>

              <ThemeToggle />

              {session ? (<>
                  <Link to="/account/notifications" className="relative inline-flex items-center gap-2 px-4 py-2 text-sm text-foreground/70 hover:text-foreground">
                    <Bell className="size-4"/>
                    Notifications
                    {unreadCount > 0 && (<span className="rounded-full bg-[#1132d4] px-2 py-0.5 text-[11px] font-semibold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>)}
                  </Link>
                  <Link to="/account/settings" className="inline-flex items-center gap-2 px-4 py-2 text-sm text-foreground/70 hover:text-foreground">
                    <Settings className="size-4"/>
                    Settings
                  </Link>
                  <Link to="/account/settings" className="inline-flex items-center" aria-label="Profile settings">
                    <Avatar className="size-10 border border-black/10 bg-slate-100 shadow-sm dark:border-white/15 dark:bg-[#13244c]">
                      <AvatarImage src={session.user.profilePhotoUrl || undefined} alt={`${session.user.firstName} ${session.user.lastName}`} className="object-cover"/>
                      <AvatarFallback className="bg-[#1132d4]/10 text-xs font-semibold text-[#1132d4]">
                        {avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <button type="button" onClick={handleLogout} disabled={logoutLoading} className="px-4 py-2 text-sm bg-[#1132d4] text-white rounded-lg hover:bg-[#1132d4]/90 transition-[background-color,box-shadow] duration-200 shadow-sm hover:shadow-md disabled:opacity-60">
                    {logoutLoading ? "Signing out..." : "Logout"}
                  </button>
                </>) : (<>
                  <Link to="/auth?mode=signin" className="px-4 py-2 text-sm text-foreground/70 hover:text-foreground">
                    Login
                  </Link>
                  <Link to="/auth?mode=signup" className="px-4 py-2 text-sm bg-[#1132d4] text-white rounded-lg hover:bg-[#1132d4]/90 transition-[background-color,box-shadow] duration-200 shadow-sm hover:shadow-md">
                    Sign Up
                  </Link>
                </>)}
            </div>

            <div className="flex lg:hidden items-center gap-2">
              <ThemeToggle />
              <button onClick={() => setMobileMenuOpen((open) => !open)} className="p-2 rounded-lg hover:bg-accent transition-[background-color]" aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="size-6"/> : <Menu className="size-6"/>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (<div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <div className="px-4 py-4 space-y-1">
            <div className="pb-2">
              <div className="space-y-1 pb-3">
                {publicTabs.map((tab) => renderTab(tab, () => setMobileMenuOpen(false)))}
                {session && authenticatedTabs.map((tab) => renderTab(tab, () => setMobileMenuOpen(false)))}
              </div>
              {session && primaryPortal && (<div className="border-t border-border pt-2">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Portal</div>
                  <Link to={getPortalHomePath(primaryPortal)} onClick={() => setMobileMenuOpen(false)} className={clsx("flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-[background-color]", activePortal === primaryPortal
                    ? "bg-[#1132d4]/10 text-[#1132d4] dark:bg-[#7aa3ff]/15 dark:text-[#7aa3ff] font-semibold"
                    : "text-foreground/70 hover:bg-accent")}>
                    <LayoutDashboard className="size-4"/>
                    {getPortalLabel(primaryPortal)}
                  </Link>
                </div>)}
            </div>
            <div className="pt-3 space-y-2 border-t border-border">
              {session ? (<>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar className="size-10 border border-black/10 bg-slate-100 shadow-sm dark:border-white/15 dark:bg-[#13244c]">
                      <AvatarImage src={session.user.profilePhotoUrl || undefined} alt={`${session.user.firstName} ${session.user.lastName}`} className="object-cover"/>
                      <AvatarFallback className="bg-[#1132d4]/10 text-xs font-semibold text-[#1132d4]">
                        {avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{session.user.firstName} {session.user.lastName}</p>
                      <p className="truncate text-xs text-foreground/60">{session.user.email}</p>
                    </div>
                  </div>
                  <Link to="/account/notifications" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-foreground/70 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                    <Bell className="size-4"/>
                    Notifications
                  </Link>
                  <Link to="/account/settings" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-foreground/70 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                    <Settings className="size-4"/>
                    Settings
                  </Link>
                  <button type="button" onClick={handleLogout} disabled={logoutLoading} className="block w-full px-3 py-2.5 text-center text-sm bg-[#1132d4] text-white rounded-lg hover:bg-[#1132d4]/90 shadow-sm disabled:opacity-60">
                    {logoutLoading ? "Signing out..." : "Logout"}
                  </button>
                </>) : (<>
                  <Link to="/auth?mode=signin" className="block px-3 py-2.5 text-center text-sm text-foreground/70 rounded-lg hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                    Login
                  </Link>
                  <Link to="/auth?mode=signup" className="block px-3 py-2.5 text-center text-sm bg-[#1132d4] text-white rounded-lg hover:bg-[#1132d4]/90 shadow-sm" onClick={() => setMobileMenuOpen(false)}>
                    Sign Up
                  </Link>
                </>)}
            </div>
          </div>
        </div>)}
    </nav>);
}
