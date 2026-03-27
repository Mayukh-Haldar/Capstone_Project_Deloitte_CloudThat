const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET || "change-me-change-me-change-me-change-me-1234567890";
process.env.AUTH_JWT_ISSUER =
  process.env.AUTH_JWT_ISSUER || "eventzen-auth-service";

const { connectDatabase } = require("../../src/config/database");
const { app } = require("../../src/app");
const { Vendor } = require("../../src/models/Vendor");

const makeToken = (roles, uid = "11111111-1111-1111-1111-111111111111") =>
  jwt.sign(
    {
      type: "access",
      uid,
      authorities: roles.map((role) => `ROLE_${role}`)
    },
    process.env.AUTH_JWT_SECRET,
    {
      issuer: process.env.AUTH_JWT_ISSUER,
      subject: "tester@eventzen.local",
      expiresIn: "15m"
    }
  );

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

test("ADMIN can create venue; ORGANIZER cannot", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const organizerToken = makeToken(["ORGANIZER"]);

  const payload = {
    venueName: "Grand Convention Center",
    address: "123 Main St",
    city: "Bangalore",
    capacity: 1000,
    pricePerDay: 5000,
    amenities: ["WiFi"],
    mediaGallery: ["https://example.com/venue.jpg"],
    halls: [{ hallName: "Hall A", capacity: 400 }]
  };

  const created = await request(app)
    .post("/api/v1/venues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.venueName, payload.venueName);

  const forbidden = await request(app)
    .post("/api/v1/venues")
    .set("Authorization", `Bearer ${organizerToken}`)
    .send(payload);
  assert.equal(forbidden.status, 403);
});

test("booking conflict detection prevents overlapping venue reservations", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const vendorToken = makeToken(["VENDOR"]);
  const eventOneId = "22222222-2222-2222-2222-222222222222";
  const eventTwoId = "33333333-3333-3333-3333-333333333333";

  const createVenueResponse = await request(app)
    .post("/api/v1/venues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      venueName: "Lakefront Expo",
      address: "90 Lake Road",
      city: "Mumbai",
      capacity: 700,
      pricePerDay: 3200,
      halls: [{ hallName: "Main Hall", capacity: 700 }]
    });

  const venueId = createVenueResponse.body.venueId;

  const firstBooking = await request(app)
    .post(`/api/v1/venues/${venueId}/book`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId: eventOneId,
      bookingStart: "2026-04-10T09:00:00.000Z",
      bookingEnd: "2026-04-10T18:00:00.000Z",
      hallIds: []
    });
  assert.equal(firstBooking.status, 201);

  const conflictingBooking = await request(app)
    .post(`/api/v1/venues/${venueId}/book`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId: eventTwoId,
      bookingStart: "2026-04-10T12:00:00.000Z",
      bookingEnd: "2026-04-10T20:00:00.000Z",
      hallIds: []
    });
  assert.equal(conflictingBooking.status, 409);
  assert.equal(conflictingBooking.body.code, "VV-1005");
});

test("hall-level availability allows non-overlapping hall bookings within the same venue", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const vendorToken = makeToken(["VENDOR"]);
  const eventOneId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const eventTwoId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  const createVenueResponse = await request(app)
    .post("/api/v1/venues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      venueName: "Multi Hall Center",
      address: "11 Sector Road",
      city: "Pune",
      capacity: 600,
      pricePerDay: 2500,
      halls: [
        { hallName: "Hall Red", capacity: 250 },
        { hallName: "Hall Blue", capacity: 250 }
      ]
    });

  const venue = createVenueResponse.body;
  const [hallRed, hallBlue] = venue.halls;

  const firstBooking = await request(app)
    .post(`/api/v1/venues/${venue.venueId}/book`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId: eventOneId,
      bookingStart: "2026-04-18T09:00:00.000Z",
      bookingEnd: "2026-04-18T16:00:00.000Z",
      hallIds: [hallRed.hallId]
    });
  assert.equal(firstBooking.status, 201);

  const availability = await request(app)
    .get(`/api/v1/venues/${venue.venueId}/availability`)
    .query({
      start: "2026-04-18T10:00:00.000Z",
      end: "2026-04-18T11:00:00.000Z",
      hallIds: hallBlue.hallId
    })
    .set("Authorization", `Bearer ${vendorToken}`);

  assert.equal(availability.status, 200);
  assert.equal(availability.body.isAvailable, true);
  assert.deepEqual(availability.body.unavailableHallIds, []);
  assert.deepEqual(availability.body.availableHallIds.sort(), [hallRed.hallId, hallBlue.hallId].sort());

  const secondBooking = await request(app)
    .post(`/api/v1/venues/${venue.venueId}/book`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId: eventTwoId,
      bookingStart: "2026-04-18T10:00:00.000Z",
      bookingEnd: "2026-04-18T12:00:00.000Z",
      hallIds: [hallBlue.hallId]
    });

  assert.equal(secondBooking.status, 201);
});

test("whole-venue availability is blocked when any hall is already booked for the window", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const organizerToken = makeToken(["ORGANIZER"]);
  const eventId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

  const createVenueResponse = await request(app)
    .post("/api/v1/venues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      venueName: "Summit Blocks",
      address: "22 Central Loop",
      city: "Delhi",
      capacity: 800,
      pricePerDay: 4100,
      halls: [
        { hallName: "North Hall", capacity: 300 },
        { hallName: "South Hall", capacity: 300 }
      ]
    });

  const venue = createVenueResponse.body;
  const northHallId = venue.halls[0].hallId;

  await request(app)
    .post(`/api/v1/venues/${venue.venueId}/book`)
    .set("Authorization", `Bearer ${organizerToken}`)
    .send({
      eventId,
      bookingStart: "2026-04-21T08:00:00.000Z",
      bookingEnd: "2026-04-21T15:00:00.000Z",
      hallIds: [northHallId]
    });

  const availability = await request(app)
    .get(`/api/v1/venues/${venue.venueId}/availability`)
    .query({
      start: "2026-04-21T09:00:00.000Z",
      end: "2026-04-21T10:00:00.000Z"
    })
    .set("Authorization", `Bearer ${organizerToken}`);

  assert.equal(availability.status, 200);
  assert.equal(availability.body.isAvailable, false);
  assert.equal(availability.body.requestedScope, "WHOLE_VENUE");
  assert.equal(availability.body.conflicts.length, 1);
});

test("vendor booking list only returns bookings created by that vendor", async () => {
  const adminToken = makeToken(["ADMIN"], "aaaaaaaa-1111-1111-1111-111111111111");
  const vendorOneId = "bbbbbbbb-1111-1111-1111-111111111111";
  const vendorTwoId = "cccccccc-1111-1111-1111-111111111111";
  const vendorOneToken = makeToken(["VENDOR"], vendorOneId);
  const vendorTwoToken = makeToken(["VENDOR"], vendorTwoId);

  const venueResponse = await request(app)
    .post("/api/v1/venues")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      venueName: "Scoped Booking Venue",
      address: "45 Access Lane",
      city: "Kolkata",
      capacity: 300,
      pricePerDay: 1800
    });
  assert.equal(venueResponse.status, 201);

  const venueId = venueResponse.body.venueId;

  const firstBooking = await request(app)
    .post(`/api/v1/venues/${venueId}/book`)
    .set("Authorization", `Bearer ${vendorOneToken}`)
    .send({
      eventId: "11111111-2222-3333-4444-555555555555",
      bookingStart: "2026-05-01T09:00:00.000Z",
      bookingEnd: "2026-05-01T12:00:00.000Z"
    });
  assert.equal(firstBooking.status, 201);

  const secondBooking = await request(app)
    .post(`/api/v1/venues/${venueId}/book`)
    .set("Authorization", `Bearer ${vendorTwoToken}`)
    .send({
      eventId: "66666666-7777-8888-9999-000000000000",
      bookingStart: "2026-05-02T09:00:00.000Z",
      bookingEnd: "2026-05-02T12:00:00.000Z"
    });
  assert.equal(secondBooking.status, 201);

  const vendorOneBookings = await request(app)
    .get("/api/v1/venues/bookings")
    .query({ upcomingOnly: "true" })
    .set("Authorization", `Bearer ${vendorOneToken}`);
  assert.equal(vendorOneBookings.status, 200);
  assert.equal(vendorOneBookings.body.items.length, 1);
  assert.equal(vendorOneBookings.body.items[0].createdBy, vendorOneId);
  assert.equal(vendorOneBookings.body.items[0].bookingId, firstBooking.body.bookingId);

  const adminBookings = await request(app)
    .get("/api/v1/venues/bookings")
    .query({ upcomingOnly: "true" })
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminBookings.status, 200);
  assert.equal(adminBookings.body.items.length, 2);
});

test("vendor hiring and contract lifecycle status progression", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const vendorToken = makeToken(["VENDOR"]);
  const eventId = "44444444-4444-4444-4444-444444444444";

  const vendorResponse = await request(app)
    .post("/api/v1/vendors")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      vendorName: "Prime Caterers",
      serviceType: "CATERING",
      email: "prime.caterers@example.com",
      phone: "+910000000001"
    });
  assert.equal(vendorResponse.status, 201);

  const contractResponse = await request(app)
    .post(`/api/v1/events/${eventId}/vendors`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      vendorId: vendorResponse.body.vendorId,
      agreedPrice: 12000
    });
  assert.equal(contractResponse.status, 201);
  assert.equal(contractResponse.body.contractStatus, "PENDING");

  const signedResponse = await request(app)
    .patch(`/api/v1/contracts/${contractResponse.body.contractId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ contractStatus: "SIGNED" });
  assert.equal(signedResponse.status, 200);
  assert.equal(signedResponse.body.contractStatus, "SIGNED");

  const invalidJump = await request(app)
    .patch(`/api/v1/contracts/${contractResponse.body.contractId}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ contractStatus: "COMPLETED" });
  assert.equal(invalidJump.status, 409);
});

test("vendor can submit vendor review and rating is aggregated", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const vendorToken = makeToken(
    ["VENDOR"],
    "55555555-5555-5555-5555-555555555555"
  );
  const eventId = "66666666-6666-6666-6666-666666666666";

  const vendorResponse = await request(app)
    .post("/api/v1/vendors")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      vendorName: "Frame Studio",
      serviceType: "PHOTOGRAPHY",
      email: "frame.studio@example.com",
      phone: "+910000000002"
    });
  assert.equal(vendorResponse.status, 201);

  const reviewResponse = await request(app)
    .post(`/api/v1/vendors/${vendorResponse.body.vendorId}/reviews`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId,
      rating: 4,
      comment: "Well managed and on time"
    });
  assert.equal(reviewResponse.status, 201);
  assert.equal(reviewResponse.body.rating, 4);
  assert.equal(reviewResponse.body.reviewCount, 1);

  const updatedVendor = await Vendor.findOne({
    vendorId: vendorResponse.body.vendorId
  }).lean();
  assert.equal(updatedVendor.rating, 4);
  assert.equal(updatedVendor.reviewCount, 1);
});

test("missing bearer token returns 401 on authenticated endpoint", async () => {
  const response = await request(app).get("/api/v1/vendors");
  assert.equal(response.status, 401);
  assert.equal(response.body.code, "VV-1002");
});

test("token with invalid issuer is rejected", async () => {
  const badIssuerToken = jwt.sign(
    {
      type: "access",
      uid: "88888888-8888-8888-8888-888888888888",
      authorities: ["ROLE_ADMIN"]
    },
    process.env.AUTH_JWT_SECRET,
    {
      issuer: "wrong-issuer",
      subject: "intruder@eventzen.local",
      expiresIn: "15m"
    }
  );

  const response = await request(app)
    .get("/api/v1/vendors")
    .set("Authorization", `Bearer ${badIssuerToken}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "VV-1002");
});

test("ORGANIZER is forbidden from ADMIN-only vendor creation", async () => {
  const organizerToken = makeToken(["ORGANIZER"]);

  const response = await request(app)
    .post("/api/v1/vendors")
    .set("Authorization", `Bearer ${organizerToken}`)
    .send({
      vendorName: "Forbidden Vendor",
      serviceType: "SECURITY",
      email: "forbidden.vendor@example.com",
      phone: "+910000000003"
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "VV-1003");
});

test("duplicate vendor email is rejected with conflict", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const payload = {
    vendorName: "Repeat Vendor",
    serviceType: "AV",
    email: "repeat.vendor@example.com",
    phone: "+910000000004"
  };

  const first = await request(app)
    .post("/api/v1/vendors")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);
  assert.equal(first.status, 201);

  const second = await request(app)
    .post("/api/v1/vendors")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);
  assert.equal(second.status, 409);
  assert.equal(second.body.code, "VV-1005");
});

test("duplicate review by same reviewer for same event is rejected", async () => {
  const adminToken = makeToken(["ADMIN"]);
  const reviewerId = "99999999-9999-9999-9999-999999999999";
  const vendorToken = makeToken(["VENDOR"], reviewerId);
  const eventId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  const vendorResponse = await request(app)
    .post("/api/v1/vendors")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      vendorName: "Review Target Vendor",
      serviceType: "DECOR",
      email: "review.target@example.com",
      phone: "+910000000005"
    });
  assert.equal(vendorResponse.status, 201);

  const firstReview = await request(app)
    .post(`/api/v1/vendors/${vendorResponse.body.vendorId}/reviews`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId,
      rating: 5,
      comment: "Great execution"
    });
  assert.equal(firstReview.status, 201);

  const duplicateReview = await request(app)
    .post(`/api/v1/vendors/${vendorResponse.body.vendorId}/reviews`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({
      eventId,
      rating: 4,
      comment: "Second attempt"
    });
  assert.equal(duplicateReview.status, 409);
  assert.equal(duplicateReview.body.code, "VV-1005");
});
