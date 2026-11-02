import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectToMongoDB } from "./config/db.js";
import studioRoutes from "./routes/studioRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import hostRoutes from "./routes/hostRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import {
  notFoundHandler,
  errorHandler,
} from "./middleware/errorMiddleware.js";

const app = express();
const port = process.env.PORT || 8000;

/**
 * CORS for the Next.js frontend (CLIENT_ORIGIN in .env).
 * Requests without an Origin header (Thunder Client, curl, Postman)
 * are always allowed, so API testing stays friction-free.
 *
 * Better Auth session cookies are sent cross-origin (localhost:3000 ->
 * localhost:8000), so credentialed CORS is enabled — but ONLY when explicit
 * origins are configured; reflecting an arbitrary origin together with
 * credentials would let any site use stolen/issued sessions.
 */
const clientOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: clientOrigins.length ? clientOrigins : true,
    credentials: clientOrigins.length > 0,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "StudioSpace server is running" });
});

// Studio API — GET routes are PUBLIC; POST/PUT/DELETE are AUTH-DEPENDENT
// (501 until Better Auth is integrated; owner-only once live)
app.use("/api/studios", studioRoutes);

// Category API — PUBLIC (list + category-wise studio filtering)
app.use("/api/categories", categoryRoutes);

// Booking API — AUTH-DEPENDENT (501 until Better Auth is integrated)
app.use("/api/bookings", bookingRoutes);

// Host listing API — AUTH-DEPENDENT (501 until Better Auth is integrated)
app.use("/api/hosts/listings", hostRoutes);

// User profile API — AUTH-DEPENDENT (501 until Better Auth is integrated)
app.use("/api/profile", profileRoutes);

// Admin API — AUTH + ADMIN: verified Better Auth session (401) AND the
// session email must be in the server-side ADMIN_EMAILS env list (403).
// Covers every studio, including legacy/demo documents.
app.use("/api/admin", adminRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(port, () => {
      console.log(`StudioSpace server running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
  }
}

startServer();
