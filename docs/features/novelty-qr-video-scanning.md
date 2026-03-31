[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📷 Novelty Feature: QR Code Auto-Scanning from Video

**Service:** Ticketing Service frontend + Vendor Check-In Portal  
**Category:** Novelty - Real-Time / Computer Vision in Browser

---

## Overview

EventZen's check-in flow uses **browser-native QR code detection from a live camera video stream** - no dedicated scanning hardware, no native app, no third-party service. A vendor simply opens the Check-In Command Center in any modern browser, grants camera permission, and the system continuously decodes QR codes from each video frame in real time.

---

## How It Works

### Client-Side Video Capture

1. The Check-In page accesses the device camera via the **MediaDevices Web API** (`navigator.mediaDevices.getUserMedia`)
2. The video stream is rendered into a `<video>` element on screen
3. A `requestAnimationFrame` loop continuously captures frames from the video into a 2D canvas context

### QR Decoding

4. Each captured frame's raw pixel data (`ImageData`) is passed to **jsQR** - a pure JavaScript QR code decoder that runs entirely in the browser
5. jsQR scans the pixel matrix and, when a valid QR code is found, returns the decoded string (the ticket registration ID / validation token)
6. A **debounce** prevents the same code from being submitted repeatedly within a short window

### Server-Side Validation

7. The decoded token is sent to the Ticketing Service `POST /check-in` endpoint
8. The service validates the token, marks the attendee as checked in, records the timestamp in `CHECKIN_LOG`, and returns a response
9. The frontend shows an instant visual confirmation (green flash for valid, red for already-used or invalid)

---

## Key Files

| File | Role |
|------|------|
| `frontend/src/pages/CheckIn.jsx` | Camera setup, frame loop, jsQR decoding, UI feedback |
| `backend/services/ticketing-service/.../CheckInController.cs` | Server-side QR validation and check-in recording |

---

## Why It's Novel

- **Zero hardware dependency** - works on any laptop or tablet with a camera
- **Zero native app** - runs entirely in a browser, deployable as a PWA
- **Real-time frame processing** - decodes at 30 fps without blocking the UI thread
- **Instant feedback loop** - validation roundtrip completes in under 200 ms on LAN
