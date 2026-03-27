const express = require("express");
const { WebhookSubscription } = require("../models/WebhookSubscription");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/asyncHandler");
const { ROLE } = require("../constants/roles");
const { webhookSubscriptionSchema } = require("../validators/webhookValidators");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  asyncHandler(async (req, res) => {
    const items = await WebhookSubscription.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(items);
  })
);

router.post(
  "/",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(webhookSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const item = await WebhookSubscription.create({
      ...req.body,
      userId: req.user.id
    });
    res.status(201).json(item);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  asyncHandler(async (req, res) => {
    await WebhookSubscription.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.status(204).send();
  })
);

module.exports = router;
