# EventZen - Event Management Platform

![EventZen](https://img.shields.io/badge/EventZen-v1.0-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.3.1-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4.1-38bdf8?style=for-the-badge&logo=tailwind-css)

A next-generation, cloud-native event management platform designed to orchestrate excellence and reimagine world-class experiences.

---

## ✨ Features

### 🎨 **Beautiful UI/UX**
- **Professional design** aligned to the product UI system
- **Smooth animations** and transitions
- **Responsive layout** for all devices
- **Accessible components** with ARIA labels

### 🌓 **Theme System**
- **Light & Dark modes** with smooth transitions
- **System preference detection**
- **Persistent theme selection**
- **One-click toggle** from anywhere

### 🗺️ **Multi-Page Application**
- **9+ unique pages** covering all use cases
- **React Router v7** for smooth navigation
- **Nested routing** for admin portal
- **404 error handling**

### 🔐 **Role-Based Access**
- **Public pages** for event discovery
- **Customer portal** for ticket management
- **Admin dashboard** for operations
- **Staff terminal** for check-in

### 📱 **Mobile-First Design**
- **Touch-optimized** interactions
- **Bottom navigation** for mobile apps
- **Responsive breakpoints** (mobile, tablet, desktop)
- **PWA-ready** architecture

---

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment

Create `frontend/.env` for local frontend settings:

```env
VITE_AUTH_SERVICE_URL=http://localhost:8081
VITE_VENUE_VENDOR_SERVICE_URL=http://localhost:8083
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

For Google sign-in to work end-to-end, the backend `auth-service` must also be configured with the same client ID:

```env
AUTH_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

### Project Structure

```
eventzen/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── Navigation.tsx       # Main navigation header
│   │   │   ├── Footer.tsx           # Site footer
│   │   │   ├── ThemeToggle.tsx      # Theme switcher
│   │   │   ├── RootLayout.tsx       # App layout wrapper
│   │   │   ├── NotFound.tsx         # 404 page
│   │   │   └── LoadingScreen.tsx    # Loading state
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Landing page
│   │   │   ├── Events.tsx           # Event discovery
│   │   │   ├── Admin.tsx            # Admin dashboard
│   │   │   ├── Venues.tsx           # Venue management
│   │   │   ├── Finance.tsx          # Financial reports
│   │   │   └── Reports.tsx          # Detailed analytics
│   │   ├── routes.tsx               # Route configuration
│   │   └── App.tsx                  # Root component
│   ├── imports/
│   │   ├── LandingPage.tsx          # Landing screen source
│   │   ├── Authentication.tsx       # Authentication screen source
│   │   ├── EventDiscoveryDetails.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── VenueVendorManagement.tsx
│   │   ├── StaffQrCheckIn.tsx
│   │   ├── AttendeeTicketWallet.tsx
│   │   ├── FinanceReportingDashboard.tsx
│   │   └── DetailedExpenseReport.tsx
│   └── styles/
│       ├── theme.css                # Theme variables & dark mode
│       └── fonts.css                # Font imports
├── PROJECT_DOCUMENTATION.md         # Detailed docs
├── ROUTES_GUIDE.md                  # Route reference
└── README.md                        # This file
```

---

## 📖 Pages Overview

### **Public Pages**

#### 1. Landing Page (`/`)
Your entry point to EventZen with:
- Hero section showcasing events
- Featured upcoming events
- Service highlights
- Client testimonials
- Newsletter signup

#### 2. Event Discovery (`/events`)
Browse and discover events with:
- Advanced filtering (category, date, location)
- Sort options
- Event cards with details
- Quick registration

#### 3. Authentication (`/auth`)
Secure login and registration:
- Email/Password authentication
- Social login (Google, GitHub)
- Multi-factor authentication
- Password recovery

---

### **Customer Pages**

#### 4. Ticket Wallet (`/my/tickets`)
Digital ticket management:
- QR codes for entry
- Upcoming and past events
- Ticket details and transfers
- Mobile-optimized interface

---

### **Admin Portal**

#### 5. Dashboard (`/admin/dashboard`)
Executive overview with:
- Real-time KPIs (events, attendees, revenue)
- Registration trends chart
- Budget breakdown
- Recent activity feed
- Quick actions

#### 6. Venue Management (`/admin/venues`)
Manage venues and bookings:
- Available venues gallery
- Capacity and pricing
- Booking calendar
- Multi-hall support

#### 7. Vendor Management (`/admin/vendors`)
Vendor relationships:
- Vendor catalog with ratings
- Service categories
- Contract management
- Recent contracts table

#### 8. Finance Dashboard (`/admin/finance`)
Financial tracking:
- Budget vs actual spending
- Expense breakdown
- Revenue analysis
- Financial alerts
- Export reports

#### 9. Detailed Reports (`/admin/reports`)
Analytics and insights:
- Budget utilization by category
- Transaction history
- Expense approvals
- Export to CSV/PDF

---

### **Staff Pages**

#### 10. QR Check-in (`/staff/checkin`)
Event check-in terminal:
- Real-time QR scanning
- Check-in statistics
- Manual search
- Guest list access

---

## 🎨 Theme System

### Using the Theme Toggle

Click the **sun/moon icon** in the navigation to switch themes.

### Customizing Colors

Edit `/src/styles/theme.css`:

```css
:root {
  --primary: #1132d4;      /* Brand color */
  --background: #ffffff;   /* Light background */
  --foreground: #030213;   /* Light text */
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);  /* Dark background */
  --foreground: oklch(0.985 0 0);  /* Dark text */
  /* ... */
}
```

---

## 🗺️ Navigation Guide

### Main Navigation
- **Home** → Landing page
- **Events** → Event discovery
- **My Tickets** → Ticket wallet
- **Admin** → Admin dropdown menu

### Admin Dropdown
- Dashboard
- Venues
- Attendees
- Finance
- Reports

### Direct URLs
```
/                      → Landing page
/events                → Event discovery
/events/:id            → Event details
/auth                  → Authentication
/my/tickets            → Ticket wallet
/admin/dashboard       → Admin dashboard
/admin/venues          → Venue management
/admin/finance         → Finance dashboard
/admin/reports         → Detailed reports
/staff/checkin         → QR check-in
```

---

## 🔐 Authentication & Roles

### Role-Based Access Control

| Route | Public | Customer | Staff | Admin |
|-------|--------|----------|-------|-------|
| `/` | ✅ | ✅ | ✅ | ✅ |
| `/events` | ✅ | ✅ | ✅ | ✅ |
| `/my/tickets` | ❌ | ✅ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ❌ | ✅ |
| `/staff/checkin` | ❌ | ❌ | ✅ | ✅ |

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: `< 768px` (touch-optimized)
- **Tablet**: `768px - 1024px`
- **Desktop**: `> 1024px` (full features)

### Mobile Features
- Bottom navigation
- Touch gestures
- Simplified layouts
- Collapsible menus

---

## 🛠️ Technology Stack

### Core
- **React 18.3.1** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router 7** - Routing

### Styling
- **Tailwind CSS v4** - Utility-first CSS
- **next-themes** - Theme management
- **clsx** - Conditional classes

### UI Components
- **Lucide React** - Icon library
- **Recharts** - Charts & graphs
- **Radix UI** - Accessible components

### Utilities
- **date-fns** - Date formatting
- **motion** - Animations
- **react-hook-form** - Form handling

---

## 🎯 Key Features by Page

### Landing Page
✅ Hero section with event showcase  
✅ Featured events grid  
✅ Service highlights  
✅ Testimonials  
✅ Newsletter signup  
✅ Footer with links  

### Event Discovery
✅ Filter by category, date, location  
✅ Sort options  
✅ Event cards with images  
✅ Quick registration  
✅ Event details modal  

### Admin Dashboard
✅ Real-time KPIs  
✅ Interactive charts  
✅ Budget tracking  
✅ Activity feed  
✅ Quick actions  

### Finance Dashboard
✅ Budget vs actual  
✅ Expense breakdown  
✅ Revenue analysis  
✅ Financial alerts  
✅ Export reports  

### QR Check-in
✅ Camera viewfinder  
✅ Real-time scanning  
✅ Check-in stats  
✅ Manual search  
✅ Terminal info  

---

## 🚀 Performance

### Optimizations
- **Code splitting** by route
- **Lazy loading** for components
- **Image optimization** with WebP
- **CSS purging** with Tailwind
- **Bundle size** < 500KB gzipped

### Lighthouse Scores (Target)
- **Performance**: > 92
- **Accessibility**: > 95
- **Best Practices**: > 95
- **SEO**: > 90

---

## 🌐 Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 📚 Documentation

- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Comprehensive project docs
- **[ROUTES_GUIDE.md](./ROUTES_GUIDE.md)** - Complete route reference
- **[EventZen_PRD_v3.md](./src/imports/EventZen_PRD_v3.md)** - Product requirements

---

## 🤝 Contributing

This project follows the EventZen PRD specifications. Key principles:

1. **Component-driven** development
2. **Type-safe** with TypeScript
3. **Accessible** by default
4. **Responsive** for all devices
5. **Themeable** with CSS variables

---

## 📄 License

**Confidential** - EventZen Event Management Platform  
© 2024 EventZen. All rights reserved.

---

## 🎉 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Start dev server**: `npm run dev`
4. **Open browser**: http://localhost:5173
5. **Toggle theme**: Click sun/moon icon
6. **Explore pages**: Use navigation menu

---

## 🆘 Support

For questions or issues:
- 📧 Email: contact@eventzen.com
- 📞 Phone: +1 (234) 567-890
- 🌐 Website: https://eventzen.com

---

**Built with ❤️ by the EventZen Team**
