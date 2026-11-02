/**
 * Authentication middleware — Better Auth integration.
 *
 * Verifies Better Auth session cookies issued by the Next.js frontend's
 * auth server (BETTER_AUTH_URL + same secret + same MongoDB database,
 * see config/auth.js) using Better Auth's official server-side API:
 *
 *   const session = await auth.api.getSession({ headers });
 *
 * The incoming request's `Cookie` header is serialized into a `Headers`
 * object (the Authorization header is forwarded too, safe when the `bearer`
 * plugin is not enabled — it is simply ignored). On success the Better Auth
 * session user document is attached as `req.user`.
 *
 * Contracts every dependent controller relies on:
 *   - req.user is always set when a route runs past `requireAuth`
 *   - req.user.id   — stable user id inherited from Better Auth
 *   - req.user.email— user email (used to match legacy studio.hostEmail)
 *   - req.user.name — display name
 *   User ids supplied in request bodies are never trusted; identity always
 *   comes from req.user, which controllers already stamp into new studios
 *   (hostId) and bookings (userId).
 *
 * Unauthenticated or invalid sessions get HTTP 401 via the shared
 * `sendError` response format; infrastructure failures (DB/auth config)
 * surface as 503 through the central error middleware.
 */

import { sendError } from "../utils/apiResponse.js";
import { getAuth } from "../config/auth.js";

/**
 * Converts the Express request's auth-relevant headers into the
 * `Headers` object that `auth.api.getSession` expects.
 */
function buildAuthHeaders(req) {
  const headers = new Headers();

  if (req.headers.cookie) {
    headers.set("cookie", req.headers.cookie);
  }

  // Forwarded only — ignored unless the auth config enables the bearer plugin.
  if (req.headers.authorization) {
    headers.set("authorization", req.headers.authorization);
  }

  return headers;
}

export async function requireAuth(req, res, next) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: buildAuthHeaders(req),
    });

    if (!session || !session.user) {
      return sendError(res, 401, "Unauthorized. Please sign in to continue.");
    }

    // The plain session user data from Better Auth — never anything from
    // the request body or query string. Only identity fields the rest of
    // the API relies on are exposed on req.user.
    const user = session.user;

    req.user = {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      emailVerified: user.emailVerified ?? false,
      image: user.image ?? null,
    };

    return next();
  } catch (error) {
    // Database/config problems bubble to the central error middleware
    // (503 when the DB is not connected), not a misleading 401.
    return next(error);
  }
}

/**
 * Single source of truth for the request-identity contract.
 * Reads whatever `requireAuth` attached — null when never authenticated.
 */
export function getCurrentUser(req) {
  return req.user || null;
}
