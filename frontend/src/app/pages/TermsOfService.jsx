import { Link } from "react-router";
import { Scale } from "lucide-react";

const EFFECTIVE_DATE = "March 30, 2026";

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    text: "By accessing or using EventZen (the 'Platform'), you confirm that you are at least 13 years old, that you have read and understood these Terms of Service ('Terms'), and that you agree to be bound by them. If you do not agree, please do not use the Platform. Continued use of any feature after any revision of these Terms constitutes acceptance of the changes."
  },
  {
    id: "account",
    title: "2. Account Registration",
    text: "To access certain features you must create an account. You agree to: (a) provide accurate, current, and complete registration information; (b) maintain the security of your credentials and not share your password with others; (c) notify us immediately of any unauthorised access to your account; and (d) be responsible for all activities that occur under your account. We reserve the right to suspend or terminate accounts that violate these Terms."
  },
  {
    id: "use",
    title: "3. Permitted Use",
    text: "You may use EventZen solely for lawful purposes in accordance with these Terms. You agree not to: (a) copy, reproduce, or distribute any Platform content without permission; (b) attempt to reverse-engineer, disassemble, or exploit any part of the Platform; (c) use automated bots, scrapers, or scripts to access the Platform without authorisation; (d) post content that is unlawful, defamatory, harassing, fraudulent, or harmful; (e) impersonate any person or entity; or (f) upload malware or any software that could damage or interfere with Platform operations."
  },
  {
    id: "events",
    title: "4. Events & Registrations",
    text: "EventZen provides a marketplace where event organisers publish events and attendees register. We do not organise or own the events listed. Organisers are solely responsible for their event content, accuracy, and delivery. By registering for an event you enter into an agreement directly with the organiser. EventZen acts as an intermediary facilitating ticket issuance and payment processing."
  },
  {
    id: "payments",
    title: "5. Payments & Fees",
    text: "Paid event registrations are processed through Razorpay, a third-party payment gateway. By submitting payment you agree to Razorpay's Terms of Service and Privacy Policy in addition to ours. EventZen displays a breakdown of the ticket price, applicable taxes (currently 8%), and the final total before payment is initiated. If a payment fails or is cancelled by you, the associated registration is automatically removed and any temporary seat hold is released. We do not charge additional platform fees beyond the displayed total at this time."
  },
  {
    id: "cancellation",
    title: "6. Cancellations",
    text: "If you wish to cancel a registration, contact the event organiser directly using the contact details on the event page. For payment disputes, you may also contact Razorpay's grievance team. Fraudulent chargebacks may result in account suspension."
  },
  {
    id: "content",
    title: "7. User-Generated Content",
    text: "You retain ownership of any content you submit (e.g. event notes, registration messages). By submitting content you grant EventZen a non-exclusive, royalty-free, worldwide licence to use, store, and display that content solely to operate and improve the Platform. You represent that you have all rights necessary to grant this licence and that your content does not violate any third-party rights."
  },
  {
    id: "ip",
    title: "8. Intellectual Property",
    text: "All Platform content, design, trademarks, logos, and software are the property of EventZen or its licensors and are protected by applicable intellectual property laws. Nothing in these Terms grants you a right to use EventZen's trademarks or branding without prior written consent."
  },
  {
    id: "disclaimer",
    title: "9. Disclaimer of Warranties",
    text: "The Platform is provided 'AS IS' and 'AS AVAILABLE' without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Platform will be uninterrupted, error-free, or free of viruses. Your use of the Platform is at your sole risk."
  },
  {
    id: "liability",
    title: "10. Limitation of Liability",
    text: "To the maximum extent permitted by law, EventZen and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising from your use of or inability to use the Platform. EventZen's total aggregate liability for any claim arising out of these Terms shall not exceed the amount you paid to EventZen in the 12 months preceding the event giving rise to the claim."
  },
  {
    id: "indemnification",
    title: "11. Indemnification",
    text: "You agree to defend, indemnify, and hold harmless EventZen and its affiliates, officers, agents, and employees from and against any claims, liabilities, damages, judgments, and expenses (including reasonable legal fees) arising out of or relating to: (a) your use of the Platform; (b) your violation of these Terms; or (c) any content you submit or actions you take on the Platform."
  },
  {
    id: "termination",
    title: "12. Termination",
    text: "We may suspend or terminate your access to the Platform at any time, with or without cause, with or without notice. Reasons for termination include (but are not limited to) violation of these Terms, fraudulent activity, or extended account inactivity. Upon termination, your right to use the Platform ceases immediately. Sections relating to intellectual property, disclaimers, limits of liability, and governing law survive termination."
  },
  {
    id: "governing-law",
    title: "13. Governing Law & Dispute Resolution",
    text: "These Terms are governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict-of-law provisions. Any dispute arising from these Terms shall first be addressed through good-faith negotiation. If unresolved, disputes shall be subject to binding arbitration in San Francisco, CA, under the rules of the American Arbitration Association, except that either party may seek injunctive relief in court for intellectual property violations."
  },
  {
    id: "changes",
    title: "14. Changes to These Terms",
    text: "We reserve the right to modify these Terms at any time. Material changes will be communicated via email or an in-app banner at least 14 days before they take effect. Your continued use of EventZen after the effective date of the revised Terms constitutes your acceptance."
  },
  {
    id: "contact",
    title: "15. Contact",
    text: "For legal enquiries related to these Terms, contact us at: contact@eventzen.com · 123 Event Street, San Francisco, CA 94102."
  }
];

export function TermsOfService() {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <div className="border-b border-black/10 bg-white/85 px-4 py-16 backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
            <Scale className="size-3.5" />
            Legal
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400">
            Effective date: <strong className="text-slate-700 dark:text-slate-200">{EFFECTIVE_DATE}</strong>
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Please read these Terms of Service carefully before using the EventZen platform. They set out your rights and responsibilities as a user.
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
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm dark:border-white/10 dark:bg-[#0f1e3d]/75"
            >
              <h2 className="mb-3 text-xl font-bold">{section.title}</h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{section.text}</p>
            </section>
          ))}

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              These Terms should be read alongside our{" "}
              <Link to="/privacy" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">Privacy Policy</Link>{" "}
              and{" "}
              <Link to="/cookies" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">Cookie Policy</Link>.
              If you have questions, visit our{" "}
              <Link to="/help" className="font-semibold text-[#1132d4] dark:text-[#7aa3ff] hover:underline">Help Center</Link>.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
