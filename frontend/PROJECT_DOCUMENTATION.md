# EventZen - Event Management Platform

A professional, feature-rich event management platform built with React, TypeScript, and Tailwind CSS.

## 🎨 Features

### Core Features
- ✅ **Multi-page application** with React Router
- ✅ **Dark/Light theme toggle** using next-themes
- ✅ **Responsive design** optimized for all devices
- ✅ **Professional UI** aligned to the project design system
- ✅ **Type-safe** with TypeScript
- ✅ **Modern styling** with Tailwind CSS v4

### Pages Implemented

#### Public Pages
1. **Landing Page** (`/`)
   - Hero section with event showcase
   - Featured events
   - Service highlights
   - Client testimonials
   - Newsletter signup

2. **Event Discovery** (`/events`)
   - Event listings with filtering
   - Search functionality
   - Event details view
   - Ticket purchase options

3. **Authentication** (`/auth`)
   - Sign in / Sign up toggle
   - Email/Password login
   - Social login (Google, GitHub)
   - Multi-factor authentication support
   - Password recovery

#### Customer/Attendee Pages
4. **Ticket Wallet** (`/my/tickets`)
   - Digital ticket storage
   - QR codes for event entry
   - Upcoming and past events
   - Ticket transfer options

#### Admin Portal
5. **Admin Dashboard** (`/admin/dashboard`)
   - Real-time KPI metrics
   - Active events overview
   - Budget tracking
   - Recent activity feed
   - Registration trends
   - Quick actions

6. **Venue & Vendor Management** (`/admin/venues`, `/admin/vendors`)
   - Venue inventory
   - Vendor catalog
   - Contract management
   - Booking calendar
   - Availability tracking

7. **Finance Reporting** (`/admin/finance`)
   - Budget overview
   - Expense tracking
   - Revenue analysis
   - Financial alerts
   - Budget vs actual spending

8. **Detailed Reports** (`/admin/reports`)
   - Expense breakdown
   - Budget utilization
   - Transaction history
   - Export to CSV/PDF

#### Staff Pages
9. **QR Check-in** (`/staff/checkin`)
   - Real-time QR code scanner
   - Check-in statistics
   - Guest list search
   - Manual check-in
   - Live attendance counters

## 🎯 Theme System

### Light Mode (Default)
- Clean, professional appearance
- High contrast for readability
- Optimized for daytime use

### Dark Mode
- Reduced eye strain
- OLED-friendly colors
- Perfect for evening events

### How to Toggle
- Click the sun/moon icon in the top-right corner
- Theme preference is saved automatically
- Smooth transitions between modes

## 🗺️ Navigation

### Main Navigation
- **Home**: Landing page with event highlights
- **Events**: Browse and discover events
- **My Tickets**: Access your digital tickets
- **Admin Dropdown**:
  - Dashboard
  - Venues
  - Attendees
  - Finance
  - Reports

### Mobile Navigation
- Hamburger menu on mobile devices
- Full-screen navigation drawer
- Touch-optimized interactions

## 🎨 Design System

### Colors
The theme uses a cohesive color system:
- **Primary**: `#1132d4` (EventZen Blue)
- **Background**: Dynamic (white/dark)
- **Foreground**: Dynamic (dark/light)
- **Accent colors** for different event categories

### Typography
- Font: Inter (Professional, modern)
- Clear hierarchy (H1-H4)
- Responsive font sizes
- Optimized line heights

### Components
- Buttons with hover states
- Cards with shadows
- Forms with validation states
- Navigation with active states
- Modals and overlays

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Mobile Optimizations
- Touch-friendly buttons (min 44px)
- Simplified navigation
- Collapsible sections
- Optimized images

## 🚀 Technical Stack

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS v4**: Utility-first styling
- **React Router v7**: Client-side routing
- **next-themes**: Theme management

### UI Libraries
- **Lucide React**: Icon system
- **Recharts**: Data visualization
- **Radix UI**: Accessible components
- **clsx**: Conditional classes

## 📦 Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── Navigation.jsx       # Main navigation
│   │   ├── ThemeToggle.jsx      # Theme switcher
│   │   ├── RootLayout.jsx       # App layout wrapper
│   │   └── NotFound.jsx         # 404 page
│   ├── pages/
│   │   ├── Home.jsx             # Landing page wrapper
│   │   ├── Events.jsx           # Events page wrapper
│   │   ├── Admin.jsx            # Admin dashboard wrapper
│   │   ├── Venues.jsx           # Venues page wrapper
│   │   ├── Finance.jsx          # Finance page wrapper
│   │   └── Reports.jsx          # Reports page wrapper
│   ├── routes.jsx               # Route definitions
│   └── App.jsx                  # Root component
├── imports/
│   ├── LandingPage.jsx          # Landing screen source
│   ├── Authentication.jsx       # Authentication screen source
│   ├── EventDiscoveryDetails.jsx
│   ├── AdminDashboard.jsx
│   ├── VenueVendorManagement.jsx
│   ├── StaffQrCheckIn.jsx
│   ├── AttendeeTicketWallet.jsx
│   ├── FinanceReportingDashboard.jsx
│   └── DetailedExpenseReport.jsx
└── styles/
    ├── theme.css                # Theme variables
    └── fonts.css                # Font imports
```

## 🎯 Key Features by Page

### Landing Page
- Animated hero section
- Event cards with images
- Service highlights with icons
- Trusted by section
- Footer with links

### Event Discovery
- Filter by category, date, location
- Sort options
- Event cards with details
- Quick registration
- Event details modal

### Admin Dashboard
- Live metrics (events, attendees, revenue)
- Interactive charts
- Budget alerts
- Activity timeline
- Quick actions

### Finance Dashboard
- Budget tracking
- Expense breakdown
- Revenue analysis
- Financial alerts
- Export reports

### QR Check-in
- Camera viewfinder
- Real-time scanning
- Check-in statistics
- Manual search
- Staff terminal info

## 🔒 Security Features

- JWT token authentication
- HTTPS enforcement
- XSS protection
- CSRF tokens
- Secure session management

## 🌐 Accessibility

- ARIA labels
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus indicators

## 📊 Performance

- Code splitting
- Lazy loading
- Image optimization
- Caching strategies
- CDN delivery

## 🎨 Customization

### Changing Theme Colors
Edit `/src/styles/theme.css`:
```css
:root {
  --primary: #1132d4; /* Your brand color */
  /* ... other variables */
}
```

### Adding New Pages
1. Create component in `/src/app/pages/`
2. Add route in `/src/app/routes.jsx`
3. Update navigation in `/src/app/components/Navigation.jsx`

## 🤝 Contributing

This project follows the EventZen PRD specifications. All components are designed to be modular and reusable.

## 📝 License

Confidential - EventZen Event Management Platform
