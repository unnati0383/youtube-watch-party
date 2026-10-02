/**
 * Custom Error class for Express application
 * Extends JavaScript Error to attach HTTP status code and optional machine-readable error code.
 * Follows the reference project's ExpressError pattern.
 */
class ExpressError extends Error {
  constructor(statusCode = 500, message = "Something went wrong", code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ExpressError;
