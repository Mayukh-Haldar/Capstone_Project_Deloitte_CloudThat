const { z } = require("zod");
const { CHANNELS } = require("../constants/channels");

const templateSchema = z.object({
  templateKey: z.string().min(1),
  eventType: z.string().min(1),
  channel: z.enum(CHANNELS),
  locale: z.string().min(2).max(10).default("en"),
  subject: z.string().min(1),
  body: z.string().min(1),
  html: z.string().optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

const updateTemplateSchema = templateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

const previewTemplateSchema = z.object({
  variables: z.record(z.any()).default({})
});

module.exports = { templateSchema, updateTemplateSchema, previewTemplateSchema };
