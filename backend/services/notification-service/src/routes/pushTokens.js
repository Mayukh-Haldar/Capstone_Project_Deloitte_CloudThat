const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/asyncHandler");
const { pushTokenSchema } = require("../validators/pushValidators");
const { registerPushToken, deactivatePushToken, listActivePushTokens } = require("../services/pushTokenService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await listActivePushTokens(req.user.id);
    res.json(items);
  })
);

router.post(
  "/",
  requireAuth,
  validate(pushTokenSchema),
  asyncHandler(async (req, res) => {
    const item = await registerPushToken({
      userId: req.user.id,
      token: req.body.token,
      platform: req.body.platform,
      userAgent: req.header("user-agent") || null
    });
    res.status(201).json(item);
  })
);

router.delete(
  "/",
  requireAuth,
  validate(pushTokenSchema),
  asyncHandler(async (req, res) => {
    await deactivatePushToken({
      userId: req.user.id,
      token: req.body.token
    });
    res.status(204).send();
  })
);

module.exports = router;
