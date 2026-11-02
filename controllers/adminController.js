

import { getStudiosCollection, getUserCollection, getBookingsCollection } from "../config/db.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import {
  buildIdQuery,
  isValidObjectId,
  validateStudioPayload,
  STUDIO_FIELDS,
} from "../utils/validation.js";

// Any studio read (list + single) shares the public handlers exactly �?"
// same filters, same legacy-id handling �?" no behavioural drift.
import { getAllStudios, getStudioById } from "./studioController.js";

export const getAdminStudios = getAllStudios;
export const getAdminStudioById = getStudioById;

// PUT /api/admin/studios/:id �?" update any studio (admin only)
export async function updateAdminStudio(req, res, next) {
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

    // hostId remains server-managed even for admins: it is the ownership
    // identity stamped from the authenticated host's session at creation,
    // so no HTTP request may move a studio to another user. hostName/hostEmail
    // are editable display/contact fields an admin may correct.
    delete data.hostId;

    if (Object.keys(data).length === 0) {
      const editableFields = STUDIO_FIELDS.filter((field) => field !== "hostId");

      return sendError(
        res,
        400,
        `Update body must contain at least one of: ${editableFields.join(", ")}`
      );
    }

    const collection = getStudiosCollection();

    // No ownership filter here �?" admins manage every studio, including
    // legacy/demo documents that no host owns.
    const studio = await collection.findOne(buildIdQuery(id));

    if (!studio) {
      return sendError(res, 404, "Studio not found");
    }

    await collection.updateOne(
      { _id: studio._id },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await collection.findOne({ _id: studio._id });

    return sendSuccess(res, 200, "Studio updated successfully", updated);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/admin/studios/:id �?" delete any studio (admin only)
export async function deleteAdminStudio(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid studio ID");
    }

    // No ownership filter �?" admins may remove any studio, including
    // legacy/demo documents carrying string _id values.
    const deleted = await getStudiosCollection().findOneAndDelete(
      buildIdQuery(id)
    );

    if (!deleted) {
      return sendError(res, 404, "Studio not found");
    }

    return sendSuccess(res, 200, "Studio deleted successfully", deleted);
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/stats �?" dashboard totals (admin only)
// Counts live collections directly in MongoDB �?" real numbers from the
// database, never fabricated on the client.
export async function getAdminStats(req, res, next) {
  try {
    const [totalStudios, totalUsers, totalBookings] = await Promise.all([
      getStudiosCollection().countDocuments({}),
      getUserCollection().countDocuments({}),
      getBookingsCollection().countDocuments({}),
    ]);

    return sendSuccess(res, 200, "Admin stats fetched successfully", {
      totalStudios,
      totalUsers,
      totalBookings,
    });
  } catch (error) {
    next(error);
  }
}
