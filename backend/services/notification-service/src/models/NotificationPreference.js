const mongoose = require("mongoose");

const preferenceChannelSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    eventTypes: { type: [String], default: [] }
  },
  { _id: false }
);

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: preferenceChannelSchema, default: () => ({ enabled: true, eventTypes: [] }) },
    push: { type: preferenceChannelSchema, default: () => ({ enabled: true, eventTypes: [] }) },
    inApp: { type: preferenceChannelSchema, default: () => ({ enabled: true, eventTypes: [] }) },
    webhook: { type: preferenceChannelSchema, default: () => ({ enabled: true, eventTypes: [] }) }
  },
  { timestamps: true }
);

const NotificationPreference = mongoose.model("NotificationPreference", notificationPreferenceSchema);

module.exports = { NotificationPreference };
