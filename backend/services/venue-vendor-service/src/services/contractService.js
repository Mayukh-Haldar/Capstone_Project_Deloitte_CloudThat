const { VendorContract } = require("../models/VendorContract");
const { ApiError } = require("../utils/apiError");
const errorCodes = require("../constants/errorCodes");
const { CONTRACT_STATUS } = require("../constants/domain");
const { findVendorOrThrow } = require("./vendorService");

const allowedTransitions = {
  [CONTRACT_STATUS.PENDING]: [CONTRACT_STATUS.SIGNED],
  [CONTRACT_STATUS.SIGNED]: [CONTRACT_STATUS.ACTIVE],
  [CONTRACT_STATUS.ACTIVE]: [CONTRACT_STATUS.COMPLETED],
  [CONTRACT_STATUS.COMPLETED]: []
};

const isValidContractTransition = (currentStatus, nextStatus) => {
  const transitions = allowedTransitions[currentStatus] || [];
  return transitions.includes(nextStatus);
};

const hireVendorForEvent = async ({ eventId, vendorId, agreedPrice, createdBy }) => {
  await findVendorOrThrow(vendorId);

  const existing = await VendorContract.findOne({ eventId, vendorId }).lean();
  if (existing) {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      "Vendor already hired for this event"
    );
  }

  return VendorContract.create({
    eventId,
    vendorId,
    agreedPrice,
    createdBy,
    contractStatus: CONTRACT_STATUS.PENDING
  });
};

const updateContractStatus = async ({ contractId, contractStatus }) => {
  const contract = await VendorContract.findOne({ contractId });
  if (!contract) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      errorCodes.NOT_FOUND,
      "Contract not found"
    );
  }

  if (contract.contractStatus === contractStatus) {
    return contract;
  }

  if (!isValidContractTransition(contract.contractStatus, contractStatus)) {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      `Invalid contract transition from ${contract.contractStatus} to ${contractStatus}`
    );
  }

  contract.contractStatus = contractStatus;
  await contract.save();
  return contract;
};

const listVendorEventIds = async (vendorId) => {
  const contracts = await VendorContract.find({ vendorId }).select("eventId").lean();
  return contracts.map((c) => c.eventId);
};

module.exports = {
  hireVendorForEvent,
  updateContractStatus,
  isValidContractTransition,
  listVendorEventIds
};
