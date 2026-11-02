/**
 * Category controller.
 *
 * Categories are NOT stored in their own collection (per project rules there
 * is a single Studio API — categories are just a `category` string on studio
 * documents). The known studio-space categories come from
 * utils/categories.js and live counts are computed from the studios
 * collection. Legacy per-category collections (e.g. "Film Studio") are left
 * untouched and are not surfaced here.
 */

import { getStudiosCollection } from "../config/db.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { getKnownCategories, resolveCategory, buildCategoryFilter } from "../utils/categories.js";
import { buildStudioFilter } from "../utils/validation.js";

// 1. GET /api/categories
export async function getAllCategories(req, res, next) {
  try {
    const collection = getStudiosCollection();

    // Counts per category (case-insensitive). Trim values — the seed data
    // contains stray whitespace around the category names.
    const grouped = await collection
      .aggregate([
        {
          $project: {
            category: { $trim: { input: { $ifNull: ["$category", ""] } } },
          },
        },
        { $match: { category: { $ne: "" } } },
        {
          $group: {
            _id: { $toLower: "$category" },
            title: { $first: "$category" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, title: 1 } },
      ])
      .toArray();

    const countByTitle = new Map(
      grouped.map((row) => [row.title.toLowerCase(), row.count])
    );

    const known = getKnownCategories().map((category) => ({
      slug: category.slug,
      title: category.title,
      studiosCount: countByTitle.get(category.title.toLowerCase()) || 0,
    }));

    const knownTitles = new Set(
      known.map((category) => category.title.toLowerCase())
    );

    // Any other distinct category already present in the collection is
    // included as well (no slug — slugs only exist for known categories).
    const extras = grouped
      .filter((row) => !knownTitles.has(row.title.toLowerCase()))
      .map((row) => ({
        slug: null,
        title: row.title,
        studiosCount: row.count,
      }));

    return sendSuccess(res, 200, "Categories fetched successfully", [
      ...known,
      ...extras,
    ]);
  } catch (error) {
    next(error);
  }
}

// 2. GET /api/categories/:category/studios
// Accepts a slug ("photo-studios"), a title ("Photo Studios"), or any
// distinct category value stored on studio documents (case-insensitive).
// Additional studio filters (location, minPrice, maxPrice, search) combine.
export async function getStudiosByCategory(req, res, next) {
  try {
    const { category } = req.params;

    if (!category || !String(category).trim()) {
      return sendError(res, 400, "category cannot be empty");
    }

    const canonical = resolveCategory(category);
    const knownFilter = buildCategoryFilter(category);

    // Bypass buildStudioFilter's own category handling — this endpoint owns
    // the category field; all other filters are delegated to it.
    const { filter, error } = buildStudioFilter({
      ...req.query,
      category: undefined,
    });

    if (error) {
      return sendError(res, 400, error);
    }

    const studioFilter = { ...filter, category: knownFilter };

    const studios = await getStudiosCollection()
      .find(studioFilter)
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    return sendSuccess(
      res,
      200,
      studios.length
        ? `Studios${canonical ? ` for ${canonical.title}` : ""} fetched successfully`
        : "No studios found for this category",
      studios
    );
  } catch (error) {
    next(error);
  }
}
