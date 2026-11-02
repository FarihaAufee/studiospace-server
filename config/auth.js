import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectToMongoDB } from "./db.js";

/**
 * Better Auth server instance for the Express backend.
 *
 * This instance does NOT run its own auth endpoints — it shares the frontend's
 * auth configuration so it can VERIFY the session cookies that the Next.js
 * app (BETTER_AUTH_URL, /api/auth) issues. The two instances MUST share:
 *   - the SAME MongoDB database (MONGODB_URL + MONGODB_DB_NAME), where the
 *     `user`, `session` and `account` collections live;
 *   - the SAME BETTER_AUTH_SECRET (session cookies are signed with it);
 *   - the SAME default session cookie name ("better-auth.session_token").
 *
 * Mirrors the frontend's src/lib/auth.ts session-relevant options (30-day
 * sessions, email/password enabled at the same minimum password length) so
 * the issuing and verifying instances never drift. NOTE: Express does NOT
 * mount Better Auth's route handler — this instance is only used server-side
 * for session verification, so no auth endpoints are exposed here.
 */

const REQUIRED_ENV = {
  secret: "BETTER_AUTH_SECRET",
  baseURL: "BETTER_AUTH_URL",
};

let authInstance = null;
let authPromise = null;

/**
 * Returns a cached Better Auth instance, lazily connected to the shared
 * MongoDB database. `requireAuth` awaits this so the public API keeps
 * working (and the server keeps booting) even when the database or auth
 * env vars are unavailable — auth-dependent routes then fail clean.
 */
export function getAuth() {
  if (authInstance) return Promise.resolve(authInstance);
  if (!authPromise) {
    authPromise = createAuth().catch((err) => {
      // Do not cache failures — the next request retries (e.g. DB came back).
      authPromise = null;
      throw err;
    });
  }
  return authPromise;
}

async function createAuth() {
  const db = await connectToMongoDB();

  if (!db) {
    throw Object.assign(new Error("Database not connected yet"), {
      statusCode: 503,
    });
  }

  for (const [option, envVar] of Object.entries(REQUIRED_ENV)) {
    if (!process.env[envVar]) {
      throw Object.assign(
        new Error(`${envVar} is missing from the .env file`),
        { statusCode: 503 }
      );
    }
  }

  // CLIENT_ORIGIN (frontend origin, cf. index.js CORS) is also trusted so
  // that any request-based checks this instance performs accept the same
  // origins the frontend auth server does (BETTER_AUTH_URL).
  const trustedOrigins = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(db),
    trustedOrigins,
    // Parity with the frontend's src/lib/auth.ts so behaviour (token
    // Strength/session lifetime/account checks) never drifts between the
    // issuing (frontend) and verifying (this) instances. These options do
    // NOT expose any auth endpoints here — Express never mounts the Better
    // Auth handler; only server-side session verification is used.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    session: {
      // 30-day sessions, refreshed once per day (same as the frontend).
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
  });
}
