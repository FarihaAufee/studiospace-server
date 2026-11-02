

import { getStudiosCollection, getBookingsCollection, getUserCollection } from "../config/db.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { validateProfileUpdate } from "../utils/validation.js";

/**
 * Reads the current Better Auth user document fresh from the database so the
 * profile always reflects stored values rather than stale session data.
 * Returns a safe public profile shape — no password/auth material.
 */
export async function getProfile(req, res, next) {
  try {
    const profile = await fetchUserProfile(req.user);

    if (!profile) {
      // Session valid but the user document is gone — the client must sign in again.
      return sendError(res, 404, "User profile not found");
    }

    return sendSuccess(res, 200, "Profile fetched successfully", profile);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/profile — updates only whitelisted profile fields on the Better
 * Auth user document. Currently: `name`.
 */
export async function updateProfile(req, res, next) {
  try {
    const { isValid, errors, data } = validateProfileUpdate(req.body);

    if (!isValid) {
      return sendError(res, 400, "Profile validation failed", { errors });
    }

    if (Object.keys(data).length === 0) {
      return sendError(res, 400, "Update body must contain at least one of: name");
    }

    const userDoc = await getUserCollection().findOne({ _id: req.user.id });

    if (!userDoc) {
      return sendError(res, 404, "User profile not found");
    }

    await getUserCollection().updateOne(
      { _id: userDoc._id },
      { $set: { name: data.name, updatedAt: new Date() } }
    );

    const profile = await fetchUserProfile(req.user);

    return sendSuccess(res, 200, "Profile updated successfully", profile);
  } catch (error) {
    next(error);
  }
}

/**
 * Loads the fresh user document from the `user` collection and maps it to a
 * safe public profile shape (no password/auth data ever leaves the server).
 * Better Auth's MongoDB adapter stores this in a collection named "user".
 */
async function fetchUserProfile(authUser) {
  const userDoc = await getUserCollection().findOne({ _id: authUser.id });

  if (!userDoc) return null;

  // Lightweight profile stats from the collections this backend owns.
  const [listingsCount, bookingsCount] = await Promise.all([
    getStudiosCollection().countDocuments({ hostId: authUser.id }),
    getBookingsCollection().countDocuments({ userId: authUser.id }),
  ]);

  return {
    id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    emailVerified: userDoc.emailVerified,
    image: userDoc.image ?? null,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt ?? null,
    stats: {
      listingsCount,
      bookingsCount,
    },
  };
}
