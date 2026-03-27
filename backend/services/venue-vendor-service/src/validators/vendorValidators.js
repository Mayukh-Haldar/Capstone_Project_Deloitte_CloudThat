const { z, uuidSchema } = require("./common");
const { SERVICE_CATEGORIES } = require("../constants/domain");

const listVendorsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    serviceType: z.enum(SERVICE_CATEGORIES).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
  })
});

const createVendorSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    vendorName: z.string().trim().min(2),
    serviceType: z.enum(SERVICE_CATEGORIES),
    email: z.string().trim().email(),
    phone: z.string().trim().min(8)
  })
});

const createReviewSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    eventId: uuidSchema,
    rating: z.number().min(1).max(5),
    comment: z.string().trim().max(1000).optional().default("")
  })
});

module.exports = {
  listVendorsSchema,
  createVendorSchema,
  createReviewSchema
};
