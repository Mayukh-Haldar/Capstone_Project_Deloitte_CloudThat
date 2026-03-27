const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { ROLE } = require("../constants/roles");
const {
  listVendorsSchema,
  createVendorSchema,
  createReviewSchema
} = require("../validators/vendorValidators");
const { createVendor, listVendors, addReview } = require("../services/vendorService");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  validate(listVendorsSchema),
  asyncHandler(async (req, res) => {
    const result = await listVendors(req.query);
    res.json(result);
  })
);

router.post(
  "/",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(createVendorSchema),
  asyncHandler(async (req, res) => {
    const vendor = await createVendor(req.body);
    res.status(201).json(vendor);
  })
);

router.post(
  "/:id/reviews",
  requireAuth,
  requireRoles([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.VENDOR]),
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const vendor = await addReview({
      vendorId: req.params.id,
      eventId: req.body.eventId,
      rating: req.body.rating,
      comment: req.body.comment,
      reviewerId: req.user.id
    });
    res.status(201).json(vendor);
  })
);

module.exports = router;
