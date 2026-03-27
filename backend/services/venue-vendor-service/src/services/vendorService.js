const { Vendor } = require("../models/Vendor");
const { buildPagination } = require("../utils/pagination");
const { ApiError } = require("../utils/apiError");
const errorCodes = require("../constants/errorCodes");

const createVendor = async (payload) => {
  const existing = await Vendor.findOne({ email: payload.email.toLowerCase() }).lean();
  if (existing) {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      "Vendor already exists for this email"
    );
  }
  return Vendor.create(payload);
};

const listVendors = async (query) => {
  const pagination = buildPagination(query);
  const filters = { isActive: true };

  if (query.serviceType) {
    filters.serviceType = query.serviceType;
  }

  if (typeof query.minRating === "number") {
    filters.rating = { $gte: query.minRating };
  }

  const [items, total] = await Promise.all([
    Vendor.find(filters)
      .sort({ rating: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Vendor.countDocuments(filters)
  ]);

  return {
    items,
    page: pagination.page,
    limit: pagination.limit,
    total
  };
};

const findVendorOrThrow = async (vendorId) => {
  const vendor = await Vendor.findOne({ vendorId, isActive: true });
  if (!vendor) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      errorCodes.NOT_FOUND,
      "Vendor not found"
    );
  }
  return vendor;
};

const addReview = async ({ vendorId, eventId, rating, comment, reviewerId }) => {
  const vendor = await findVendorOrThrow(vendorId);
  const alreadyReviewed = vendor.reviews.some(
    (review) => review.eventId === eventId && review.reviewerId === reviewerId
  );

  if (alreadyReviewed) {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      "Reviewer has already submitted feedback for this event and vendor"
    );
  }

  vendor.reviews.push({
    eventId,
    reviewerId,
    rating,
    comment
  });

  vendor.reviewCount = vendor.reviews.length;
  const ratingTotal = vendor.reviews.reduce((acc, review) => acc + review.rating, 0);
  vendor.rating = Number((ratingTotal / vendor.reviewCount).toFixed(2));

  await vendor.save();
  return vendor;
};

module.exports = {
  createVendor,
  listVendors,
  findVendorOrThrow,
  addReview
};
