import { useState } from "react";
import { Link } from "react-router";
import {
  Search, ChevronDown, ChevronUp, Ticket, CreditCard, Calendar,
  Users, Bell, ShieldCheck, Mail, MessageCircle, ExternalLink
} from "lucide-react";

const faqs = [
  {
    category: "Tickets & Registration",
    icon: Ticket,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    items: [
      {
        q: "How do I register for an event?",
        a: "Browse events on the Events page, click on the one you'd like to attend, select your ticket tier, then click 'Register Now'. If the event requires payment you'll be directed to our secure Razorpay checkout. Free events are confirmed immediately."
      },
      {
        q: "Can I register for the same event twice?",
        a: "No. EventZen prevents duplicate registrations for the same event. If you already hold an active ticket you'll see an 'Already Registered' badge and the registration button will be disabled."
      },
      {
        q: "Where can I find my tickets?",
        a: "All your active passes live in My Tickets (top navigation bar). Each card shows the event name, date, venue, ticket tier, and a signed QR payload for venue check-in."
      },
      {
        q: "How do I cancel my registration?",
        a: "To cancel a registration, contact the event organiser directly or reach our support team at contact@eventzen.com with your ticket number."
      }
    ]
  },
  {
    category: "Payments & Billing",
    icon: CreditCard,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    items: [
      {
        q: "What payment methods are supported?",
        a: "EventZen uses Razorpay for secure online payments, which supports UPI, credit/debit cards, net banking, and popular wallets. For corporate bookings, BANK_TRANSFER is also available on request."
      },
      {
        q: "Is my payment information safe?",
        a: "Yes. We never store your card details. All payment data is handled exclusively by Razorpay, a PCI-DSS compliant payment gateway. EventZen only stores the payment status and a reference ID."
      },
      {
        q: "My payment failed — what happens to my registration?",
        a: "If payment fails or you dismiss the payment window, your pending registration is automatically cancelled and the seat is released. You can try registering again from the event page."
      },
      {
        q: "How do I get an invoice?",
        a: "After a successful payment, an invoice is generated automatically and linked to your registration in My Registrations. You can download it as a PDF from there."
      }
    ]
  },
  {
    category: "Events & Agenda",
    icon: Calendar,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    items: [
      {
        q: "How do I discover upcoming events?",
        a: "Visit the Events page. You can filter by category, date range, location, and price, or use the search bar. The home page also features a curated carousel of upcoming public events."
      },
      {
        q: "What do the event status badges mean?",
        a: "'Registration Open' means seats are available. 'Coming Soon' means the event is published but registration hasn't opened yet. 'Sold Out' means all tickets are taken — you may join the waitlist. 'Published Event' is the general published state."
      },
      {
        q: "Can I join a waitlist?",
        a: "Yes. On sold-out events with waitlist enabled, you'll see a 'Join Waitlist' option. You'll be notified automatically if a seat becomes available."
      }
    ]
  },
  {
    category: "Account & Notifications",
    icon: Bell,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    items: [
      {
        q: "How do I update my profile?",
        a: "Go to Settings → Account Settings to update your full name, email, and phone number. Keeping your phone number up to date is required for auto-fill during checkout."
      },
      {
        q: "Can I enable push notifications?",
        a: "Yes. In Settings → Notifications you can enable browser push notifications. You'll receive real-time alerts for registration updates, payment confirmations, and event reminders."
      },
      {
        q: "How do I set up two-factor authentication (MFA)?",
        a: "Navigate to Settings → Account Settings and scroll to the MFA section. Scan the QR code with an authenticator app (e.g. Google Authenticator or Authy), enter the 6-digit code, and click 'Verify MFA Setup'."
      },
      {
        q: "How do I delete my account?",
        a: "Under Settings → Account Settings → Account Requests, submit a 'Delete Request'. This is a GDPR right-to-erasure request reviewed by an administrator. Once approved, your data is anonymised per our Privacy Policy."
      }
    ]
  }
];

const guides = [
  { title: "Getting Started with EventZen", desc: "Create your account, explore events, and register for your first pass in minutes.", icon: "🚀" },
  { title: "Organiser Quick-Start Guide", desc: "Create events, set ticket tiers, manage vendors, and track attendance in real time.", icon: "📋" },
  { title: "QR Code Check-In for Venues", desc: "Learn how venue staff use the Check-In tool to scan tickets and verify attendance.", icon: "🔍" },
  { title: "Understanding Your Ticket Wallet", desc: "Digital passes, QR payloads, seat information, and how to present them at the door.", icon: "🎟" },
  { title: "Razorpay Payment Walkthrough", desc: "Step-by-step guide to completing a payment and resolving common gateway issues.", icon: "💳" },
  { title: "Managing Notifications & Preferences", desc: "Configure email, push, and in-app channels so you only receive the alerts you want.", icon: "🔔" },
];

export function HelpCenter() {
  const [openItems, setOpenItems] = useState({});
  const [search, setSearch] = useState("");

  const toggle = (key) => setOpenItems((s) => ({ ...s, [key]: !s[key] }));

  const filteredFaqs = faqs.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        !search ||
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => !search || cat.items.length > 0);

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1132d4] via-[#1e40d8] to-[#3b5cf6] px-4 py-20 text-center text-white">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Support</p>
        <h1 className="mb-4 text-4xl font-black tracking-tight sm:text-5xl">How can we help you?</h1>
        <p className="mx-auto mb-8 max-w-xl text-base text-blue-100">
          Search our knowledge base, browse FAQs, or reach out to our support team directly.
        </p>
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <Search className="size-5 shrink-0 text-blue-200" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for answers…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-blue-200 outline-none"
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16 sm:px-6 lg:px-8">
        {/* Guides */}
        {!search && (
          <section>
            <h2 className="mb-6 text-2xl font-bold">Popular Guides</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <div
                  key={guide.title}
                  className="flex gap-4 rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75"
                >
                  <span className="text-2xl">{guide.icon}</span>
                  <div>
                    <p className="font-semibold">{guide.title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{guide.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQs */}
        <section>
          <h2 className="mb-8 text-2xl font-bold">{search ? `Search results for "${search}"` : "Frequently Asked Questions"}</h2>
          {filteredFaqs.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400">No results found. Try a different search term or contact our support team.</p>
          )}
          <div className="space-y-8">
            {filteredFaqs.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.category}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`rounded-xl p-2 ${cat.color}`}><Icon className="size-5" /></span>
                    <h3 className="text-lg font-bold">{cat.category}</h3>
                  </div>
                  <div className="space-y-3">
                    {cat.items.map((item, idx) => {
                      const key = `${cat.category}-${idx}`;
                      const open = !!openItems[key];
                      return (
                        <div key={key} className="rounded-2xl border border-black/10 bg-white/85 shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
                          <button
                            onClick={() => toggle(key)}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                          >
                            <span className="font-semibold">{item.q}</span>
                            {open ? <ChevronUp className="size-4 shrink-0 text-slate-400" /> : <ChevronDown className="size-4 shrink-0 text-slate-400" />}
                          </button>
                          {open && (
                            <p className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:text-slate-300">
                              {item.a}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
          <div className="flex items-center gap-3 mb-6">
            <span className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><MessageCircle className="size-5" /></span>
            <div>
              <h2 className="text-xl font-bold">Still need help?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Our support team usually responds within one business day.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="mailto:contact@eventzen.com"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#1132d4]/40 dark:border-white/10"
            >
              <Mail className="size-5 text-[#1132d4] dark:text-[#7aa3ff]" />
              <div>
                <p className="font-semibold text-sm">Email Support</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">contact@eventzen.com</p>
              </div>
              <ExternalLink className="ml-auto size-4 text-slate-400" />
            </a>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold text-sm">Secure & Confidential</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">All queries handled per our Privacy Policy.</p>
              </div>
              <Link to="/privacy" className="ml-auto text-xs font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">
                Read policy
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
