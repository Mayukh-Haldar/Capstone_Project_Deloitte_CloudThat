const { z, uuidSchema, dateSchema } = require("./common");

const listVenuesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    city: z.string().trim().min(1).optional(),
    minCapacity: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
  })
});

const listVenueBookingsSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    venueId: uuidSchema.optional(),
    eventId: uuidSchema.optional(),
    bookingStatus: z.enum(["ACTIVE", "CANCELLED", "ALL"]).optional(),
    upcomingOnly: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional()
  })
});

const createVenueSchema = z.object({
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  body: z.object({
    venueName: z.string().trim().min(2),
    address: z.string().trim().min(5),
    city: z.string().trim().min(2),
    capacity: z.number().int().positive(),
    pricePerDay: z.number().nonnegative(),
    amenities: z.array(z.string().trim().min(1)).optional().default([]),
    mediaGallery: z.array(z.string().url()).optional().default([]),
    halls: z
      .array(
        z.object({
          hallName: z.string().trim().min(1),
          capacity: z.number().int().positive()
        })
      )
      .optional()
      .default([])
  })
});

const updateVenueSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z
    .object({
      venueName: z.string().trim().min(2).optional(),
      address: z.string().trim().min(5).optional(),
      city: z.string().trim().min(2).optional(),
      capacity: z.number().int().positive().optional(),
      pricePerDay: z.number().nonnegative().optional(),
      amenities: z.array(z.string().trim().min(1)).optional(),
      mediaGallery: z.array(z.string().url()).optional(),
      halls: z
        .array(
          z.object({
            hallName: z.string().trim().min(1),
            capacity: z.number().int().positive()
          })
        )
        .optional(),
      isActive: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required for update"
    })
});

const venueIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({})
});

const checkAvailabilitySchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  body: z.object({}).optional().default({}),
  query: z
    .object({
      start: dateSchema,
      end: dateSchema,
      hallIds: z.string().trim().optional()
    })
    .refine((value) => value.end > value.start, {
      message: "end must be greater than start",
      path: ["end"]
    })
});

const createBookingSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z
    .object({
      eventId: uuidSchema,
      bookingStart: dateSchema,
      bookingEnd: dateSchema,
      hallIds: z.array(uuidSchema).optional().default([]),
      vendorId: uuidSchema.optional(),
      bookingOwnerId: uuidSchema.optional(),
      bookingOwnerEmail: z.string().email().optional()
    })
    .refine((value) => value.bookingEnd > value.bookingStart, {
      message: "bookingEnd must be greater than bookingStart",
      path: ["bookingEnd"]
    })
});

const confirmVenueBookingPaymentSchema = z.object({
  params: z.object({
    bookingId: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    paymentId: uuidSchema,
    paymentReference: z.string().trim().min(1),
    invoiceNumber: z.string().trim().optional(),
    invoiceUrl: z.string().trim().url().optional(),
    amount: z.coerce.number().nonnegative().optional(),
    currency: z.string().trim().min(1).optional()
  })
});

const cancelVenueBookingSchema = z.object({
  params: z.object({
    bookingId: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z.object({
    reason: z.string().trim().min(3).max(500).optional()
  }).optional().default({})
});

const deleteVenueBookingSchema = z.object({
  params: z.object({
    bookingId: uuidSchema
  }),
  query: z.object({}).optional().default({}),
  body: z.object({}).optional().default({})
});

module.exports = {
  listVenuesSchema,
  listVenueBookingsSchema,
  createVenueSchema,
  updateVenueSchema,
  venueIdParamSchema,
  checkAvailabilitySchema,
  createBookingSchema,
  confirmVenueBookingPaymentSchema,
  cancelVenueBookingSchema,
  deleteVenueBookingSchema
};
