const { Venue } = require("../models/Venue");
const { Vendor } = require("../models/Vendor");
const { VenueBooking } = require("../models/VenueBooking");
const { VendorContract } = require("../models/VendorContract");
const {
  sampleVenues,
  sampleVendors,
  sampleBookings,
  sampleContracts
} = require("./sampleCatalog");

const seedSampleCatalog = async () => {
  await Promise.all(
    sampleVenues.map((venue) =>
      Venue.findOneAndUpdate(
        { venueId: venue.venueId },
        { $set: { ...venue, isActive: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      )
    )
  );

  await Promise.all(
    sampleVendors.map((vendor) =>
      Vendor.findOneAndUpdate(
        { vendorId: vendor.vendorId },
        {
          $set: {
            ...vendor,
            isActive: true,
            rating: Number(vendor.rating.toFixed(2)),
            reviewCount: vendor.reviews.length
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      )
    )
  );

  await Promise.all(
    sampleBookings.map((booking) =>
      VenueBooking.findOneAndUpdate(
        { bookingId: booking.bookingId },
        { $set: booking },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      )
    )
  );

  await Promise.all(
    sampleContracts.map((contract) =>
      VendorContract.findOneAndUpdate(
        { contractId: contract.contractId },
        { $set: contract },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      )
    )
  );
};

module.exports = { seedSampleCatalog };
