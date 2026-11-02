/**
 * Admin authorization middleware.
 *
 * Runs AFTER `requireAuth`, which has already attached the verified Better
 * Auth session user as `req.user` (401 for unauthenticated requests). This
 * middleware then decides ADMIN access purely from server-side configuration:
 *
 *   ADMIN_EMAILS="admin@example.com,owner@example.com"
 *
 * Matching is case-insensitive against `req.user.email` (POPULATED FROM THE
 * SESSION, never from a request body/query). There is no way to elevate
 * privileges through registration, profile updates, or any request payload
 * ?" the only inputs are the verified session email and the server env.
 *
 * Authenticated non-admins get HTTP 403. Admin secrets (the env list) are
 * never sent to the client.
 */

import { sendError } from "../utils/apiResponse.js";

/**
 * Parses ADMIN_EMAILS into a normalized lowercase email set.
 * Returns an empty set when the variable is unset/blank (no admins).
 */
export function getAdminEmails(source = process.env.ADMIN_EMAILS) {
  return new Set(
    (source || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Plain-JS check used by the middleware (and useful in tests).
 */
export function isAdminEmail(email, source = process.env.ADMIN_EMAILS) {
  if (typeof email !== "string" || !email.trim()) return false;
  return getAdminEmails(source).has(email.trim().toLowerCase());
}

export function requireAdmin(req, res, next) {
  // requireAuth always runs first on admin routes; a missing req.user here
  // is a routing bug, so fail closed with 401 rather than 403.
  if (!req.user) {
    return sendError(res, 401, "Unauthorized. Please sign in to continue.");
  }

  if (!isAdminEmail(req.user.email)) {
    return sendError(
      res,
      403,
      "Forbidden. You do not have permission to access this admin resource."
    );
  }

  return next();
}
