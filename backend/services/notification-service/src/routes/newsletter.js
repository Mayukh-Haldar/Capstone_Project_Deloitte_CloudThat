const express = require("express");
const { z } = require("zod");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/apiError");
const { sendEmail } = require("../providers/emailProvider");
const { NewsletterSubscriber } = require("../models/NewsletterSubscriber");

const router = express.Router();

const subscribeSchema = z.object({
  email: z.string().email("A valid email address is required")
});

const buildNewsletterHtml = (email) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to EventZen Newsletter</title>
  <style>
    body { margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 620px; margin: 40px auto; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .hero { background: linear-gradient(135deg, #1132d4 0%, #3b5cf6 60%, #6366f1 100%); padding: 48px 40px 40px; text-align: center; }
    .hero-logo { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .hero-logo-icon { width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: inline-block; line-height: 40px; font-size: 22px; }
    .hero-logo-name { color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
    .hero h1 { color: #ffffff; font-size: 28px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.5px; }
    .hero p { color: rgba(255,255,255,0.85); font-size: 15px; margin: 0; line-height: 1.6; }
    .body { padding: 40px; }
    .greeting { font-size: 16px; color: #1e293b; margin: 0 0 20px; line-height: 1.6; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #1132d4; margin: 32px 0 16px; }
    .feature-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 12px; margin: 0 -12px; }
    .feature-cell { display: table-cell; width: 50%; vertical-align: top; }
    .feature-box { background: #f8faff; border: 1px solid #e0e7ff; border-radius: 12px; padding: 18px; }
    .feature-icon { font-size: 24px; margin-bottom: 10px; display: block; }
    .feature-title { font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 6px; }
    .feature-desc { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; }
    .highlight-box { background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%); border: 1px solid #c7d2fe; border-radius: 12px; padding: 24px; margin: 28px 0; }
    .highlight-box h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 8px; }
    .highlight-box p { font-size: 14px; color: #475569; margin: 0 0 18px; line-height: 1.6; }
    .cta-btn { display: inline-block; background: #1132d4; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; letter-spacing: 0.2px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0; }
    .tip-list { list-style: none; padding: 0; margin: 0; }
    .tip-list li { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 14px; font-size: 14px; color: #475569; line-height: 1.5; }
    .tip-list li::before { content: "✓"; color: #1132d4; font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .footer { background: #f8faff; padding: 28px 40px; text-align: center; border-top: 1px solid #e0e7ff; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0 0 6px; line-height: 1.6; }
    .footer a { color: #1132d4; text-decoration: none; }
    .social-row { margin: 16px 0 0; }
    .social-badge { display: inline-block; background: #e0e7ff; color: #1132d4; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 10px; margin: 0 3px; }
    @media (max-width: 480px) {
      .body { padding: 24px; }
      .hero { padding: 32px 24px; }
      .hero h1 { font-size: 22px; }
      .feature-grid, .feature-cell { display: block; width: 100%; }
      .feature-cell { margin-bottom: 12px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <!-- Hero -->
      <div class="hero">
        <div class="hero-logo">
          <span class="hero-logo-icon">🎟</span>
          <span class="hero-logo-name">EventZen</span>
        </div>
        <h1>You're in the Loop! 🎉</h1>
        <p>Welcome to the EventZen newsletter — your front-row seat to the world of intelligent event management.</p>
      </div>

      <!-- Body -->
      <div class="body">
        <p class="greeting">
          Hi there,<br /><br />
          Thanks for subscribing with <strong>${email}</strong>. We'll send you curated insights, platform updates, and event-industry trends right to your inbox. Here's a taste of what to expect:
        </p>

        <div class="section-title">What's New on EventZen</div>
        <div class="feature-grid">
          <div class="feature-cell">
            <div class="feature-box">
              <span class="feature-icon">🤖</span>
              <p class="feature-title">AI-Assisted Planning</p>
              <p class="feature-desc">Smart recommendations for venues, budgets, and schedules — powered by your event data.</p>
            </div>
          </div>
          <div class="feature-cell">
            <div class="feature-box">
              <span class="feature-icon">📊</span>
              <p class="feature-title">Real-Time Analytics</p>
              <p class="feature-desc">Live dashboards to track registrations, revenue, and attendee engagement as they happen.</p>
            </div>
          </div>
        </div>
        <div class="feature-grid" style="margin-top:12px">
          <div class="feature-cell">
            <div class="feature-box">
              <span class="feature-icon">🏛️</span>
              <p class="feature-title">Venue Marketplace</p>
              <p class="feature-desc">Browse, compare, and book verified venues with transparent pricing and instant availability.</p>
            </div>
          </div>
          <div class="feature-cell">
            <div class="feature-box">
              <span class="feature-icon">🔔</span>
              <p class="feature-title">Smart Notifications</p>
              <p class="feature-desc">Multi-channel alerts via email, push, and in-app so your team and attendees are always informed.</p>
            </div>
          </div>
        </div>

        <hr class="divider" />

        <div class="section-title">Tips &amp; Best Practices</div>
        <ul class="tip-list">
          <li>Set up your event at least 4 weeks in advance to give attendees time to register.</li>
          <li>Use ticket tiers (Early Bird, Standard, VIP) to boost early registrations and revenue.</li>
          <li>Enable waitlists — they automatically convert when seats become available.</li>
          <li>Review your financial dashboard weekly to keep spend aligned with your budget.</li>
        </ul>

        <div class="highlight-box">
          <h3>🚀 Ready to plan your next event?</h3>
          <p>Log in to EventZen and create your first event in minutes. Our step-by-step wizard covers every detail — from ticket types to vendor bookings.</p>
          <a href="http://localhost" class="cta-btn">Go to EventZen →</a>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>You're receiving this because you subscribed at <strong>eventzen.com</strong>.</p>
        <p>EventZen · 123 Event Street, San Francisco, CA 94102</p>
        <p style="margin-top:10px"><a href="#">Unsubscribe</a> &nbsp;·&nbsp; <a href="#">Privacy Policy</a> &nbsp;·&nbsp; <a href="#">Terms of Service</a></p>
        <div class="social-row">
          <span class="social-badge">Instagram</span>
          <span class="social-badge">LinkedIn</span>
          <span class="social-badge">Twitter</span>
        </div>
        <p style="margin-top:14px;font-size:11px;color:#cbd5e1">© 2026 EventZen. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

router.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const result = subscribeSchema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "VALIDATION_ERROR", result.error.errors[0].message);
    }

    const { email } = result.data;

    const existing = await NewsletterSubscriber.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(200).json({
        message: "You're already subscribed! Check your inbox for the welcome email we sent earlier."
      });
    }

    await NewsletterSubscriber.create({ email: email.toLowerCase() });

    await sendEmail({
      to: email,
      subject: "Welcome to EventZen — You're in the Loop! 🎉",
      text: `Hi there!\n\nThanks for subscribing to the EventZen newsletter with ${email}.\n\nYou'll receive the latest event management trends, platform updates, and exclusive insights right to your inbox.\n\nVisit us at: http://localhost\n\n© 2026 EventZen. All rights reserved.`,
      html: buildNewsletterHtml(email)
    });

    res.status(200).json({
      message: "Subscribed successfully! Check your inbox for a welcome email from EventZen."
    });
  })
);

module.exports = router;
