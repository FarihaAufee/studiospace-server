
/**
 * Validation helpers for StudioSpace API.
 */

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(value) {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Accepted studio fields
const STRING_FIELDS = [
  "title",
  "category",
  "location",
  "address",
  "image",
  "overview",
  "hostName",
  "hostEmail",
];

const NUMBER_FIELDS = [
  "hourlyRate",
  "securityDeposit",
  "maxCapacity",
];

const ARRAY_FIELDS = ["amenities"];

export const STUDIO_FIELDS = [
  ...STRING_FIELDS,
  ...NUMBER_FIELDS,
  ...ARRAY_FIELDS,
];

/**
 * Validate and sanitize studio payload.
 */
export function validateStudioPayload(
  body,
  { requireAll = false } = {}
) {
  const errors = {};
  const data = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: "Request body must be a JSON object" },
      data: {},
    };
  }

  // Required string fields
  const requiredStrings = [
    "title",
    "category",
    "location",
    "address",
    "image",
    "overview",
    "hostName",
    "hostEmail",
  ];

  for (const field of STRING_FIELDS) {
    const provided = body[field] !== undefined;

    if (requireAll && requiredStrings.includes(field) && !provided) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (!provided) continue;

    if (typeof body[field] !== "string" || !body[field].trim()) {
      errors[field] = `${field} must be a non-empty string`;
      continue;
    }

    data[field] = body[field].trim();
  }

  // Email validation
  if (data.hostEmail) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(data.hostEmail)) {
      errors.hostEmail = "Please provide a valid email address";
    }
  }

  // Number validation
  for (const field of NUMBER_FIELDS) {
    const provided = body[field] !== undefined;

    if (requireAll && !provided) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (!provided) continue;

    const value = Number(body[field]);

    if (!Number.isFinite(value) || value < 0) {
      errors[field] = `${field} must be a non-negative number`;
      continue;
    }

    if (
      (field === "hourlyRate" || field === "maxCapacity") &&
      value <= 0
    ) {
      errors[field] = `${field} must be greater than zero`;
      continue;
    }

    if (field === "maxCapacity" && !Number.isInteger(value)) {
      errors[field] = "maxCapacity must be a whole number";
      continue;
    }

    data[field] = value;
  }

  // Amenities validation
  if (requireAll && body.amenities === undefined) {
    data.amenities = [];
  } else if (body.amenities !== undefined) {
    if (
      !Array.isArray(body.amenities) ||
      !body.amenities.every(
        (item) => typeof item === "string" && item.trim()
      )
    ) {
      errors.amenities =
        "amenities must be an array of non-empty strings";
    } else {
      data.amenities = body.amenities.map((item) => item.trim());
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data,
  };
}

/**
 * Build MongoDB filters from query string.
 * Supported query params: category, location, minPrice, maxPrice, search.
 * Returns { filter, error } — error is a non-null 400 message on bad input.
 */export function buildStudioFilter(query) {
  const filter = {};

  if (query.category !== undefined) {
    const category = String(query.category).trim();

    if (!category) {
      return { filter: null, error: "category cannot be empty" };
    }

    filter.category = {
      $regex: `^${escapeRegex(category)}$`,
      $options: "i",
    };
  }

  if (query.location !== undefined) {
    const location = String(query.location).trim();

    if (!location) {
      return { filter: null, error: "location cannot be empty" };
    }

    filter.location = {
      $regex: escapeRegex(location),
      $options: "i",
    };
  }

  // Free-text search across the main studio and host fields.
  // Uses case-insensitive partial matching ("contains") on each field.
  if (query.search !== undefined) {
    const search = String(query.search).trim();

    if (!search) {
      return { filter: null, error: "search cannot be empty" };
    }

    const pattern = { $regex: escapeRegex(search), $options: "i" };

    filter.$or = [
      { title: pattern },
      { category: pattern },
      { location: pattern },
      { overview: pattern },
      { hostName: pattern },
    ];
  }

  const hasMin = query.minPrice !== undefined;
  const hasMax = query.maxPrice !== undefined;

  if (hasMin || hasMax) {
    const minPrice = hasMin ? Number(query.minPrice) : undefined;
    const maxPrice = hasMax ? Number(query.maxPrice) : undefined;

    if (hasMin && (!Number.isFinite(minPrice) || minPrice < 0)) {
      return {
        filter: null,
        error: "minPrice must be a non-negative number",
      };
    }

    if (hasMax && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
      return {
        filter: null,
        error: "maxPrice must be a non-negative number",
      };
    }

    if (hasMin && hasMax && minPrice > maxPrice) {
      return {
        filter: null,
        error: "minPrice cannot be greater than maxPrice",
      };
    }

    filter.hourlyRate = {};

    if (hasMin) filter.hourlyRate.$gte = minPrice;
    if (hasMax) filter.hourlyRate.$lte = maxPrice;
  }

  return { filter, error: null };
}

/* ------------------------------------------------------------------ */
/* Booking validation                                                  */
/* ------------------------------------------------------------------ */

const BOOKING_STATUS = ["pending", "confirmed", "completed", "cancelled"];

export const BOOKING_FIELDS = [
  "bookingDate",
  "timeSlot",
  "guests",
  "fullName",
  "email",
  "phone",
  "notes",
];

/**
 * A booking date accepts "YYYY-MM-DD" (preferred on the client) or an
 * ISO timestamp; both are stored as a UTC midnight Date for stable
 * querying. Returns { value, error }.
 */
export function parseBookingDate(input, { requireFuture = false } = {}) {
  if (typeof input !== "string" || !input.trim()) {
    return { value: null, error: "bookingDate is required (YYYY-MM-DD)" };
  }

  const raw = input.trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let date;

  if (match) {
    date = new Date(`${raw}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== raw
    ) {
      return { value: null, error: "bookingDate must be a valid calendar date (YYYY-MM-DD)" };
    }
  } else {
    date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return { value: null, error: "bookingDate must be YYYY-MM-DD or an ISO date string" };
    }

    date = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
  }

  if (requireFuture) {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    if (date < todayUtc) {
      return { value: null, error: "bookingDate cannot be in the past" };
    }
  }

  return { value: date, error: null };
}

function isValidTimeSlot(slot) {
  // Flexible: "10:00 - 13:00", "14:00 to 16:00", "evening" etc.
  // Rule: non-empty, max 60 chars, no control characters.
  return typeof slot === "string" && slot.trim().length > 0 && slot.trim().length <= 60 && !/[\u0000-\u001F]/.test(slot);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a booking create payload (POST /api/bookings).
 * `studio` is the fetched studio document — used to cross-check date
 * capacity fields. User identity is NEVER taken from the body; requests
 * that need a userId must come from middleware (see authMiddleware.js).
 */
export function validateBookingPayload(body, { studio }) {
  const errors = {};
  const data = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: "Request body must be a JSON object" },
      data: {},
    };
  }

  // bookingDate — required, today or future
  const parsedDate = parseBookingDate(body.bookingDate, { requireFuture: true });

  if (parsedDate.error) errors.bookingDate = parsedDate.error;
  else data.bookingDate = parsedDate.value;

  // timeSlot — required free-text slot
  if (body.timeSlot === undefined) {
    errors.timeSlot = "timeSlot is required";
  } else if (!isValidTimeSlot(body.timeSlot)) {
    errors.timeSlot = "timeSlot must be a non-empty string (max 60 characters)";
  } else {
    data.timeSlot = body.timeSlot.trim();
  }

  // guests — required, whole number, > 0, within studio capacity
  if (body.guests === undefined) {
    errors.guests = "guests is required";
  } else {
    const guests = Number(body.guests);

    if (!Number.isInteger(guests) || guests <= 0) {
      errors.guests = "guests must be a whole number greater than zero";
    } else if (
      studio &&
      Number.isFinite(studio.maxCapacity) &&
      guests > studio.maxCapacity
    ) {
      errors.guests = `guests cannot exceed this studio's maxCapacity of ${studio.maxCapacity}`;
    } else {
      data.guests = guests;
    }
  }

  // fullName — required
  if (body.fullName === undefined) {
    errors.fullName = "fullName is required";
  } else if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    errors.fullName = "fullName must be a non-empty string";
  } else {
    data.fullName = body.fullName.trim();
  }

  // email — required, valid
  if (body.email === undefined) {
    errors.email = "email is required";
  } else if (typeof body.email !== "string" || !emailPattern.test(body.email.trim())) {
    errors.email = "Please provide a valid email address";
  } else {
    data.email = body.email.trim();
  }

  // phone — optional
  if (body.phone !== undefined) {
    if (typeof body.phone !== "string" || !body.phone.trim()) {
      errors.phone = "phone must be a non-empty string";
    } else {
      data.phone = body.phone.trim();
    }
  }

  // notes — optional, capped
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      errors.notes = "notes must be a string";
    } else if (body.notes.trim().length > 1000) {
      errors.notes = "notes cannot exceed 1000 characters";
    } else {
      data.notes = body.notes.trim();
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data,
  };
}

/**
 * Validate Booking update payloads (PUT).
 * Editable while pending: bookingDate, timeSlot, guests, phone, notes, fullName.
 * Returns { isValid, errors, data } where data holds only provided fields.
 */
export function validateBookingUpdate(body, { studio } = {}) {
  const errors = {};
  const data = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: "Request body must be a JSON object" },
      data: {},
    };
  }

  if (body.bookingDate !== undefined) {
    const parsedDate = parseBookingDate(body.bookingDate, { requireFuture: true });

    if (parsedDate.error) errors.bookingDate = parsedDate.error;
    else data.bookingDate = parsedDate.value;
  }

  if (body.timeSlot !== undefined) {
    if (!isValidTimeSlot(body.timeSlot)) {
      errors.timeSlot = "timeSlot must be a non-empty string (max 60 characters)";
    } else {
      data.timeSlot = body.timeSlot.trim();
    }
  }

  if (body.guests !== undefined) {
    const guests = Number(body.guests);

    if (!Number.isInteger(guests) || guests <= 0) {
      errors.guests = "guests must be a whole number greater than zero";
    } else if (
      studio &&
      Number.isFinite(studio.maxCapacity) &&
      guests > studio.maxCapacity
    ) {
      errors.guests = `guests cannot exceed this studio's maxCapacity of ${studio.maxCapacity}`;
    } else {
      data.guests = guests;
    }
  }

  if (body.fullName !== undefined) {
    if (typeof body.fullName !== "string" || !body.fullName.trim()) {
      errors.fullName = "fullName must be a non-empty string";
    } else {
      data.fullName = body.fullName.trim();
    }
  }

  if (body.email !== undefined) {
    if (typeof body.email !== "string" || !emailPattern.test(body.email.trim())) {
      errors.email = "Please provide a valid email address";
    } else {
      data.email = body.email.trim();
    }
  }

  if (body.phone !== undefined) {
    if (typeof body.phone !== "string" || !body.phone.trim()) {
      errors.phone = "phone must be a non-empty string";
    } else {
      data.phone = body.phone.trim();
    }
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      errors.notes = "notes must be a string";
    } else if (body.notes.trim().length > 1000) {
      errors.notes = "notes cannot exceed 1000 characters";
    } else {
      data.notes = body.notes.trim();
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data,
  };
}

export function parseCancelReason(body) {
  if (body.cancelReason === undefined || body.cancelReason === null) {
    return "";
  }

  if (typeof body.cancelReason !== "string") {
    return null;
  }

  const trimmed = body.cancelReason.trim().slice(0, 500);

  return trimmed;
}

export function getBookingStatuses() {
  return [...BOOKING_STATUS];
}

/* ------------------------------------------------------------------ */
/* User profile validation (wired to the future `user` collection)     */
/* ------------------------------------------------------------------ */

export function validateProfileUpdate(body) {
  const errors = {};
  const data = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: "Request body must be a JSON object" },
      data: {},
    };
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      errors.name = "name must be a non-empty string";
    } else {
      data.name = body.name.trim();
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data,
  };
}
