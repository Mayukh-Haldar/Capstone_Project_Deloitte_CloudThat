[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🗺 OpenStreetMap (OSM)

**Role:** Embedded Interactive Venue Maps  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **OpenStreetMap** via the **Leaflet.js** library to render interactive venue location maps directly in the browser. No API key is required, there is no usage quota, and no data is sent to a third-party mapping provider beyond the tile requests - making it suitable for both local development and production deployment without additional configuration.

---

## Where It Is Used

| Page | Usage |
|------|-------|
| Event Details Page | Shows the venue location on an interactive map with a marker |
| Venue Browsing (Vendor) | Venue cards include a minimap showing venue position |
| Venue Detail / Booking | Full location context with address overlay |

---

## Implementation

- **Leaflet.js** - the open-source JavaScript mapping library that wraps OSM tiles
- **react-leaflet** - React component wrappers for Leaflet used in the frontend
- Venues store `latitude` and `longitude` in the database
- On page render, a `<MapContainer>` is mounted with a `<TileLayer>` pointing to `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- A `<Marker>` is placed at the venue coordinates with a popup showing the venue name and address

---

## Why OSM over Google Maps

| Factor | OpenStreetMap (Leaflet) | Google Maps |
|--------|------------------------|------------|
| API key required | No | Yes |
| Free tier limits | None | 28,000 loads/month |
| Data privacy | Tile requests only | Full session tracking |
| Customisation | Full control | Limited on free tier |
| Offline-capable | With tile caching | No |

---

## Configuration

No API keys or environment variables are required. The only dependency is the npm packages `leaflet` and `react-leaflet`, which are already included in `frontend/package.json`.
