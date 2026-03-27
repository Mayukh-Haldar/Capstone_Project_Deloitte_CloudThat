const mongoose = require("mongoose");

const webhookSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    url: { type: String, required: true },
    secret: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const WebhookSubscription = mongoose.model("WebhookSubscription", webhookSubscriptionSchema);

module.exports = { WebhookSubscription };
