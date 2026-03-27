const { z } = require("zod");

const webhookSubscriptionSchema = z.object({
  eventType: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(8)
});

module.exports = { webhookSubscriptionSchema };
