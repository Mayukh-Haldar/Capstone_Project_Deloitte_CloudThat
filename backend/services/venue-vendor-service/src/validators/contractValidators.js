const { z, uuidSchema } = require("./common");
const { CONTRACT_STATUS } = require("../constants/domain");

const hireVendorSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    vendorId: uuidSchema,
    agreedPrice: z.number().nonnegative()
  })
});

const updateContractStatusSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    contractStatus: z.enum(Object.values(CONTRACT_STATUS))
  })
});

module.exports = {
  hireVendorSchema,
  updateContractStatusSchema
};
