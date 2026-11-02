
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

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "StudioSpace server is running",
  });
});

// Ensure MongoDB is connected before API requests
app.use(async (req, res, next) => {
  try {
    const database = await connectToMongoDB();

    if (!database) {
      return res.status(503).json({
        success: false,
        message: "Database connection unavailable",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

// API routes
app.use("/api/studios", studioRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/hosts/listings", hostRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Local development only
if (!process.env.VERCEL) {
  async function startServer() {
    const database = await connectToMongoDB();

    if (!database) {
      console.error("Database connection failed.");
      process.exit(1);
    }

    app.listen(port, () => {
      console.log(`StudioSpace server running on port ${port}`);
    });
  }

  startServer();
}

// Vercel serverless entry point
export default app;
