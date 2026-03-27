const { z } = require("zod");

const pushTokenSchema = z.object({
  token: z.string().min(16),
  platform: z.string().default("web")
});

module.exports = { pushTokenSchema };
