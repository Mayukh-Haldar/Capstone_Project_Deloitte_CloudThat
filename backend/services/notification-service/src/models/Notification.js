const mongoose = require("mongoose");
const env = require("../config/env");

const channelDeliverySchema = new mongoose.Schema(
  {
    channel: { type: String, required: true },
    status: { type: String, required: true, enum: ["PENDING", "SENT", "FAILED", "SKIPPED"] },
    provider: { type: String, default: null },
    externalId: { type: String, default: null },
    sentAt: { type: Date, default: null },
    failureReason: { type: String, default: null }
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    contentBase64: { type: String, required: true },
    disposition: { type: String, enum: ["attachment", "inline"], default: "attachment" }
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    correlationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    channel: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    html: { type: String, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    status: { type: String, required: true, enum: ["PENDING", "SENT", "FAILED", "READ", "DELETED"], index: true },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    recipients: {
      email: { type: String, default: null },
      phone: { type: String, default: null },
      pushToken: { type: String, default: null },
      webhookUrl: { type: String, default: null }
    },
    deliveries: { type: [channelDeliverySchema], default: [] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + env.retentionDays * 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 }
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = { Notification };
