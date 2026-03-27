const { z } = require("zod");

const uuidSchema = z.string().uuid();
const dateSchema = z.coerce.date();

module.exports = { z, uuidSchema, dateSchema };
