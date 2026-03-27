const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { ROLE } = require("../constants/roles");
const { hireVendorSchema } = require("../validators/contractValidators");
const { hireVendorForEvent } = require("../services/contractService");

const router = express.Router();

router.post(
  "/:id/vendors",
  requireAuth,
  requireRoles([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.VENDOR]),
  validate(hireVendorSchema),
  asyncHandler(async (req, res) => {
    const contract = await hireVendorForEvent({
      eventId: req.params.id,
      vendorId: req.body.vendorId,
      agreedPrice: req.body.agreedPrice,
      createdBy: req.user.id
    });
    res.status(201).json(contract);
  })
);

module.exports = router;
