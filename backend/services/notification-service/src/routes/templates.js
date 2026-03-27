const express = require("express");
const { NotificationTemplate } = require("../models/NotificationTemplate");
const { ROLE } = require("../constants/roles");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { templateSchema, updateTemplateSchema, previewTemplateSchema } = require("../validators/templateValidators");
const { asyncHandler } = require("../utils/asyncHandler");
const { createTemplate, updateTemplate, previewTemplate } = require("../services/templateService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  asyncHandler(async (_req, res) => {
    const items = await NotificationTemplate.find().sort({ updatedAt: -1 }).lean();
    res.json(items);
  })
);

router.post(
  "/",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const item = await createTemplate(req.body, req.user.id);
    res.status(201).json(item);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(updateTemplateSchema),
  asyncHandler(async (req, res) => {
    const item = await updateTemplate(req.params.id, req.body, req.user.id);
    res.json(item);
  })
);

router.post(
  "/:id/preview",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(previewTemplateSchema),
  asyncHandler(async (req, res) => {
    const preview = await previewTemplate(req.params.id, req.body.variables);
    res.json(preview);
  })
);

module.exports = router;
