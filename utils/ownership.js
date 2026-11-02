/**
 * Ownership helpers shared by the studio controller and the host-listings
 * controller.
 *
 * Identity ALWAYS comes from req.user (populated by the auth middleware,
 * middleware/authMiddleware.js) — never from request bodies.
 *
 * Ownership model:
 *   - Studios created after auth goes live carry `hostId`: ownership
 *     requires an exact hostId match (hostEmail is display-only for them).
 *   - Legacy studios (created before auth) have no `hostId`, only
 *     `hostEmail`: ownership falls back to a case-insensitive
 *     hostEmail match against the session user's email.
 *
 * The $or/$and structure below encodes both branches in one Mongo query,
 * so a document that HAS a hostId can never be claimed via a hostEmail
 * match — ownership cannot be spoofed or transferred through body fields.
 */

const EMAIL_PATTERN_SOURCE = (email) =>
  `^${String(email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

/**
 * Mongo query matching documents owned by `user`.
 * Returns a fragment intended to be spread into another filter.
 */
export function buildOwnershipQuery(user) {
  const $or = [{ hostId: user.id }];

  // Legacy fallback: only for documents that carry no hostId at all.
  if (user.email) {
    $or.push({
      $and: [
        {
          hostId: {
            $in: [null],
            $exists: false,
          },
        },
        {
          hostEmail: {
            $regex: EMAIL_PATTERN_SOURCE(user.email),
            $options: "i",
          },
        },
      ],
    });
  }

  return { $or };
}

/**
 * Plain-JS ownership check for a single already-fetched document.
 */
export function isOwnedBy(document, user) {
  if (!document || !user) return false;

  const hasHostId = document.hostId !== undefined && document.hostId !== null;

  if (hasHostId) {
    return document.hostId === user.id;
  }

  return (
    typeof document.hostEmail === "string" &&
    typeof user.email === "string" &&
    document.hostEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
  );
}

/**
 * Ownership/identity fields are managed by the server: hostId is stamped
 * from the session at creation and can never be transferred through
 * create/update payloads.
 */
export const OWNERSHIP_FIELDS = ["hostId", "hostName", "hostEmail"];

export function isOwnershipField(field) {
  return OWNERSHIP_FIELDS.includes(field);
}
