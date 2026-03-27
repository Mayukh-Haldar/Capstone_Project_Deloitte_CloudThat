const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { ROLE } = require("../constants/roles");
const { updateContractStatusSchema } = require("../validators/contractValidators");
const { updateContractStatus } = require("../services/contractService");

const router = express.Router();

router.patch(
  "/:id/status",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(updateContractStatusSchema),
  asyncHandler(async (req, res) => {
    const contract = await updateContractStatus({
      contractId: req.params.id,
      contractStatus: req.body.contractStatus
    });
    res.json(contract);
  })
);

module.exports = router;
