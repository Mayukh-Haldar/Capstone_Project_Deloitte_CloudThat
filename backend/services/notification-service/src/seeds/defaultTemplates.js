const { CHANNEL } = require("../constants/channels");

const templates = [
  {
    templateKey: "user.registered.EMAIL",
    eventType: "user.registered",
    channel: CHANNEL.EMAIL,
    locale: "en",
    subject: "Welcome to EventZen, {{recipient.userId}}",
    body: "Your EventZen account is ready. Explore events and complete your profile.",
    html: "<h1>Welcome to EventZen</h1><p>Your account is ready.</p>",
    variables: ["recipient.userId"]
  },
  {
    templateKey: "registration.confirmed.EMAIL",
    eventType: "registration.confirmed",
    channel: CHANNEL.EMAIL,
    locale: "en",
    subject: "Registration confirmed for {{metadata.eventName}}",
    body: "Your registration is confirmed. Ticket reference: {{metadata.ticketCode}}",
    html: "<p>Your registration is confirmed for <strong>{{metadata.eventName}}</strong>.</p>",
    variables: ["metadata.eventName", "metadata.ticketCode"]
  },
  {
    templateKey: "payment.received.EMAIL",
    eventType: "payment.received",
    channel: CHANNEL.EMAIL,
    locale: "en",
    subject: "Payment received for {{metadata.eventName}}",
    body: "We received {{metadata.amount}}. Transaction {{metadata.transactionId}}",
    html: "<p>Payment received: <strong>{{metadata.amount}}</strong></p>",
    variables: ["metadata.amount", "metadata.transactionId"]
  },
  {
    templateKey: "budget.alert.threshold.IN_APP",
    eventType: "budget.alert.threshold",
    channel: CHANNEL.IN_APP,
    locale: "en",
    subject: "Budget alert for {{metadata.eventName}}",
    body: "Budget usage crossed {{metadata.threshold}}%",
    variables: ["metadata.eventName", "metadata.threshold"]
  },
  {
    templateKey: "event.reminder.24h.IN_APP",
    eventType: "event.reminder.24h",
    channel: CHANNEL.IN_APP,
    locale: "en",
    subject: "{{metadata.eventName}} starts in 24 hours",
    body: "Venue: {{metadata.venueName}}. Gate: {{metadata.gate}}",
    variables: ["metadata.eventName", "metadata.venueName", "metadata.gate"]
  }
];

module.exports = { templates };
