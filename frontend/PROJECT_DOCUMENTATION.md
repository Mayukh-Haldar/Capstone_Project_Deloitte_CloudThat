# Frontend Project Documentation

This document gives a little more detail about how the frontend is organized and what the main parts of the app are responsible for.

## Stack

- React 18
- Vite 6
- JavaScript with ES modules
- React Router 7
- Tailwind CSS v4
- next-themes
- Framer Motion
- Recharts
- Firebase Web SDK
- SignalR client

## Application layout

The frontend is structured around `src/app`.

### `src/app/App.jsx`

The root app wraps the router with:

- `ThemeProvider`
- `SidebarProvider`
- `NotificationRealtimeBridge`
- `PushNotificationBootstrap`
- `Toaster`

### `src/app/routes.jsx`

All browser routes are declared here. Public, authenticated, customer, vendor, and admin areas are separated by route guards.

### `src/app/components/`

Shared application components live here, including:

- layout wrappers
- route guards
- navigation
- theme toggle
- scroll helpers
- realtime notification bootstrap
- shared UI primitives under `components/ui`

### `src/app/pages/`

Each page-level screen lives here. Current page modules include:

- `Home`
- `Auth`
- `Events`
- `EventDetails`
- `EventCheckout`
- `SeatSelection`
- `Tickets`
- `TicketPass`
- `Registrations`
- `Notifications`
- `AccountSettings`
- `CustomerPortal`
- `VendorDashboard`
- `Venues`
- `VenueBookingCheckout`
- `CheckIn`
- `Finance`
- `Reports`
- `Admin`
- `AdminEvents`
- `AdminVendors`
- policy/help pages

### `src/app/lib/`

This folder holds API and feature-specific helpers, including:

- auth API helpers
- event, finance, ticketing, notification, and venue-vendor API clients
- Firebase push helpers
- SignalR seat hub helpers
- PDF and invoice helpers
- role utilities

### `src/styles/`

Global styles, theme tokens, and font definitions live here.

## Route groups

### Public routes

- `/`
- `/auth`
- `/events`
- `/events/:id`
- `/help`
- `/privacy`
- `/terms`
- `/cookies`

### Authenticated routes

- `/events/:id/checkout/:ticketTypeId`
- `/events/:id/seats/:ticketTypeId`
- `/my/tickets`
- `/my/tickets/:registrationId/pass`
- `/my/registrations`
- `/account/notifications`
- `/account/settings`

### Customer route

- `/customer/dashboard`

### Vendor routes

- `/vendor/dashboard`
- `/vendor/events`
- `/vendor/venues`
- `/vendor/venues/checkout/:bookingId`
- `/vendor/check-in`
- `/vendor/finance`
- `/vendor/reports`

### Admin routes

- `/admin/dashboard`
- `/admin/events`
- `/admin/check-in`
- `/admin/venues`
- `/admin/vendors`
- `/admin/finance`
- `/admin/reports`

## Environment variables

The frontend uses `frontend/.env.example` as the template.

### Service URLs

- `VITE_SITE_URL`
- `VITE_AUTH_SERVICE_URL`
- `VITE_EVENT_SERVICE_URL`
- `VITE_VENUE_VENDOR_SERVICE_URL`
- `VITE_TICKETING_SERVICE_URL`
- `VITE_FINANCE_SERVICE_URL`
- `VITE_NOTIFICATION_SERVICE_URL`

### Identity and push

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

## Local development notes

- `npm run dev` starts Vite with the browser opening at `/`.
- `vite.config.js` proxies API requests to the backend services during local development.
- `/socket.io` is proxied to the notification service.
- `/seat-hub` is proxied to the ticketing service for SignalR seat updates.
- `npm run build` generates the sitemap before bundling.

## Assets and public files

The `public/` folder currently includes:

- `favicon.svg`
- `firebase-messaging-sw.js`
- `robots.txt`
- `sitemap.xml`
- cursor assets

## Related files

- [README.md](./README.md)
- [Root README](../README.md)
