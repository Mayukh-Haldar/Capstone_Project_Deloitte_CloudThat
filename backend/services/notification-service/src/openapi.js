const { z } = require("zod");
const { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } = require("@asteasolutions/zod-to-openapi");
const { sendNotificationSchema, listNotificationsQuerySchema, markReadSchema } = require("./validators/notificationValidators");
const { templateSchema, updateTemplateSchema, previewTemplateSchema } = require("./validators/templateValidators");
const { preferenceSchema } = require("./validators/preferenceValidators");
const { pushTokenSchema } = require("./validators/pushValidators");
const { webhookSubscriptionSchema } = require("./validators/webhookValidators");

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();
const bearerSecurity = [{ bearerAuth: [] }];
const mongoIdParam = z.object({
  id: z.string().min(1).openapi({ example: "67f4d9e5d6f9dbe0e2e4c123" })
});
const genericObject = z.object({}).catchall(z.any());
const genericArray = z.array(genericObject);
const sendNotificationRequest = registry.register("SendNotificationRequest", sendNotificationSchema);
const markNotificationReadRequest = registry.register("MarkNotificationReadRequest", markReadSchema);
const notificationTemplateRequest = registry.register("NotificationTemplateRequest", templateSchema);
const notificationTemplateUpdateRequest = registry.register("NotificationTemplateUpdateRequest", updateTemplateSchema);
const notificationTemplatePreviewRequest = registry.register("NotificationTemplatePreviewRequest", previewTemplateSchema);
const notificationPreferenceRequest = registry.register("NotificationPreferenceRequest", preferenceSchema);
const pushTokenRequest = registry.register("PushTokenRequest", pushTokenSchema);
const webhookSubscriptionRequest = registry.register("WebhookSubscriptionRequest", webhookSubscriptionSchema);

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
  method: "post",
  path: "/api/v1/notifications/send",
  tags: ["Notifications"],
  summary: "Send notifications",
  request: { body: { required: true, content: { "application/json": { schema: sendNotificationRequest } } } },
  responses: { 202: jsonResponse("Notifications accepted for processing") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications",
  tags: ["Notifications"],
  summary: "List notifications for current user",
  security: bearerSecurity,
  request: { query: listNotificationsQuerySchema },
  responses: { 200: jsonResponse("Notifications page") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/delivery-logs",
  tags: ["Notifications"],
  summary: "List delivery logs",
  security: bearerSecurity,
  responses: { 200: jsonResponse("Delivery logs", genericArray) }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/{id}",
  tags: ["Notifications"],
  summary: "Get notification detail",
  security: bearerSecurity,
  request: { params: mongoIdParam },
  responses: { 200: jsonResponse("Notification detail") }
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Mark notification as read or unread",
  security: bearerSecurity,
  request: {
    params: mongoIdParam,
    body: { required: true, content: { "application/json": { schema: markNotificationReadRequest } } }
  },
  responses: { 200: jsonResponse("Updated notification") }
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/notifications/{id}",
  tags: ["Notifications"],
  summary: "Delete notification",
  security: bearerSecurity,
  request: { params: mongoIdParam },
  responses: { 204: { description: "Notification deleted" } }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/templates",
  tags: ["Templates"],
  summary: "List notification templates",
  security: bearerSecurity,
  responses: { 200: jsonResponse("Templates", genericArray) }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/notifications/templates",
  tags: ["Templates"],
  summary: "Create notification template",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: notificationTemplateRequest } } } },
  responses: { 201: jsonResponse("Template created") }
});

registry.registerPath({
  method: "put",
  path: "/api/v1/notifications/templates/{id}",
  tags: ["Templates"],
  summary: "Update notification template",
  security: bearerSecurity,
  request: {
    params: mongoIdParam,
    body: { required: true, content: { "application/json": { schema: notificationTemplateUpdateRequest } } }
  },
  responses: { 200: jsonResponse("Template updated") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/notifications/templates/{id}/preview",
  tags: ["Templates"],
  summary: "Preview template rendering",
  security: bearerSecurity,
  request: {
    params: mongoIdParam,
    body: { required: true, content: { "application/json": { schema: notificationTemplatePreviewRequest } } }
  },
  responses: { 200: jsonResponse("Template preview") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/preferences",
  tags: ["Preferences"],
  summary: "Get notification preferences",
  security: bearerSecurity,
  responses: { 200: jsonResponse("Preferences") }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/notifications/preferences",
  tags: ["Preferences"],
  summary: "Save notification preferences",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: notificationPreferenceRequest } } } },
  responses: { 200: jsonResponse("Preferences updated") }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/push-tokens",
  tags: ["Push Tokens"],
  summary: "List active push tokens",
  security: bearerSecurity,
  responses: { 200: jsonResponse("Push tokens", genericArray) }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/notifications/push-tokens",
  tags: ["Push Tokens"],
  summary: "Register push token",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: pushTokenRequest } } } },
  responses: { 201: jsonResponse("Push token registered") }
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/notifications/push-tokens",
  tags: ["Push Tokens"],
  summary: "Deactivate push token",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: pushTokenRequest } } } },
  responses: { 204: { description: "Push token deleted" } }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/webhook-subscriptions",
  tags: ["Webhooks"],
  summary: "List webhook subscriptions",
  security: bearerSecurity,
  responses: { 200: jsonResponse("Webhook subscriptions", genericArray) }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/notifications/webhook-subscriptions",
  tags: ["Webhooks"],
  summary: "Create webhook subscription",
  security: bearerSecurity,
  request: { body: { required: true, content: { "application/json": { schema: webhookSubscriptionRequest } } } },
  responses: { 201: jsonResponse("Webhook subscription created") }
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/notifications/webhook-subscriptions/{id}",
  tags: ["Webhooks"],
  summary: "Delete webhook subscription",
  security: bearerSecurity,
  request: { params: mongoIdParam },
  responses: { 204: { description: "Webhook subscription deleted" } }
});

const generator = new OpenApiGeneratorV3(registry.definitions);

function buildOpenApiDocument() {
  const serviceName = process.env.SERVICE_NAME || "notification-service";
  const port = process.env.PORT || 8086;
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "EventZen Notification Service API",
      version: "1.0.0",
      description: "Notifications, templates, preferences, push tokens, and webhook subscriptions."
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
