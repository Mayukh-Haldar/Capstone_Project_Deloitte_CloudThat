const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, default: "web" },
    userAgent: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

pushTokenSchema.index({ userId: 1, isActive: 1 });

const PushToken = mongoose.model("PushToken", pushTokenSchema);

module.exports = { PushToken };
