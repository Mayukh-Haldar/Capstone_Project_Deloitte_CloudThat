const { z } = require("./validators/common");
const { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } = require("@asteasolutions/zod-to-openapi");
const {
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
} = require("./validators/venueValidators");
const { listVendorsSchema, createVendorSchema, createReviewSchema } = require("./validators/vendorValidators");
const { hireVendorSchema, updateContractStatusSchema } = require("./validators/contractValidators");

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();
const bearerSecurity = [{ bearerAuth: [] }];
const genericObject = z.object({}).catchall(z.any());
const genericArray = z.array(genericObject);
const createVenueRequest = registry.register("CreateVenueRequest", createVenueSchema.shape.body);
const venueIdParams = venueIdParamSchema.shape.params;
const updateVenueParams = updateVenueSchema.shape.params;
const updateVenueRequest = registry.register("UpdateVenueRequest", updateVenueSchema.shape.body);
const checkVenueAvailabilityParams = checkAvailabilitySchema.shape.params;
const checkVenueAvailabilityQuery = checkAvailabilitySchema.shape.query;
const createVenueBookingParams = createBookingSchema.shape.params;
const createVenueBookingRequest = registry.register("CreateVenueBookingRequest", createBookingSchema.shape.body);
const confirmVenueBookingPaymentParams = confirmVenueBookingPaymentSchema.shape.params;
const confirmVenueBookingPaymentRequest = registry.register("ConfirmVenueBookingPaymentRequest", confirmVenueBookingPaymentSchema.shape.body);
const cancelVenueBookingParams = cancelVenueBookingSchema.shape.params;
const cancelVenueBookingRequest = registry.register("CancelVenueBookingRequest", cancelVenueBookingSchema.shape.body);
const deleteVenueBookingParams = deleteVenueBookingSchema.shape.params;
const createVendorRequest = registry.register("CreateVendorRequest", createVendorSchema.shape.body);
const createVendorReviewParams = createReviewSchema.shape.params;
const createVendorReviewRequest = registry.register("CreateVendorReviewRequest", createReviewSchema.shape.body);
const hireVendorParams = hireVendorSchema.shape.params;
const hireVendorRequest = registry.register("HireVendorRequest", hireVendorSchema.shape.body);
const updateContractStatusParams = updateContractStatusSchema.shape.params;
const updateContractStatusRequest = registry.register("UpdateContractStatusRequest", updateContractStatusSchema.shape.body);

const jsonResponse = (description, schema = genericObject) => ({
  description,
  content: { "application/json": { schema } }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/health",
  tags: ["Health"],
  summary: "Health check",
  responses: { 200: jsonResponse("Service health") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/venues",
  tags: ["Venues"],
  summary: "List venues",
  request: { query: listVenuesSchema.shape.query },
  responses: { 200: jsonResponse("Venues page") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/venues",
  tags: ["Venues"],
  summary: "Create venue",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: createVenueRequest } } } },
  responses: { 201: jsonResponse("Venue created") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/venues/bookings",
  tags: ["Venue Bookings"],
  summary: "List venue bookings",
  security: bearerSecurity,
  request: { query: listVenueBookingsSchema.shape.query },
  responses: { 200: jsonResponse("Venue bookings page") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/venues/{id}",
  tags: ["Venues"],
  summary: "Get venue by id",
  request: { params: venueIdParams },
  responses: { 200: jsonResponse("Venue detail") }
});

registry.registerPath({
  method: "put",
  path: "/api/v1/venues/{id}",
  tags: ["Venues"],
  summary: "Update venue",
  security: bearerSecurity,
  request: {
    params: updateVenueParams,
    body: { required: true, content: { "application/json": { schema: updateVenueRequest } } }
  },
  responses: { 200: jsonResponse("Venue updated") }
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/venues/{id}",
  tags: ["Venues"],
  summary: "Deactivate venue",
  security: bearerSecurity,
  request: { params: venueIdParams },
  responses: { 200: jsonResponse("Venue deactivated") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/venues/{id}/availability",
  tags: ["Venue Bookings"],
  summary: "Check venue availability",
  security: bearerSecurity,
  request: { params: checkVenueAvailabilityParams, query: checkVenueAvailabilityQuery },
  responses: { 200: jsonResponse("Availability") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/venues/{id}/book",
  tags: ["Venue Bookings"],
  summary: "Create venue booking",
  security: bearerSecurity,
  request: {
    params: createVenueBookingParams,
    body: { required: true, content: { "application/json": { schema: createVenueBookingRequest } } }
  },
  responses: { 201: jsonResponse("Booking created") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/venues/internal/bookings/{bookingId}/confirm-payment",
  tags: ["Venue Bookings"],
  summary: "Confirm venue booking payment",
  request: {
    params: confirmVenueBookingPaymentParams,
    body: { required: true, content: { "application/json": { schema: confirmVenueBookingPaymentRequest } } }
  },
  responses: { 200: jsonResponse("Booking payment confirmed") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/venues/bookings/{bookingId}/cancel",
  tags: ["Venue Bookings"],
  summary: "Cancel venue booking",
  security: bearerSecurity,
  request: {
    params: cancelVenueBookingParams,
    body: { content: { "application/json": { schema: cancelVenueBookingRequest } } }
  },
  responses: { 200: jsonResponse("Booking cancelled") }
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/venues/bookings/{bookingId}",
  tags: ["Venue Bookings"],
  summary: "Delete venue booking",
  security: bearerSecurity,
  request: { params: deleteVenueBookingParams },
  responses: { 204: { description: "Booking deleted" } }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/vendors",
  tags: ["Vendors"],
  summary: "List vendors",
  security: bearerSecurity,
  request: { query: listVendorsSchema.shape.query },
  responses: { 200: jsonResponse("Vendors page") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/vendors",
  tags: ["Vendors"],
  summary: "Create vendor",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: createVendorRequest } } } },
  responses: { 201: jsonResponse("Vendor created") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/vendors/{id}/reviews",
  tags: ["Vendors"],
  summary: "Create vendor review",
  security: bearerSecurity,
  request: {
    params: createVendorReviewParams,
    body: { required: true, content: { "application/json": { schema: createVendorReviewRequest } } }
  },
  responses: { 201: jsonResponse("Review created") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/events/{id}/vendors",
  tags: ["Event Vendors"],
  summary: "Hire vendor for event",
  security: bearerSecurity,
  request: {
    params: hireVendorParams,
    body: { required: true, content: { "application/json": { schema: hireVendorRequest } } }
  },
  responses: { 201: jsonResponse("Contract created") }
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/contracts/{id}/status",
  tags: ["Contracts"],
  summary: "Update contract status",
  security: bearerSecurity,
  request: {
    params: updateContractStatusParams,
    body: { required: true, content: { "application/json": { schema: updateContractStatusRequest } } }
  },
  responses: { 200: jsonResponse("Contract updated") }
});

const generator = new OpenApiGeneratorV3(registry.definitions);

function buildOpenApiDocument() {
  const serviceName = process.env.SERVICE_NAME || "venue-vendor-service";
  const port = process.env.PORT || 8083;
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "EventZen Venue Vendor Service API",
      version: "1.0.0",
      description: "Venue catalog, bookings, vendors, contracts, and event vendor assignment."
    },
    servers: [{ url: `http://${serviceName}:${port}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  });
}

module.exports = { buildOpenApiDocument };
