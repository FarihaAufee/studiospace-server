/**
 * Known StudioSpace categories.
 *
 * Mirrors the frontend's src/data/categories.ts (slug + title pairs).
 * Studios can still be created with any `category` string — the endpoints
 * built on top of this list simply *know* these five and additionally
 * surface any other distinct values already present in the studios collection.
 */

const KNOWN_CATEGORIES = [
  { slug: "photo-studios", title: "Photo Studios" },
  { slug: "film-stages", title: "Film Stages" },
  { slug: "podcast-rooms", title: "Podcast Rooms" },
  { slug: "music-suites", title: "Music Suites" },
  { slug: "art-workshops", title: "Art Workshops" },
];

/**
 * Resolve a category identifier (slug, title, or any casing) to the
 * canonical `{ slug, title }` pair, or `null` when unknown.
 *
 * Example: "photo-studios", "Photo Studios", "PHOTO STUDIOS" all resolve
 * to { slug: "photo-studios", title: "Photo Studios" }.
 */
export function resolveCategory(identifier) {
  if (typeof identifier !== "string") return null;

  const value = identifier.trim().toLowerCase();

  return (
    KNOWN_CATEGORIES.find(
      (category) =>
        category.slug === value ||
        category.title.toLowerCase() === value
    ) || null
  );
}

/**
 * Build a case-insensitive exact-match Mongo filter for a category string
 * (either slug or title). Returns a Mongo filter for the `category` field.
 */
export function buildCategoryFilter(identifier) {
  const canonical = resolveCategory(identifier);
  const matchValue = canonical ? canonical.title : String(identifier).trim();

  return { $regex: `^${escape(matchValue)}$`, $options: "i" };
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getKnownCategories() {
  return KNOWN_CATEGORIES;
}
