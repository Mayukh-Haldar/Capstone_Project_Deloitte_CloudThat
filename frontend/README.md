# EventZen Frontend

React + Vite frontend for the EventZen platform.

- Dev server: `http://localhost:5173`
- Build tool: Vite 6
- Routing: React Router 7
- Styling: Tailwind CSS v4

## What it covers

- Public event discovery and event detail pages
- Authentication flows
- Ticket checkout, seat selection, and ticket pass pages
- Customer account, registrations, tickets, and notification preferences
- Vendor portal pages for events, venues, check-in, finance, and reports
- Admin pages for events, venues, vendors, finance, reports, and check-in
- Real-time notification bridge and browser push bootstrap

## Run locally

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run preview
```

## Environment

Create `frontend/.env` from `frontend/.env.example` and set the values you need.

Frontend service and app URLs:

```env
VITE_SITE_URL=http://localhost:5173
VITE_AUTH_SERVICE_URL=http://localhost:8081
VITE_EVENT_SERVICE_URL=http://localhost:8082
VITE_VENUE_VENDOR_SERVICE_URL=http://localhost:8083
VITE_TICKETING_SERVICE_URL=http://localhost:8084
VITE_FINANCE_SERVICE_URL=http://localhost:8085
VITE_NOTIFICATION_SERVICE_URL=http://localhost:8086
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

Firebase web push config:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

For Google sign-in to work end-to-end, `auth-service` must be configured with the same `AUTH_GOOGLE_CLIENT_ID`.

## Local API behavior

During local development, Vite proxies API requests and websocket traffic to the backend services configured in `vite.config.js`.

That includes:

- `/api/v1/auth`, `/api/v1/account-requests`, `/api/v1/users`
- `/api/v1/categories`, `/api/v1/events`
- `/api/v1/venues`, `/api/v1/vendors`, `/api/v1/contracts`
- `/api/v1/registrations`, `/api/v1/tickets`, `/api/v1/checkin`, `/api/v1/ticket-types`, `/api/v1/attendees`
- `/api/v1/payments`, `/api/v1/expenses`, `/api/v1/budgets`
- `/api/v1/notifications`
- `/socket.io`
- `/seat-hub`

## Main routes

### Public

- `/`
- `/auth`
- `/events`
- `/events/:id`
- `/help`
- `/privacy`
- `/terms`
- `/cookies`

### Authenticated

- `/events/:id/checkout/:ticketTypeId`
- `/events/:id/seats/:ticketTypeId`
- `/my/tickets`
- `/my/tickets/:registrationId/pass`
- `/my/registrations`
- `/account/notifications`
- `/account/settings`

### Customer

- `/customer/dashboard`

### Vendor

- `/vendor/dashboard`
- `/vendor/events`
- `/vendor/venues`
- `/vendor/venues/checkout/:bookingId`
- `/vendor/check-in`
- `/vendor/finance`
- `/vendor/reports`

### Admin

- `/admin/dashboard`
- `/admin/events`
- `/admin/check-in`
- `/admin/venues`
- `/admin/vendors`
- `/admin/finance`
- `/admin/reports`

## Project structure

Key folders and files:

```text
frontend/
├── public/
│   ├── favicon.svg
│   ├── firebase-messaging-sw.js
│   └── sitemap.xml
├── scripts/
│   └── generate-sitemap.mjs
├── src/
│   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── routes.jsx
│   ├── styles/
│   │   ├── fonts.css
│   │   ├── index.css
│   │   ├── tailwind.css
│   │   └── theme.css
│   └── main.jsx
├── .env.example
├── PROJECT_DOCUMENTATION.md
├── README.md
└── vite.config.js
```

## Main libraries in use

- React 18
- React Router 7
- Tailwind CSS v4
- next-themes
- Framer Motion
- React Hook Form
- Recharts
- Firebase
- `@microsoft/signalr`
- Sonner
- jsPDF + html2canvas
- jsQR
- Three.js + postprocessing

## Notes

- Route-level lazy loading is used for most portal pages.
- Browser push setup is initialized through `PushNotificationBootstrap`.
- Real-time in-app notifications are wired through `NotificationRealtimeBridge`.
- The build runs sitemap generation before Vite build output.

## Related docs

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
- [Root README](../README.md)
