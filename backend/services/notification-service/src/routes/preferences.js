const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { preferenceSchema } = require("../validators/preferenceValidators");
const { asyncHandler } = require("../utils/asyncHandler");
const { getPreferences, updatePreferences } = require("../services/preferenceService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const preferences = await getPreferences(req.user.id);
    res.json(preferences);
  })
);

router.post(
  "/",
  requireAuth,
  validate(preferenceSchema),
  asyncHandler(async (req, res) => {
    const preferences = await updatePreferences(req.user.id, req.body);
    res.json(preferences);
  })
);

module.exports = router;
