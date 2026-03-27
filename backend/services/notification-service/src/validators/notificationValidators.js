const { z } = require("zod");
const { CHANNELS } = require("../constants/channels");

const recipientSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
  pushToken: z.string().min(8).optional(),
  webhookUrl: z.string().url().optional(),
  locale: z.string().min(2).max(10).optional()
});

const attachmentSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1).optional(),
  contentBase64: z.string().min(1),
  disposition: z.enum(["attachment", "inline"]).optional()
});

const sendNotificationSchema = z.object({
  correlationId: z.string().min(1).optional(),
  eventType: z.string().min(1),
  channels: z.array(z.enum(CHANNELS)).min(1).optional(),
  recipients: z.array(recipientSchema).min(1),
  templateKey: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
  attachments: z.array(attachmentSchema).optional(),
  metadata: z.record(z.any()).optional(),
  variables: z.record(z.any()).optional()
});

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(0).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
  channel: z.enum(CHANNELS).optional(),
  eventType: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional()
});

const markReadSchema = z.object({
  read: z.boolean().default(true)
});

module.exports = {
  sendNotificationSchema,
  listNotificationsQuerySchema,
  markReadSchema
};
