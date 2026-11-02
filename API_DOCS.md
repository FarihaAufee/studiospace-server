# StudioSpace — API Documentation

Base URL: `http://localhost:8000`
All responses use a consistent JSON shape:

```json
{ "success": true|false, "message": "...", "data": { ... } }
```

Validation failures also include an `errors` object keyed by field name.

---

## Endpoint overview

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | GET | `/api/studios` | Public | All studios (+ filters) |
| 2 | GET | `/api/studios/featured` | Public | Latest 6 studios |
| 3 | GET | `/api/studios/:id` | Public | Studio details |
| 4 | POST | `/api/studios` | **Auth** | Create a studio (host = session user) |
| 5 | PUT | `/api/studios/:id` | **Auth** | Update a studio (owner only) |
| 6 | DELETE | `/api/studios/:id` | **Auth** | Delete a studio (owner only) |
| 7 | GET | `/api/categories` | Public | Known categories + live counts |
| 8 | GET | `/api/categories/:category/studios` | Public | Category-wise studios |
| 9 | POST | `/api/bookings` | **Auth** | Create a booking |
| 10 | GET | `/api/bookings/my` | **Auth** | Current user's bookings |
| 11 | GET | `/api/bookings/:id` | **Auth** | Booking details (owner or studio host) |
| 12 | PUT | `/api/bookings/:id` | **Auth** | Update a pending booking (owner) |
| 13 | PATCH | `/api/bookings/:id/cancel` | **Auth** | Cancel a booking (owner) |
| 14 | GET | `/api/hosts/listings` | **Auth** | Current host's listings |
| 15 | GET | `/api/hosts/listings/:id` | **Auth** | Listing details (owner only) |
| 16 | PUT | `/api/hosts/listings/:id` | **Auth** | Update own listing |
| 17 | DELETE | `/api/hosts/listings/:id` | **Auth** | Delete own listing |
| 18 | GET | `/api/profile` | **Auth** | Current user profile |
| 19 | PUT | `/api/profile` | **Auth** | Update profile (`name`) |

All studio GETs stay public. Every auth-dependent endpoint (mutations on
`/api/studios` and sections 9–19) is wrapped in `requireAuth` — see
[Authentication status](#authentication-status).

---

## Studio APIs

Sections 1–3 (all GETs) are PUBLIC. Sections 4–6 (POST/PUT/DELETE) are
AUTH-DEPENDENT — wrapped in `requireAuth`, owner-only. See
[Authentication status](#authentication-status).

### 1. GET /api/studios — All studios

Optional query filters (combine freely):

| Param | Example | Description |
|---|---|---|
| `category` | `?category=Photo Studios` | Exact match, case-insensitive |
| `location` | `?location=dhaka` | Partial match, case-insensitive |
| `minPrice` | `?minPrice=1000` | `hourlyRate` lower bound |
| `maxPrice` | `?maxPrice=2500` | `hourlyRate` upper bound |
| `search` | `?search=photography` | Case-insensitive "contains" across title, category, location, overview, hostName |

- `http://localhost:8000/api/studios`
- `http://localhost:8000/api/studios?location=dhaka&minPrice=1000&maxPrice=2000&search=photography`

**200** → `{ "success": true, "message": "Studios fetched successfully", "data": [ ...studio objects... ] }`
**400** → bad filter input (e.g. `?minPrice=abc`, `?minPrice=5000&maxPrice=1000`)
**503** → database not connected

### 2. GET /api/studios/featured — Latest 6 studios

**200** → `{ "success": true, "message": "Featured studios fetched successfully", "data": [ ...max 6 studios, newest first... ] }`

### 3. GET /api/studios/:id — Studio details

`:id` must be a 24-character MongoDB ObjectId — otherwise **400**.

- `http://localhost:8000/api/studios/aaaaaaaaaaaaaaaaaaaaaaaa` → **404**
- `http://localhost:8000/api/studios/abc123` → **400**

**200** → `{ "success": true, "message": "Studio found", "data": { ...studio... } }`

### 4. POST /api/studios — Create a studio (AUTH)

Headers: `Content-Type: application/json`

```json
{
  "title": "Rooftop Music Studio",
  "category": "Music Suites",
  "location": "Chattogram",
  "address": "70 GEC Circle, Chattogram",
  "image": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04",
  "overview": "Acoustically treated rooftop studio with sea view.",
  "hourlyRate": 900,
  "securityDeposit": 1500,
  "maxCapacity": 8,
  "amenities": ["Drum Kit", "Mixing Desk", "AC"],
  "hostName": "Rafi Ahmed",
  "hostEmail": "rafi@example.com"
}
```

Rules:

- `hostId` is **stamped from the authenticated session** (`req.user.id`) — a
  `hostId` in the request body is ignored/dropped. Ownership can never be
  set or spoofed through the payload.
- All string fields required and non-empty; `hostEmail` must be a valid email.
- `hourlyRate`/`securityDeposit` ≥ 0; `hourlyRate` and `maxCapacity` > 0; `maxCapacity` must be a whole number.
- `amenities` must be an array of non-empty strings (defaults to `[]` if omitted).
- `createdAt`/`updatedAt` are set automatically.

**201** → `{ "success": true, "message": "Studio created successfully", "data": { ...created studio... } }`
**400** → `{ "success": false, "message": "Studio validation failed", "errors": { "title": "title is required", ... } }`
**501** → authentication not configured yet (current state)

### 5. PUT /api/studios/:id — Update a studio (AUTH, owner-only)

Partial updates allowed — send only the fields to change.

```json
{ "hourlyRate": 1200, "amenities": ["Drum Kit", "Tube Amp", "AC", "LED Lights"] }
```

`updatedAt` is refreshed automatically.

Ownership rules (enforced by the controller once auth is live):

- Only the authenticated owner can update their own studio: the lookup
  combines the document id with the ownership filter (`hostId` when the
  doc has one; case-insensitive `hostEmail` fallback for legacy docs only).
- Everything else → **404 "Studio not found"** — the existence of other
  users' studios is never disclosed (never 403).
- Ownership is transfer-proof: `hostId`, `hostName`, `hostEmail`
  (ownership fields) are server-managed. Sending any of them is rejected
  with **400** and they cannot be used to hand the listing to someone else;
  updates limited to those fields alone respond with that error.

**200** → updated studio.
**400** → invalid ObjectId / validation error / empty body / ownership-field change attempted.
**404** → no studio with that id, or not the owner.
**501** → authentication not configured yet (current state)

### 6. DELETE /api/studios/:id — Delete a studio (AUTH, owner-only)

Same owner-only lookup as PUT: the delete query combines the document id
with the ownership filter — another host's studio cannot be deleted and
responds **404 "Studio not found"**.

**200** → `{ "success": true, "message": "Studio deleted successfully", "data": { ...deleted studio... } }`
**400** → invalid ObjectId. **404** → no studio with that id, or not the owner.
**501** → authentication not configured yet (current state)

---

## Category APIs — PUBLIC (new, read-only)

Categories are **not** a separate CRUD API (per project rules: one Studio API
with category filtering). Categories are a `category` string on studio
documents; the five known StudioSpace categories live in
`utils/categories.js` and mirror the frontend's category cards. Legacy
per-category collections (e.g. `Film Studio`) are untouched.

### 7. GET /api/categories — Known categories + live counts

Counts are computed from the actual `studios` collection. Any additional
category value found there is also returned (without a slug).

**200** →

```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": [
    { "slug": "photo-studios", "title": "Photo Studios", "studiosCount": 1 },
    { "slug": "film-stages", "title": "Film Stages", "studiosCount": 0 },
    { "slug": "podcast-rooms", "title": "Podcast Rooms", "studiosCount": 0 },
    { "slug": "music-suites", "title": "Music Suites", "studiosCount": 0 },
    { "slug": "art-workshops", "title": "Art Workshops", "studiosCount": 0 }
  ]
}
```

### 8. GET /api/categories/:category/studios — Category-wise studios

Accepts a **slug** (`photo-studios`), a **title** (`Photo Studios`), or any
stored category value — all case-insensitive. Additional studio filters
(`location`, `minPrice`, `maxPrice`, `search`) combine freely.

- `http://localhost:8000/api/categories/photo-studios/studios`
- `http://localhost:8000/api/categories/music-suites/studios?minPrice=500`

**200** → `{ "success": true, "message": "Studios for Photo Studios fetched successfully", "data": [ ...studios... ] }`

---

## Booking APIs — AUTH-REQUIRED (prepared for Better Auth)

Bookings live in their own `bookings` collection. Each booking snapshots the
studio fields it prices (`studioTitle`, `studioImage`, `studioLocation`,
`hourlyRate`, `securityDeposit`, host info) so history stays correct even if
the studio changes later.

Booking status flow: `pending → confirmed → completed` and
`pending|confirmed → cancelled`.

### 9. POST /api/bookings — Create a booking

Headers: `Content-Type: application/json`

```json
{
  "studioId": "6ae606ab2e5e995494a1478c",
  "bookingDate": "2026-11-15",
  "timeSlot": "10:00 - 13:00",
  "guests": 4,
  "fullName": "Jordan Smith",
  "email": "jordan@example.com",
  "phone": "+8801700000000",
  "notes": "Product shoot for a small brand catalogue."
}
```

Rules:

- `studioId` must be a valid ObjectId of an existing studio (else **400/404**).
- `bookingDate` — `YYYY-MM-DD` (or ISO string); **today or future**.
- `timeSlot` — non-empty free text (max 60 chars).
- `guests` — positive whole number, ≤ the studio's `maxCapacity`.
- `fullName`, `email` required; `email` must be valid; `phone`, `notes` optional (`notes` ≤ 1000 chars).
- **UserId comes from the authenticated session** (`req.user.id`) — never from the body.
- Another pending/confirmed booking already holding the exact
  studio + date + time slot → **409** (slot conflict, same user or not).
- `userId` inside the request body is ignored.

**201** → `{ "success": true, "message": "Booking created successfully", "data": { ...booking... } }`
**400** → invalid ObjectId / validation failure (`errors` object)
**404** → studio not found
**409** → time slot no longer available

### 10. GET /api/bookings/my — Current user's bookings

Returns all bookings where `userId` matches the signed-in user, sorted by
`bookingDate` ascending.

**200** → `{ "success": true, "message": "Bookings fetched successfully", "data": [ ...bookings... ] }`

### 11. GET /api/bookings/:id — Booking details

Accessible to the **booking owner** or the **host of the booked studio**.
Access by anyone else → **404** (other users' bookings are never disclosed).

**200** → booking. **400** → invalid ObjectId. **404** → not found / not yours.

### 12. PUT /api/bookings/:id — Update a pending booking (owner only)

Editable fields: `bookingDate`, `timeSlot`, `guests`, `fullName`, `email`,
`phone`, `notes`. New `guests` are re-validated against the studio's current
`maxCapacity`; date/time changes re-run the slot-conflict check (excluding
this booking itself).

```json
{ "bookingDate": "2026-11-20", "guests": 6, "notes": "Rescheduling — rain on the 15th." }
```

**200** → updated booking. **400** → validation failure / empty body.
**404** → not found or not yours. **409** → booking not `pending`, or slot conflict.

### 13. PATCH /api/bookings/:id/cancel — Cancel a booking (owner only)

Optional body:

```json
{ "cancelReason": "Shoot postponed by the client." }
```

`cancelReason` free text, max 500 chars, stored on the booking with a
`cancelledAt` timestamp.

**200** → cancelled booking. **400** → invalid ObjectId / `cancelReason` not a string.
**404** → not found or not yours. **409** → already `cancelled`, or `completed`.

---

## Host listing APIs — AUTH-REQUIRED (prepared for Better Auth)

Hosts manage ONLY their own listings. Ownership = `hostId` matches the
session user; for studios created before auth existed, a case-insensitive
`hostEmail` match against the session email grants ownership. Everything
else responds **404** (another host's listing existence is never disclosed).
`hostId`/`hostName`/`hostEmail` cannot be changed through these endpoints.

### 14. GET /api/hosts/listings — Current host's listings

**200** → `{ "success": true, "message": "Host listings fetched successfully", "data": [ ...listings newest first... ] }`

### 15. GET /api/hosts/listings/:id — Listing details (owner only)

**200** → listing. **400** → invalid ObjectId. **404** → not found or not yours.

### 16. PUT /api/hosts/listings/:id — Update own listing

Same partial-update rules as `PUT /api/studios/:id` (studio field
validation, `updatedAt` refresh).

```json
{ "hourlyRate": 1200, "maxCapacity": 12 }
```

**200** → updated listing. **400** → validation. **404** → not found or not yours.

### 17. DELETE /api/hosts/listings/:id — Delete own listing

**200** → `{ "success": true, "message": "Listing deleted successfully", "data": { ...deleted listing... } }`
**400** → invalid ObjectId. **404** → not found or not yours.

---

## User profile APIs — AUTH-REQUIRED (prepared for Better Auth)

The profile is the Better Auth `user` collection document. This API only
reads it and updates the whitelisted display field; credentials stay owned
by Better Auth's own endpoints.

### 18. GET /api/profile — Current user profile

**200** →

```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "id": "<user id>",
    "name": "Jordan Smith",
    "email": "jordan@example.com",
    "emailVerified": true,
    "image": null,
    "createdAt": "...",
    "updatedAt": "...",
    "stats": { "listingsCount": 2, "bookingsCount": 5 }
  }
}
```

### 19. PUT /api/profile — Update profile

```json
{ "name": "Jordan A. Smith" }
```

**200** → updated profile. **400** → validation failure / empty body.
**404** → user document gone (session user must re-authenticate).

---

## Authentication status

Better Auth is intentionally **not implemented yet**. Every auth-dependent
endpoint (studio mutations 4–6 and sections 9–19) is wrapped in
`requireAuth` (`middleware/authMiddleware.js`), which currently responds:

**501** →
```json
{
  "success": false,
  "message": "Authentication is not configured yet. This endpoint requires Better Auth integration and cannot accept requests."
}
```

No session verification or authentication secrets are invented anywhere in
this backend. When Better Auth ships:

1. Add `better-auth` + `@better-auth/mongo-adapter` and create a
   `betterAuth()` instance sharing the SAME `BETTER_AUTH_SECRET`, Mongo URI
   and database as the frontend auth server.
2. In `requireAuth`, serialize the incoming cookies (and optionally the
   `Authorization: Bearer <token>` header via its `bearer` plugin) into a
   `Headers` object and call `auth.api.getSession({ headers })`.
3. On failure respond **401**; on success set `req.user` and continue —
   controllers already consume the `req.user` contract
   (`req.user.id`, `req.user.email`, `req.user.name`) and never trust user
   identifiers supplied in request bodies. Studio mutations
   (`POST/PUT/DELETE /api/studios`) and host-listing routes immediately
   enforce owner-only access via `utils/ownership.js`: documents with a
   `hostId` match on hostId only; legacy documents (no `hostId`) match
   case-insensitive `hostEmail`.

---

## Error reference

| Status | Meaning |
|---|---|
| 200 / 201 | Success |
| 400 | Invalid ObjectId, validation failure, bad filter input, malformed JSON body |
| 401 | (future) session missing/invalid — once Better Auth is live |
| 404 | Resource not found, not found/not owner (bookings & host listings — to avoid disclosure), or unmatched route |
| 409 | Booking slot conflict, non-pending booking update, already-cancelled/completed booking |
| 500 | Unexpected server error (central `errorHandler`) |
| 501 | Auth-dependent endpoint before Better Auth integration (studio POST/PUT/DELETE, bookings, host listings, profile) |
| 503 | MongoDB not connected |

## CORS

`index.js` reads `CLIENT_ORIGIN` from `.env` (e.g. `http://localhost:3000`
for the Next.js client) and allows only those origins. Requests without an
`Origin` header (Thunder Client, curl, Postman) are always allowed during
development.

## Environment variables (.env — never commit real credentials)

```
PORT=8000
MONGODB_URL=mongodb+srv://...          # existing Atlas cluster
MONGODB_DB_NAME=studio_space           # existing database
CLIENT_ORIGIN=http://localhost:3000    # CORS for the Next.js client

# Optional overrides (defaults shown)
MONGODB_STUDIOS_COLLECTION=studios
MONGODB_BOOKINGS_COLLECTION=bookings
MONGODB_USERS_COLLECTION=user

# Future (added when Better Auth is integrated — do NOT invent now):
# BETTER_AUTH_SECRET=...               # must match the frontend auth server
# BETTER_AUTH_URL=http://localhost:3000
```

`user`, `session`, `account`, `verification` collections are created by
Better Auth's MongoDB adapter when auth goes live — this backend never
creates them proactively and existing data is never touched.

## Testing (curl / Thunder Client / Postman)

```bash
# Health
curl http://localhost:8000/

# Studios
curl http://localhost:8000/api/studios
curl "http://localhost:8000/api/studios?search=photography&minPrice=1000"
curl http://localhost:8000/api/studios/featured
curl http://localhost:8000/api/studios/<studioId>

# Categories
curl http://localhost:8000/api/categories
curl "http://localhost:8000/api/categories/photo-studios/studios"

# Create / update / delete — all respond 501 until Better Auth is integrated
curl -X POST http://localhost:8000/api/studios -H "Content-Type: application/json" -d '{ ...create payload above... }'
curl -X PUT http://localhost:8000/api/studios/<id> -H "Content-Type: application/json" -d '{"hourlyRate":1200}'
curl -X DELETE http://localhost:8000/api/studios/<id>

# Auth-dependent endpoints — all respond 501 until Better Auth is integrated
curl http://localhost:8000/api/bookings/my
curl -X POST http://localhost:8000/api/bookings ...
curl http://localhost:8000/api/hosts/listings
curl http://localhost:8000/api/profile
```

PowerShell alternative for POST/PUT bodies:

```powershell
Invoke-RestMethod -Uri http://localhost:8000/api/studios -Method POST `
  -ContentType 'application/json' -Body $json
```
