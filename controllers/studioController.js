
import { ObjectId } from "mongodb";
import { getStudiosCollection } from "../config/db.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import {
  isValidObjectId,
  validateStudioPayload,
  buildStudioFilter,
  STUDIO_FIELDS,
} from "../utils/validation.js";
import {
  buildOwnershipQuery,
  OWNERSHIP_FIELDS,
} from "../utils/ownership.js";

// Builds a query that matches a studio _id whether it was stored as a
// real ObjectId (new inserts) or as a 24-char hex string (legacy documents).
function buildIdQuery(id) {
  return { _id: { $in: [new ObjectId(id), id] } };
}

// 1. GET /api/studios
export async function getAllStudios(req, res, next) {
  try {
    const collection = getStudiosCollection();

    // buildStudioFilter validates the query string and returns
    // { filter, error } — respond 400 when the input is bad.
    const { filter, error } = buildStudioFilter(req.query);

    if (error) {
      return sendError(res, 400, error);
    }

    // Newest first; _id as tiebreaker for documents sharing a timestamp.
    const studios = await collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    return sendSuccess(
      res,
      200,
      studios.length
        ? "Studios fetched successfully"
        : "No studios found yet",
      studios
    );
  } catch (error) {
    next(error);
  }
}

// 2. GET /api/studios/featured
export async function getFeaturedStudios(req, res, next) {
  try {
    const studios = await getStudiosCollection()
      .find({})
      .sort({ createdAt: -1, _id: -1 })
      .limit(6)
      .toArray();

    return sendSuccess(
      res,
      200,
      "Featured studios fetched successfully",
      studios
    );
  } catch (error) {
    next(error);
  }
}

// 3. GET /api/studios/:id
export async function getStudioById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid studio ID");
    }

    const studio = await getStudiosCollection().findOne(buildIdQuery(id));

    if (!studio) {
      return sendError(res, 404, "Studio not found");
    }

    return sendSuccess(res, 200, "Studio found", studio);
  } catch (error) {
    next(error);
  }
}

// 4. POST /api/studios — AUTH-DEPENDENT (protected with requireAuth)
export async function createStudio(req, res, next) {
  try {
    const { isValid, errors, data } = validateStudioPayload(
      req.body,
      { requireAll: true }
    );

    if (!isValid) {
      return sendError(res, 400, "Studio validation failed", { errors });
    }

    const now = new Date();

    const doc = {
      ...data,
      // Identity is stamped from the authenticated session — NEVER from
      // the request body. Any hostId supplied in the body is already
      // dropped by validateStudioPayload (it is not an accepted field).
      hostId: req.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const collection = getStudiosCollection();
    const result = await collection.insertOne(doc);

    const studio = await collection.findOne({
      _id: result.insertedId,
    });

    return sendSuccess(res, 201, "Studio created successfully", studio);
  } catch (error) {
    next(error);
  }
}

// 5. PUT /api/studios/:id — AUTH-DEPENDENT, owner-only
export async function updateStudio(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid studio ID");
    }

    const { isValid, errors, data } = validateStudioPayload(
      req.body,
      { requireAll: false }
    );

    if (!isValid) {
      return sendError(res, 400, "Studio validation failed", { errors });
    }

    // Ownership fields are server-managed: hostId is stamped from the
    // session at creation (createStudio) and can NEVER be transferred or
    // overwritten through this endpoint — attempts are rejected.
    const ownershipAttempt = Object.keys(data).filter((field) =>
      OWNERSHIP_FIELDS.includes(field)
    );

    ownershipAttempt.forEach((field) => delete data[field]);

    if (Object.keys(data).length === 0) {
      return sendError(
        res,
        400,
        ownershipAttempt.length
          ? `Ownership fields (${OWNERSHIP_FIELDS.join(", ")}) are managed by the server and cannot be changed here`
          : `Update body must contain at least one of: ${STUDIO_FIELDS.filter((f) => !OWNERSHIP_FIELDS.includes(f)).join(", ")}`
      );
    }

    const collection = getStudiosCollection();

    // Owner-only: combined id + ownership filter. A studio that exists but
    // is owned by someone else resolves to 404 (never 403) so the existence
    // of other users' private listings is not disclosed.
    const current = await collection.findOne({
      ...buildIdQuery(id),
      ...buildOwnershipQuery(req.user),
    });

    if (!current) {
      return sendError(res, 404, "Studio not found");
    }

    const result = await collection.updateOne(
      { _id: current._id },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return sendError(res, 404, "Studio not found");
    }

    const updated = await collection.findOne({ _id: current._id });

    return sendSuccess(res, 200, "Studio updated successfully", updated);
  } catch (error) {
    next(error);
  }
}

// 6. DELETE /api/studios/:id — AUTH-DEPENDENT, owner-only
export async function deleteStudio(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid studio ID");
    }

    const collection = getStudiosCollection();

    // Owner-only: only the authenticated host may delete their own studio.
    const deleted = await collection.findOneAndDelete({
      ...buildIdQuery(id),
      ...buildOwnershipQuery(req.user),
    });

    if (!deleted) {
      // Not found OR owned by another host — same 404, no disclosure.
      return sendError(res, 404, "Studio not found");
    }

    return sendSuccess(res, 200, "Studio deleted successfully", deleted);
  } catch (error) {
    next(error);
  }
}
