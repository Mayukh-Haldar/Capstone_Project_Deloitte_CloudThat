const mongoose = require("mongoose");

const templateVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    html: { type: String, default: null },
    variables: { type: [String], default: [] },
    updatedBy: { type: String, default: "system" },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const notificationTemplateSchema = new mongoose.Schema(
  {
    templateKey: { type: String, required: true, unique: true },
    eventType: { type: String, required: true, index: true },
    channel: { type: String, required: true, index: true },
    locale: { type: String, required: true, default: "en" },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    html: { type: String, default: null },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    versions: { type: [templateVersionSchema], default: [] }
  },
  { timestamps: true }
);

notificationTemplateSchema.index({ eventType: 1, channel: 1, locale: 1 });

const NotificationTemplate = mongoose.model("NotificationTemplate", notificationTemplateSchema);

module.exports = { NotificationTemplate };
