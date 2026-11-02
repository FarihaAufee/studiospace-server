/**
 * Booking controller.
 *
 * AUTH-DEPENDENT: every function here depends on `req.user`, which is set by
 * the authentication middleware (middleware/authMiddleware.js). Until Better
 * Auth is integrated, all booking routes respond 501 — user identity is never
 * taken from request bodies or query strings.
 *
 * Bookings live in their own collection ("bookings", override with
 * MONGODB_BOOKINGS_COLLECTION). Each booking snapshots the studio fields it
 * prices (title/image/location/hourlyRate/securityDeposit) so history stays
 * correct even if a studio is later changed or deleted.
 */

import { ObjectId } from "mongodb";
import { getStudiosCollection, getBookingsCollection } from "../config/db.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import {
  isValidObjectId,
  validateBookingPayload,
  validateBookingUpdate,
  parseCancelReason,
} from "../utils/validation.js";

// Matches _id stored as ObjectId or legacy 24-char hex string (same
// strategy as the existing studio controller).
function buildIdQuery(id) {
  return { _id: { $in: [new ObjectId(id), id] } };
}

// GET /api/bookings/my — bookings of the currently signed-in user
export async function getMyBookings(req, res, next) {
  try {
    const bookings = await getBookingsCollection()
      .find({ userId: req.user.id })
      .sort({ bookingDate: 1, createdAt: -1 })
      .toArray();

    return sendSuccess(
      res,
      200,
      bookings.length
        ? "Bookings fetched successfully"
        : "No bookings found yet",
      bookings
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/bookings/:id — owner of the booking or host of the studio only
export async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid booking ID");
    }

    const booking = await getBookingsCollection().findOne(buildIdQuery(id));

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    const isOwner = booking.userId === req.user.id;
    const isHost = booking.hostId === req.user.id;

    if (!isOwner && !isHost) {
      // Deliberately 404 (not 403) — do not disclose other users' bookings.
      return sendError(res, 404, "Booking not found");
    }

    return sendSuccess(res, 200, "Booking found", booking);
  } catch (error) {
    next(error);
  }
}

// POST /api/bookings — create a booking for the signed-in user
export async function createBooking(req, res, next) {
  try {
    const { studioId } = req.body;

    if (!isValidObjectId(studioId)) {
      return sendError(res, 400, "studioId must be a valid MongoDB ObjectId");
    }

    const studios = getStudiosCollection();
    const studio = await studios.findOne(buildIdQuery(studioId));

    if (!studio) {
      return sendError(res, 404, "Studio not found");
    }

    const { isValid, errors, data } = validateBookingPayload(req.body, { studio });

    if (!isValid) {
      return sendError(res, 400, "Booking validation failed", { errors });
    }

    const bookings = getBookingsCollection();

    // Block duplicate pending/confirmed bookings for the exact same
    // studio + date + time slot. Two users or the same user both get 409.
    const duplicate = await bookings.countDocuments({
      studioId: studio._id,
      bookingDate: data.bookingDate,
      timeSlot: data.timeSlot,
      status: { $in: ["pending", "confirmed"] },
    });

    if (duplicate > 0) {
      return sendError(
        res,
        409,
        "This time slot is no longer available. Please choose another date or time."
      );
    }

    const now = new Date();

    const doc = {
      // Identity comes from middleware — NEVER from the request body.
      userId: req.user.id,
      studioId: studio._id,
      // Snapshot of the studio at booking time
      studioTitle: studio.title,
      studioImage: studio.image,
      studioLocation: studio.location,
      studioCategory: studio.category,
      hourlyRate: studio.hourlyRate,
      securityDeposit: studio.securityDeposit,
      // The host snapshot (legacy studios already carry hostEmail).
      hostId: studio.hostId ?? null,
      hostName: studio.hostName,
      hostEmail: studio.hostEmail,
      // Demand data
      ...data,
      status: "pending",
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await bookings.insertOne(doc);
    const created = await bookings.findOne({ _id: result.insertedId });

    return sendSuccess(res, 201, "Booking created successfully", created);
  } catch (error) {
    next(error);
  }
}

// PUT /api/bookings/:id — owner updates a pending booking
export async function updateBooking(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid booking ID");
    }

    const bookings = getBookingsCollection();
    const booking = await bookings.findOne(buildIdQuery(id));

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    if (booking.userId !== req.user.id) {
      return sendError(res, 404, "Booking not found");
    }

    if (booking.status !== "pending") {
      return sendError(
        res,
        409,
        `Only pending bookings can be updated. This booking is ${booking.status}.`
      );
    }

    // Re-validate against the studio's current capacity rules.
    const studio = await getStudiosCollection().findOne({
      _id: booking.studioId,
    });

    const { isValid, errors, data } = validateBookingUpdate(req.body, { studio });

    if (!isValid) {
      return sendError(res, 400, "Booking validation failed", { errors });
    }

    const editableFields = [
      "bookingDate",
      "timeSlot",
      "guests",
      "fullName",
      "email",
      "phone",
      "notes",
    ];

    if (!Object.keys(data).length) {
      return sendError(
        res,
        400,
        `Update body must contain at least one of: ${editableFields.join(", ")}`
      );
    }

    // Slot conflict check only when date/time booking fields change.
    if (data.bookingDate || data.timeSlot) {
      const duplicate = await bookings.countDocuments({
        _id: { $ne: booking._id },
        studioId: booking.studioId,
        bookingDate: data.bookingDate ?? booking.bookingDate,
        timeSlot: data.timeSlot ?? booking.timeSlot,
        status: { $in: ["pending", "confirmed"] },
      });

      if (duplicate > 0) {
        return sendError(
          res,
          409,
          "This time slot is no longer available. Please choose another date or time."
        );
      }
    }

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await bookings.findOne({ _id: booking._id });

    return sendSuccess(res, 200, "Booking updated successfully", updated);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/bookings/:id/cancel — owner cancels their booking
export async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid booking ID");
    }

    const bookings = getBookingsCollection();
    const booking = await bookings.findOne(buildIdQuery(id));

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    if (booking.userId !== req.user.id) {
      return sendError(res, 404, "Booking not found");
    }

    // if (booking.status === "cancelled") {
    //   return sendError(res, 409, "Booking is already cancelled");
    // }

    if (booking.status === "completed") {
      return sendError(res, 409, "Completed bookings cannot be cancelled");
    }

    const cancelReason = parseCancelReason(req.body);

    if (cancelReason === null) {
      return sendError(res, 400, "cancelReason must be a string");
    }

    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: {
          status: "cancelled",
          cancelReason,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    const cancelled = await bookings.findOne({ _id: booking._id });

    return sendSuccess(res, 200, "Booking cancelled successfully", cancelled);
  } catch (error) {
    next(error);
  }
}
