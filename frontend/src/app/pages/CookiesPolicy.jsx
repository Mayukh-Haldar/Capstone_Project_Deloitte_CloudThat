import { Link } from "react-router";
import { Cookie } from "lucide-react";

const EFFECTIVE_DATE = "March 30, 2026";

const cookieTypes = [
  {
    name: "Strictly Necessary",
    required: true,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    description: "These cookies are essential for the Platform to function. They cannot be disabled.",
    examples: [
      { name: "session_token", purpose: "Maintains your authenticated session so you do not need to log in on every page.", duration: "Until logout or 30-day inactivity" },
      { name: "csrf_token", purpose: "Protects against cross-site request forgery attacks.", duration: "Session" },
      { name: "auth_refresh", purpose: "Stores a short-lived refresh token to re-issue access tokens transparently.", duration: "7 days" },
    ]
  },
  {
    name: "Functional",
    required: false,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    description: "These cookies remember your preferences and personalise your experience.",
    examples: [
      { name: "theme_preference", purpose: "Remembers whether you have selected Light or Dark mode.", duration: "1 year" },
      { name: "portal_last_view", purpose: "Stores the last portal (Customer / Vendor / Admin) you visited.", duration: "30 days" },
      { name: "notification_dismissed", purpose: "Tracks which in-app banners you have dismissed.", duration: "90 days" },
    ]
  },
  {
    name: "Analytics",
    required: false,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    description: "These cookies help us understand how the Platform is used so we can improve it. All data is anonymised.",
    examples: [
      { name: "_event_session_id", purpose: "Anonymous session identifier used to aggregate usage metrics.", duration: "30 minutes (rolling)" },
      { name: "perf_timing", purpose: "Captures page-load timings to identify performance bottlenecks.", duration: "Session" },
    ]
  },
  {
    name: "Third-Party / Payment",
    required: true,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    description: "Set by Razorpay when you proceed to payment. These are governed by Razorpay's own Cookie Policy.",
    examples: [
      { name: "rzp_*", purpose: "Set by Razorpay to maintain payment session state during checkout.", duration: "Session" },
    ]
  }
];

const sections = [
  {
    id: "what-are-cookies",
    title: "1. What Are Cookies?",
    text: "Cookies are small text files that a website stores on your device when you visit. They allow the website to recognise your device on future visits and store information such as your preferences and session state. Similar technologies include localStorage, sessionStorage, and browser fingerprinting — we use these in limited ways as described below."
  },
  {
    id: "how-we-use",
    title: "2. How EventZen Uses Cookies",
    text: "We use cookies for three primary purposes: (a) to keep you logged in and protect your session; (b) to remember your preferences (such as dark mode and portal selection); and (c) to gather anonymised analytics to improve platform performance. We do not use cookies for behavioural advertising or to track you across third-party websites."
  },
  {
    id: "cookie-types",
    title: "3. Types of Cookies We Use",
    text: ""
  },
  {
    id: "local-storage",
    title: "4. Local Storage & Session Storage",
    text: "In addition to cookies, EventZen uses browser localStorage to persist your authentication tokens and theme preference across browser sessions. sessionStorage is used for transient checkout state (e.g. temporarily storing seat selection data). This data never leaves your device and is not transmitted to third-party servers."
  },
  {
    id: "managing-cookies",
    title: "5. Managing & Disabling Cookies",
    text: "You can control cookies through your browser settings. Most browsers allow you to refuse cookies, delete existing cookies, or be notified when cookies are set. Please note that disabling strictly necessary cookies will impair core Platform functionality including authentication. For instructions specific to your browser, refer to its help documentation."
  },
  {
    id: "firebase",
    title: "6. Firebase & Push Notifications",
    text: "If you enable push notifications, the Firebase SDK stores a push registration token in your browser. This token is used solely to deliver personalised in-app and push notifications. You can revoke this at any time from Settings → Notifications → Manage Push Tokens."
  },
  {
    id: "consent",
    title: "7. Your Consent",
    text: "By using EventZen you consent to the use of strictly necessary and payment cookies as described in this policy. Functional and analytics cookies are used by default to improve your experience; you can opt out by clearing your cookies and not re-enabling the relevant features. We will implement a granular cookie consent banner in a future platform release."
  },
  {
    id: "changes",
    title: "8. Changes to This Policy",
    text: "We may update this Cookie Policy when we introduce new features or change our third-party services. The effective date at the top of this page will be updated. For significant changes, we will notify users via email or an in-app alert."
  },
  {
    id: "contact",
    title: "9. Contact",
    text: "For cookie-related questions or requests, please contact us at: contact@eventzen.com."
  }
];

export function CookiesPolicy() {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <div className="border-b border-black/10 bg-white/85 px-4 py-16 backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Cookie className="size-3.5" />
            Cookies
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Cookie Policy</h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400">
            Effective date: <strong className="text-slate-700 dark:text-slate-200">{EFFECTIVE_DATE}</strong>
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            This Cookie Policy explains how EventZen uses cookies and similar tracking technologies on our platform, and what choices you have.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:flex lg:gap-12">
        {/* TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Contents</p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-100"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="flex-1 space-y-6">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
              <h2 className="mb-3 text-xl font-bold">{section.title}</h2>

              {section.id === "cookie-types" ? (
                <div className="space-y-4">
                  {cookieTypes.map((type) => (
                    <div key={type.name} className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                      <div className="flex items-center gap-3 p-4 bg-slate-50/80 dark:bg-white/5">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${type.color}`}>{type.name}</span>
                        {type.required && <span className="text-xs text-slate-500 dark:text-slate-400">Always active</span>}
                      </div>
                      <div className="p-4">
                        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{type.description}</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-white/10">
                                <th className="pb-2 pr-4 text-left font-semibold text-slate-500">Name</th>
                                <th className="pb-2 pr-4 text-left font-semibold text-slate-500">Purpose</th>
                                <th className="pb-2 text-left font-semibold text-slate-500">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {type.examples.map((ex) => (
                                <tr key={ex.name} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                                  <td className="py-2 pr-4 font-mono font-semibold text-slate-700 dark:text-slate-200">{ex.name}</td>
                                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{ex.purpose}</td>
                                  <td className="py-2 text-slate-500">{ex.duration}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{section.text}</p>
              )}
            </section>
          ))}

          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This policy is part of our broader{" "}
              <Link to="/privacy" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">Privacy Policy</Link>.
              For general questions, visit our{" "}
              <Link to="/help" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">Help Center</Link>{" "}
              or read our{" "}
              <Link to="/terms" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">Terms of Service</Link>.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
