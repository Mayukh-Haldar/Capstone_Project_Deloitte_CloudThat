const errorCodes = require("../constants/errorCodes");
const { NotificationTemplate } = require("../models/NotificationTemplate");
const { ApiError } = require("../utils/apiError");
const { renderTemplate } = require("../utils/templateRenderer");

const getTemplateByKey = async (templateKey) => {
  const template = await NotificationTemplate.findOne({ templateKey, isActive: true });
  if (!template) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.TEMPLATE_NOT_FOUND, `Template ${templateKey} was not found`);
  }
  return template;
};

const getTemplateForEvent = async ({ eventType, channel, locale = "en" }) => {
  const localized = await NotificationTemplate.findOne({ eventType, channel, locale, isActive: true });
  if (localized) {
    return localized;
  }

  const fallback = await NotificationTemplate.findOne({ eventType, channel, locale: "en", isActive: true });
  if (!fallback) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.TEMPLATE_NOT_FOUND, `Template for ${eventType}.${channel}.${locale} was not found`);
  }
  return fallback;
};

const createTemplate = async (payload, updatedBy) => {
  const existing = await NotificationTemplate.findOne({ templateKey: payload.templateKey });
  if (existing) {
    throw new ApiError(409, "CONFLICT", errorCodes.TEMPLATE_KEY_CONFLICT, "Template key already exists");
  }

  return NotificationTemplate.create({
    ...payload,
    versions: [
      {
        version: 1,
        subject: payload.subject,
        body: payload.body,
        html: payload.html || null,
        variables: payload.variables || [],
        updatedBy
      }
    ]
  });
};

const updateTemplate = async (id, payload, updatedBy) => {
  const template = await NotificationTemplate.findById(id);
  if (!template) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.TEMPLATE_NOT_FOUND, "Template was not found");
  }

  Object.assign(template, payload);

  template.versions.push({
    version: template.versions.length + 1,
    subject: template.subject,
    body: template.body,
    html: template.html || null,
    variables: template.variables || [],
    updatedBy
  });

  await template.save();
  return template;
};

const previewTemplate = async (id, variables) => {
  const template = await NotificationTemplate.findById(id);
  if (!template) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.TEMPLATE_NOT_FOUND, "Template was not found");
  }

  return renderTemplate(template, variables);
};

module.exports = {
  getTemplateByKey,
  getTemplateForEvent,
  createTemplate,
  updateTemplate,
  previewTemplate
};
