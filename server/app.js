if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const roomRoutes = require("./routes/roomRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// Allowed origins for CORS (Render frontend, localhost Vite, etc.)
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev to avoid CORS friction
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for uptime monitoring & Render deployment checks
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "YouTube Watch Party Server",
    timestamp: new Date().toISOString(),
  });
});

// Mount Room API Routes
app.use("/api/rooms", roomRoutes);

// Catch-all for undefined routes
app.all("*", notFoundHandler);

// Centralized Error-handling middleware
app.use(errorHandler);

module.exports = app;
