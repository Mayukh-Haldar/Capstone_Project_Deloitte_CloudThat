import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { NotFound } from "./components/NotFound";
import { RequireAuth } from "./components/RequireAuth";
import { RequireCustomerPortal } from "./components/RequireCustomerPortal";
import { RequireAdmin } from "./components/RequireAdmin";
import { RequireVendorAccess } from "./components/RequireVendorAccess";
import { PortalLayout } from "./components/PortalLayout";
import { Home } from "./pages/Home";
import { Events } from "./pages/Events";
import { EventDetails } from "./pages/EventDetails";
import { EventCheckout } from "./pages/EventCheckout";
import { SeatSelection } from "./pages/SeatSelection";
import { Auth } from "./pages/Auth";
import { VenueBookingCheckout } from "./pages/VenueBookingCheckout";
import { HelpCenter } from "./pages/HelpCenter";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { CookiesPolicy } from "./pages/CookiesPolicy";
const CustomerPortal = lazy(() => import("./pages/CustomerPortal").then((module) => ({ default: module.CustomerPortal })));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard").then((module) => ({ default: module.VendorDashboard })));
const Tickets = lazy(() => import("./pages/Tickets").then((module) => ({ default: module.Tickets })));
const TicketPass = lazy(() => import("./pages/TicketPass").then((module) => ({ default: module.TicketPass })));
const Registrations = lazy(() => import("./pages/Registrations").then((module) => ({ default: module.Registrations })));
const AccountSettings = lazy(() => import("./pages/AccountSettings").then((module) => ({ default: module.AccountSettings })));
const Notifications = lazy(() => import("./pages/Notifications").then((module) => ({ default: module.Notifications })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const AdminEvents = lazy(() => import("./pages/AdminEvents").then((module) => ({ default: module.AdminEvents })));
const CheckIn = lazy(() => import("./pages/CheckIn").then((module) => ({ default: module.CheckIn })));
const Venues = lazy(() => import("./pages/Venues").then((module) => ({ default: module.Venues })));
const AdminVendors = lazy(() => import("./pages/AdminVendors").then((module) => ({ default: module.AdminVendors })));
const Finance = lazy(() => import("./pages/Finance").then((module) => ({ default: module.Finance })));
const Reports = lazy(() => import("./pages/Reports").then((module) => ({ default: module.Reports })));
export const router = createBrowserRouter([
    {
        path: "/",
        Component: RootLayout,
        children: [
            { index: true, Component: Home },
            { path: "auth", Component: Auth },
            { path: "events", Component: Events },
            { path: "events/:id", Component: EventDetails },
            { path: "help", Component: HelpCenter },
            { path: "privacy", Component: PrivacyPolicy },
            { path: "terms", Component: TermsOfService },
            { path: "cookies", Component: CookiesPolicy },
            {
                Component: RequireAuth,
                children: [
                    { path: "events/:id/checkout/:ticketTypeId", Component: EventCheckout },
                    { path: "events/:id/seats/:ticketTypeId", Component: SeatSelection },
                    { path: "my/tickets", Component: Tickets },
                    { path: "my/tickets/:registrationId/pass", Component: TicketPass },
                    { path: "my/registrations", Component: Registrations },
                    { path: "account/notifications", Component: Notifications },
                    { path: "account/settings", Component: AccountSettings },
                    {
                        Component: RequireCustomerPortal,
                        children: [
                            {
                                Component: PortalLayout,
                                children: [{ path: "customer/dashboard", Component: CustomerPortal }],
                            },
                        ],
                    },
                    {
                        Component: RequireVendorAccess,
                        children: [
                            {
                                Component: PortalLayout,
                                children: [
                                    { path: "vendor/dashboard", Component: VendorDashboard },
                                    { path: "vendor/events", Component: AdminEvents },
                                    { path: "vendor/venues", Component: Venues },
                                    { path: "vendor/venues/checkout/:bookingId", Component: VenueBookingCheckout },
                                    { path: "vendor/check-in", Component: CheckIn },
                                    { path: "vendor/finance", Component: Finance },
                                    { path: "vendor/reports", Component: Reports },
                                ],
                            },
                        ],
                    },
                    {
                        Component: RequireAdmin,
                        children: [
                            {
                                Component: PortalLayout,
                                children: [
                                    { path: "admin/dashboard", Component: Admin },
                                    { path: "admin/events", Component: AdminEvents },
                                    { path: "admin/check-in", Component: CheckIn },
                                    { path: "admin/venues", Component: Venues },
                                    { path: "admin/finance", Component: Finance },
                                    { path: "admin/reports", Component: Reports },
                                    { path: "admin/vendors", Component: AdminVendors },
                                ],
                            },
                        ],
                    },
                ],
            },
            { path: "*", Component: NotFound },
        ],
    },
]);
