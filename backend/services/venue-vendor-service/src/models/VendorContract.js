const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const { CONTRACT_STATUS } = require("../constants/domain");

const VendorContractSchema = new mongoose.Schema(
  {
    contractId: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true
    },
    eventId: {
      type: String,
      required: true,
      index: true
    },
    vendorId: {
      type: String,
      required: true,
      index: true
    },
    agreedPrice: {
      type: Number,
      min: 0,
      required: true
    },
    contractStatus: {
      type: String,
      enum: Object.values(CONTRACT_STATUS),
      default: CONTRACT_STATUS.PENDING
    },
    createdBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

VendorContractSchema.index({ eventId: 1, vendorId: 1 }, { unique: true });

const VendorContract = mongoose.model("VendorContract", VendorContractSchema);

module.exports = { VendorContract };
