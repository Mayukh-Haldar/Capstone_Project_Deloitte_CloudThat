const { CHANNEL } = require("./channels");

const TOPIC_CHANNELS = {
  "user.registered": [CHANNEL.EMAIL],
  "user.password.reset": [CHANNEL.EMAIL],
  "registration.confirmed": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "registration.cancelled": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "event.published": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "event.reminder.24h": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "event.reminder.1h": [CHANNEL.PUSH, CHANNEL.IN_APP],
  "event.cancelled": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "event.updated": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "waitlist.promoted": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "payment.received": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "payment.failed": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "budget.alert.threshold": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "venue.booking.confirmed": [CHANNEL.EMAIL, CHANNEL.PUSH, CHANNEL.IN_APP],
  "vendor.contract.signed": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "account-request.approved": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "account-request.rejected": [CHANNEL.EMAIL, CHANNEL.IN_APP],
  "checkin.milestone": [CHANNEL.IN_APP]
};

module.exports = { TOPIC_CHANNELS };
