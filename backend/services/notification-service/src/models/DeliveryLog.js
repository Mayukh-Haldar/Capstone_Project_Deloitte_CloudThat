const mongoose = require("mongoose");

const deliveryLogSchema = new mongoose.Schema(
  {
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", required: true, index: true },
    correlationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    channel: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    status: { type: String, required: true, enum: ["SUCCESS", "FAILED", "SKIPPED"] },
    responseCode: { type: String, default: null },
    responseMessage: { type: String, default: null },
    attemptNumber: { type: Number, default: 1 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    sentAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

deliveryLogSchema.index({ channel: 1, sentAt: -1 });

const DeliveryLog = mongoose.model("DeliveryLog", deliveryLogSchema);

module.exports = { DeliveryLog };
