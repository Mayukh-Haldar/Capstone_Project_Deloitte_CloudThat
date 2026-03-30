import { Link } from "react-router";
import { ShieldCheck } from "lucide-react";

const EFFECTIVE_DATE = "March 30, 2026";
const COMPANY = "EventZen";

const sections = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: [
      {
        subtitle: "1.1 Information You Provide Directly",
        text: "When you create an account, register for events, or contact us, we collect: full name, email address, phone number, billing information (processed securely by Razorpay — we never store card details), event preferences and notes, and any messages you send to our support team."
      },
      {
        subtitle: "1.2 Information Collected Automatically",
        text: "When you use EventZen we automatically collect: IP address, browser type and version, operating system, pages visited and time spent, referring URLs, device identifiers, and cookie/session data. This information is used for security, analytics, and improving platform performance."
      },
      {
        subtitle: "1.3 Information from Third Parties",
        text: "If you sign in using a third-party provider (e.g. Google OAuth), we receive your name and email address from that provider in accordance with your permissions. We do not receive your password."
      }
    ]
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: [
      {
        subtitle: "",
        text: "We use the information we collect to: create and manage your EventZen account; process event registrations and payments; send transactional notifications (booking confirmations, payment receipts, event reminders); send newsletter updates if you subscribed (you may unsubscribe at any time); detect and prevent fraud and unauthorised access; comply with legal obligations; and improve our platform through anonymised analytics."
      }
    ]
  },
  {
    id: "legal-basis",
    title: "3. Legal Basis for Processing (GDPR)",
    content: [
      {
        subtitle: "",
        text: "If you are located in the European Economic Area (EEA), we process your personal data under the following legal bases: (a) Contract — to fulfil a registration or payment you have initiated; (b) Legitimate Interests — to operate and secure our platform; (c) Consent — when you explicitly opt in to marketing communications; (d) Legal Obligation — to comply with applicable laws and regulations."
      }
    ]
  },
  {
    id: "data-sharing",
    title: "4. Data Sharing & Disclosure",
    content: [
      {
        subtitle: "4.1 Service Providers",
        text: "We share data with trusted third-party processors solely to operate our services: Razorpay (payment processing), Firebase (push notifications), cloud hosting providers, and email delivery services. All processors are bound by data processing agreements."
      },
      {
        subtitle: "4.2 Event Organisers",
        text: "When you register for an event, the organiser receives your name, email, phone number, and ticket details for the purpose of event management and check-in. Organisers are prohibited from using this data for unrelated marketing."
      },
      {
        subtitle: "4.3 Legal Requirements",
        text: "We may disclose your information when required by law, court order, or governmental authority, or to protect the rights, property, or safety of EventZen, its users, or the public."
      },
      {
        subtitle: "4.4 No Sale of Personal Data",
        text: "We do not sell, rent, or trade your personal information to third parties for their own marketing purposes."
      }
    ]
  },
  {
    id: "data-retention",
    title: "5. Data Retention",
    content: [
      {
        subtitle: "",
        text: "We retain your account data for as long as your account is active. If you request account deletion, we anonymise your personal data within 30 days of approval, retaining only aggregated, non-identifiable records required for legal and financial compliance. Payment records are retained for 7 years as required by Indian tax law."
      }
    ]
  },
  {
    id: "your-rights",
    title: "6. Your Rights",
    content: [
      {
        subtitle: "",
        text: "Depending on your jurisdiction you may have the right to: access a copy of your personal data; correct inaccurate data; request deletion (right to erasure); restrict or object to processing; data portability; and withdraw consent at any time without affecting prior processing. To exercise any of these rights, submit a request under Settings → Account Settings → Account Requests or email us at contact@eventzen.com."
      }
    ]
  },
  {
    id: "cookies",
    title: "7. Cookies",
    content: [
      {
        subtitle: "",
        text: `We use cookies and similar tracking technologies to maintain session state, remember your preferences, and analyse platform usage. Please review our Cookie Policy for full details.`
      }
    ]
  },
  {
    id: "security",
    title: "8. Security",
    content: [
      {
        subtitle: "",
        text: "We implement industry-standard security measures including HTTPS/TLS encryption in transit, bcrypt password hashing, JWT-based authentication with short-lived access tokens, optional MFA (TOTP), rate limiting, and regular security audits. Despite these measures, no system is completely immune to breaches. We will notify affected users promptly in the event of a data incident."
      }
    ]
  },
  {
    id: "children",
    title: "9. Children's Privacy",
    content: [
      {
        subtitle: "",
        text: "EventZen is not directed to individuals under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly."
      }
    ]
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    content: [
      {
        subtitle: "",
        text: "We may update this Privacy Policy from time to time. When we do, we will revise the 'Effective Date' above and, for material changes, notify you via email or an in-app notification. Continued use of EventZen after the effective date constitutes acceptance of the revised policy."
      }
    ]
  },
  {
    id: "contact",
    title: "11. Contact Us",
    content: [
      {
        subtitle: "",
        text: "For any privacy-related enquiries, please contact our data protection team: Email: contact@eventzen.com · Address: 123 Event Street, San Francisco, CA 94102."
      }
    ]
  }
];

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <div className="border-b border-black/10 bg-white/85 px-4 py-16 backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            <ShieldCheck className="size-3.5" />
            Privacy
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400">
            Effective date: <strong className="text-slate-700 dark:text-slate-200">{EFFECTIVE_DATE}</strong>
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {COMPANY} ("we", "us", or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, share, and safeguard your data when you use our platform.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:flex lg:gap-12">
        {/* Table of contents */}
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
        <article className="flex-1 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
              <h2 className="mb-4 text-xl font-bold">{section.title}</h2>
              <div className="space-y-4">
                {section.content.map((block, i) => (
                  <div key={i}>
                    {block.subtitle && <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{block.subtitle}</h3>}
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{block.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-6 dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              For questions about this policy, email us at{" "}
              <a href="mailto:contact@eventzen.com" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">
                contact@eventzen.com
              </a>{" "}
              or review our{" "}
              <Link to="/cookies" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">
                Terms of Service
              </Link>.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
