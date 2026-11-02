/**
 * Host listings controller.
 *
 * AUTH-DEPENDENT: every function here depends on `req.user`, which is set by
 * the authentication middleware. Until Better Auth is integrated, all host
 * routes respond 501.
 *
 * Ownership model (enforced once auth is live):
 *   - A listing is owned by its `hostId` (Better Auth user id) when set;
 *   - legacy studios created before auth only carry hostEmail — for those,
 *     ownership is matched case-insensitively against req.user.email so
 *     hosts keep control of their pre-auth listings.
 * Owners can update/delete ONLY their own listings; everything else 404s
 * (existence of other users' listings is never disclosed).
 */

import { ObjectId } from "mongodb";
import { getStudiosCollection } from "../config/db.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { isValidObjectId, validateStudioPayload, STUDIO_FIELDS } from "../utils/validation.js";
import { buildOwnershipQuery, OWNERSHIP_FIELDS } from "../utils/ownership.js";

function buildIdQuery(id) {
  return { _id: { $in: [new ObjectId(id), id] } };
}

// GET /api/hosts/listings — all listings of the signed-in host
export async function getMyListings(req, res, next) {
  try {
    const listings = await getStudiosCollection()
      .find(buildOwnershipQuery(req.user))
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    return sendSuccess(
      res,
      200,
      listings.length
        ? "Host listings fetched successfully"
        : "No listings found yet",
      listings
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/hosts/listings/:id — one listing, owner only
export async function getListingById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid listing ID");
    }

    const listing = await getStudiosCollection().findOne({
      ...buildIdQuery(id),
      ...buildOwnershipQuery(req.user),
    });

    if (!listing) {
      // Covers both "does not exist" and "belongs to another host".
      return sendError(res, 404, "Listing not found");
    }

    return sendSuccess(res, 200, "Listing found", listing);
  } catch (error) {
    next(error);
  }
}

// PUT /api/hosts/listings/:id — owner updates their listing
export async function updateListing(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid listing ID");
    }

    const { isValid, errors, data } = validateStudioPayload(
      req.body,
      { requireAll: false }
    );

    if (!isValid) {
      return sendError(res, 400, "Listing validation failed", { errors });
    }

    if (Object.keys(data).length === 0) {
      const editableFields = STUDIO_FIELDS.filter(
        (field) => !OWNERSHIP_FIELDS.includes(field)
      );

      return sendError(
        res,
        400,
        `Update body must contain at least one of: ${editableFields.join(", ")}`
      );
    }

    const collection = getStudiosCollection();

    const listing = await collection.findOne({
      ...buildIdQuery(id),
      ...buildOwnershipQuery(req.user),
    });

    if (!listing) {
      return sendError(res, 404, "Listing not found");
    }

    // Ownership fields are managed by the server, not the request body:
    // hosts cannot hand their listing to someone else or edit host metadata
    // (same rule as the /api/studios update endpoint cf. studioController).
    const ownershipAttempt = Object.keys(data).filter((field) =>
      OWNERSHIP_FIELDS.includes(field)
    );

    ownershipAttempt.forEach((field) => delete data[field]);

    await collection.updateOne(
      { _id: listing._id },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await collection.findOne({ _id: listing._id });

    return sendSuccess(res, 200, "Listing updated successfully", updated);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/hosts/listings/:id — owner deletes their listing
export async function deleteListing(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid listing ID");
    }

    const collection = getStudiosCollection();

    const deleted = await collection.findOneAndDelete({
      ...buildIdQuery(id),
      ...buildOwnershipQuery(req.user),
    });

    if (!deleted) {
      return sendError(res, 404, "Listing not found");
    }

    return sendSuccess(res, 200, "Listing deleted successfully", deleted);
  } catch (error) {
    next(error);
  }
}
