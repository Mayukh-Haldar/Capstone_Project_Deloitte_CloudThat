const { z } = require("zod");

const preferenceChannelSchema = z.object({
  enabled: z.boolean(),
  eventTypes: z.array(z.string()).default([])
});

const preferenceSchema = z.object({
  email: preferenceChannelSchema.optional(),
  push: preferenceChannelSchema.optional(),
  inApp: preferenceChannelSchema.optional(),
  webhook: preferenceChannelSchema.optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one preference group is required"
});

module.exports = { preferenceSchema };
