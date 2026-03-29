const SAMPLE_ORGANIZER_ID = "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0001";
const PULSECRAFT_VENDOR_ACCOUNT_ID = "92000000-0000-0000-0000-000000000001";
const NORTHSTAR_VENDOR_ACCOUNT_ID = "92000000-0000-0000-0000-000000000002";
const CANVAS_VENDOR_ACCOUNT_ID = "92000000-0000-0000-0000-000000000003";
const SHIELDLINE_VENDOR_ACCOUNT_ID = "92000000-0000-0000-0000-000000000004";

const sampleVenues = [
  {
    venueId: "90000000-0000-0000-0000-000000000001",
    venueName: "Skyline Convention Center",
    address: "12 Residency Road, MG Road",
    city: "Bengaluru",
    capacity: 1800,
    pricePerDay: 145000,
    amenities: ["5G WiFi", "LED wall", "Green rooms", "Valet parking", "Hybrid streaming"],
    mediaGallery: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30"
    ],
    halls: [
      {
        hallId: "91000000-0000-0000-0000-000000000001",
        hallName: "Aurora Ballroom",
        capacity: 900
      },
      {
        hallId: "91000000-0000-0000-0000-000000000002",
        hallName: "Launchpad Hall",
        capacity: 500
      },
      {
        hallId: "91000000-0000-0000-0000-000000000003",
        hallName: "Studio Forum",
        capacity: 240
      }
    ]
  },
  {
    venueId: "90000000-0000-0000-0000-000000000002",
    venueName: "Harbor Expo Pavilion",
    address: "44 Seaport Avenue, Worli",
    city: "Mumbai",
    capacity: 2200,
    pricePerDay: 168000,
    amenities: ["Freight access", "Dockside deck", "Projector rig", "VIP lounge"],
    mediaGallery: [
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3"
    ],
    halls: [
      {
        hallId: "91000000-0000-0000-0000-000000000004",
        hallName: "Ocean Hall",
        capacity: 1100
      },
      {
        hallId: "91000000-0000-0000-0000-000000000005",
        hallName: "Pier Gallery",
        capacity: 650
      }
    ]
  },
  {
    venueId: "90000000-0000-0000-0000-000000000003",
    venueName: "Lotus Knowledge Arena",
    address: "8 Knowledge Park, Hitech City",
    city: "Hyderabad",
    capacity: 1200,
    pricePerDay: 112000,
    amenities: ["Breakout rooms", "Simultaneous translation", "Outdoor networking lawn"],
    mediaGallery: [
      "https://images.unsplash.com/photo-1503428593586-e225b39bddfe"
    ],
    halls: [
      {
        hallId: "91000000-0000-0000-0000-000000000006",
        hallName: "Saffron Auditorium",
        capacity: 700
      },
      {
        hallId: "91000000-0000-0000-0000-000000000007",
        hallName: "Jade Studio",
        capacity: 260
      },
      {
        hallId: "91000000-0000-0000-0000-000000000008",
        hallName: "Founders Lounge",
        capacity: 120
      }
    ]
  },
  {
    venueId: "90000000-0000-0000-0000-000000000004",
    venueName: "Riverside Culture Yard",
    address: "101 Riverfront Walk, Adyar",
    city: "Chennai",
    capacity: 950,
    pricePerDay: 82000,
    amenities: ["Open-air stage", "Food court bays", "Backstage pods", "LED signage"],
    mediaGallery: [
      "https://images.unsplash.com/photo-1523580494863-6f3031224c94"
    ],
    halls: [
      {
        hallId: "91000000-0000-0000-0000-000000000009",
        hallName: "River Deck",
        capacity: 500
      },
      {
        hallId: "91000000-0000-0000-0000-000000000010",
        hallName: "Craft Court",
        capacity: 180
      }
    ]
  }
];

const sampleVendors = [
  {
    vendorId: "92000000-0000-0000-0000-000000000001",
    vendorName: "PulseCraft AV",
    serviceType: "AV",
    email: "bookings@pulsecraftav.example",
    phone: "+91-90000-10001",
    rating: 4.8,
    reviewCount: 3,
    reviews: [
      {
        reviewId: "92100000-0000-0000-0000-000000000001",
        eventId: "70000000-0000-0000-0000-000000000001",
        reviewerId: SAMPLE_ORGANIZER_ID,
        rating: 5,
        comment: "Stage transitions and live stream ops were flawless."
      },
      {
        reviewId: "92100000-0000-0000-0000-000000000002",
        eventId: "70000000-0000-0000-0000-000000000002",
        reviewerId: "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0002",
        rating: 4,
        comment: "Strong execution with clear technical rehearsals."
      },
      {
        reviewId: "92100000-0000-0000-0000-000000000003",
        eventId: "70000000-0000-0000-0000-000000000003",
        reviewerId: "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0003",
        rating: 5,
        comment: "Reliable crew and excellent room acoustics support."
      }
    ]
  },
  {
    vendorId: "92000000-0000-0000-0000-000000000002",
    vendorName: "Northstar Catering Collective",
    serviceType: "CATERING",
    email: "hello@northstarcatering.example",
    phone: "+91-90000-10002",
    rating: 4.67,
    reviewCount: 3,
    reviews: [
      {
        reviewId: "92100000-0000-0000-0000-000000000004",
        eventId: "70000000-0000-0000-0000-000000000001",
        reviewerId: SAMPLE_ORGANIZER_ID,
        rating: 5,
        comment: "Great throughput and premium coffee bars."
      },
      {
        reviewId: "92100000-0000-0000-0000-000000000005",
        eventId: "70000000-0000-0000-0000-000000000002",
        reviewerId: "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0004",
        rating: 4,
        comment: "Well paced service for the expo floor."
      },
      {
        reviewId: "92100000-0000-0000-0000-000000000006",
        eventId: "70000000-0000-0000-0000-000000000004",
        reviewerId: "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0005",
        rating: 5,
        comment: "Flexible counters and crowd-friendly menu."
      }
    ]
  },
  {
    vendorId: "92000000-0000-0000-0000-000000000003",
    vendorName: "Canvas & Bloom Studio",
    serviceType: "DECOR",
    email: "studio@canvasbloom.example",
    phone: "+91-90000-10003",
    rating: 4.5,
    reviewCount: 2,
    reviews: [
      {
        reviewId: "92100000-0000-0000-0000-000000000007",
        eventId: "70000000-0000-0000-0000-000000000002",
        reviewerId: SAMPLE_ORGANIZER_ID,
        rating: 4,
        comment: "Built a flexible expo identity system."
      },
      {
        reviewId: "92100000-0000-0000-0000-000000000008",
        eventId: "70000000-0000-0000-0000-000000000004",
        reviewerId: "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0006",
        rating: 5,
        comment: "Warm, community-first design language."
      }
    ]
  },
  {
    vendorId: "92000000-0000-0000-0000-000000000004",
    vendorName: "ShieldLine Event Security",
    serviceType: "SECURITY",
    email: "ops@shieldline.example",
    phone: "+91-90000-10004",
    rating: 4.5,
    reviewCount: 2,
    reviews: [
      {
        reviewId: "92100000-0000-0000-0000-000000000009",
        eventId: "70000000-0000-0000-0000-000000000001",
        reviewerId: SAMPLE_ORGANIZER_ID,
        rating: 4,
        comment: "Smooth entry management for a high-footfall summit."
      },
      {
        reviewId: "92100000-0000-0000-0000-000000000010",
        eventId: "70000000-0000-0000-0000-000000000003",
        reviewerId: "1f20f0b0-51f2-4f9d-8f36-b6d4f67b0007",
        rating: 5,
        comment: "Professional guest flow and VIP perimeter handling."
      }
    ]
  }
];

const sampleBookings = [
  {
    bookingId: "93000000-0000-0000-0000-000000000001",
    eventId: "70000000-0000-0000-0000-000000000001",
    venueId: "90000000-0000-0000-0000-000000000001",
    hallIds: [
      "91000000-0000-0000-0000-000000000001",
      "91000000-0000-0000-0000-000000000002"
    ],
    bookingStart: new Date("2026-04-22T03:30:00.000Z"),
    bookingEnd: new Date("2026-04-22T13:30:00.000Z"),
    createdBy: PULSECRAFT_VENDOR_ACCOUNT_ID,
    vendorId: PULSECRAFT_VENDOR_ACCOUNT_ID
  },
  {
    bookingId: "93000000-0000-0000-0000-000000000002",
    eventId: "70000000-0000-0000-0000-000000000002",
    venueId: "90000000-0000-0000-0000-000000000002",
    hallIds: [],
    bookingStart: new Date("2026-05-14T02:30:00.000Z"),
    bookingEnd: new Date("2026-05-14T15:30:00.000Z"),
    createdBy: NORTHSTAR_VENDOR_ACCOUNT_ID,
    vendorId: NORTHSTAR_VENDOR_ACCOUNT_ID
  },
  {
    bookingId: "93000000-0000-0000-0000-000000000003",
    eventId: "70000000-0000-0000-0000-000000000003",
    venueId: "90000000-0000-0000-0000-000000000003",
    hallIds: [
      "91000000-0000-0000-0000-000000000006",
      "91000000-0000-0000-0000-000000000008"
    ],
    bookingStart: new Date("2026-06-19T04:00:00.000Z"),
    bookingEnd: new Date("2026-06-19T12:30:00.000Z"),
    createdBy: CANVAS_VENDOR_ACCOUNT_ID,
    vendorId: CANVAS_VENDOR_ACCOUNT_ID
  },
  {
    bookingId: "93000000-0000-0000-0000-000000000004",
    eventId: "70000000-0000-0000-0000-000000000004",
    venueId: "90000000-0000-0000-0000-000000000004",
    hallIds: [
      "91000000-0000-0000-0000-000000000009"
    ],
    bookingStart: new Date("2026-07-10T05:00:00.000Z"),
    bookingEnd: new Date("2026-07-10T14:00:00.000Z"),
    createdBy: SHIELDLINE_VENDOR_ACCOUNT_ID,
    vendorId: SHIELDLINE_VENDOR_ACCOUNT_ID
  },
  {
    bookingId: "93000000-0000-0000-0000-000000000005",
    eventId: "70000000-0000-0000-0000-000000000005",
    venueId: "90000000-0000-0000-0000-000000000001",
    hallIds: [
      "91000000-0000-0000-0000-000000000003"
    ],
    bookingStart: new Date("2026-08-15T06:00:00.000Z"),
    bookingEnd: new Date("2026-08-15T16:00:00.000Z"),
    createdBy: NORTHSTAR_VENDOR_ACCOUNT_ID,
    vendorId: NORTHSTAR_VENDOR_ACCOUNT_ID
  },
  {
    bookingId: "93000000-0000-0000-0000-000000000006",
    eventId: "70000000-0000-0000-0000-000000000006",
    venueId: "90000000-0000-0000-0000-000000000003",
    hallIds: [
      "91000000-0000-0000-0000-000000000007"
    ],
    bookingStart: new Date("2026-09-20T04:30:00.000Z"),
    bookingEnd: new Date("2026-09-20T13:00:00.000Z"),
    createdBy: PULSECRAFT_VENDOR_ACCOUNT_ID,
    vendorId: PULSECRAFT_VENDOR_ACCOUNT_ID
  }
];

module.exports = {
  SAMPLE_ORGANIZER_ID,
  sampleVenues,
  sampleVendors,
  sampleBookings,
  sampleContracts: [
    // PulseCraft AV — events 001, 002, 003
    { contractId: "94000000-0000-0000-0000-000000000001", eventId: "70000000-0000-0000-0000-000000000001", vendorId: "92000000-0000-0000-0000-000000000001", agreedPrice: 85000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    { contractId: "94000000-0000-0000-0000-000000000002", eventId: "70000000-0000-0000-0000-000000000002", vendorId: "92000000-0000-0000-0000-000000000001", agreedPrice: 90000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    { contractId: "94000000-0000-0000-0000-000000000003", eventId: "70000000-0000-0000-0000-000000000003", vendorId: "92000000-0000-0000-0000-000000000001", agreedPrice: 78000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    // Northstar Catering Collective — events 001, 002, 004
    { contractId: "94000000-0000-0000-0000-000000000004", eventId: "70000000-0000-0000-0000-000000000001", vendorId: "92000000-0000-0000-0000-000000000002", agreedPrice: 120000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    { contractId: "94000000-0000-0000-0000-000000000005", eventId: "70000000-0000-0000-0000-000000000002", vendorId: "92000000-0000-0000-0000-000000000002", agreedPrice: 135000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    { contractId: "94000000-0000-0000-0000-000000000006", eventId: "70000000-0000-0000-0000-000000000004", vendorId: "92000000-0000-0000-0000-000000000002", agreedPrice: 98000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    // Canvas & Bloom Studio — events 002, 004
    { contractId: "94000000-0000-0000-0000-000000000007", eventId: "70000000-0000-0000-0000-000000000002", vendorId: "92000000-0000-0000-0000-000000000003", agreedPrice: 55000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    { contractId: "94000000-0000-0000-0000-000000000008", eventId: "70000000-0000-0000-0000-000000000004", vendorId: "92000000-0000-0000-0000-000000000003", agreedPrice: 62000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    // ShieldLine Event Security — events 001, 003
    { contractId: "94000000-0000-0000-0000-000000000009", eventId: "70000000-0000-0000-0000-000000000001", vendorId: "92000000-0000-0000-0000-000000000004", agreedPrice: 45000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID },
    { contractId: "94000000-0000-0000-0000-000000000010", eventId: "70000000-0000-0000-0000-000000000003", vendorId: "92000000-0000-0000-0000-000000000004", agreedPrice: 50000, contractStatus: "COMPLETED", createdBy: SAMPLE_ORGANIZER_ID }
  ]
};
