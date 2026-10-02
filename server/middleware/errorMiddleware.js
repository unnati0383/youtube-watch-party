const ExpressError = require("../utils/ExpressError");

/**
 * 404 Not Found Middleware
 * Triggered when no route matches the incoming request path.
 */
const notFoundHandler = (req, res, next) => {
  next(new ExpressError(404, `Route ${req.originalUrl} not found`, "ROUTE_NOT_FOUND"));
};

/**
 * Central Error-Handling Middleware
 * Formats both operational errors and unexpected crashes into standard JSON responses.
 * Follows the centralized pattern from the reference project.
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message = "Internal Server Error", code = "INTERNAL_SERVER_ERROR" } = err;

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_KEY";
    message = "A resource with that identifier already exists";
  }

  // Handle CastError (invalid ObjectId or types)
  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid value for field: ${err.path}`;
  }

  // Log unexpected server errors in development
  if (statusCode >= 500) {
    console.error("Unhandled Error:", err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
