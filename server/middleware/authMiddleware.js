const ExpressError = require("../utils/ExpressError");

/**
 * Validate required user payload for room actions
 */
const validateUserPayload = (req, res, next) => {
  const userId = req.body.userId || req.headers["x-user-id"];
  const username = req.body.username || req.headers["x-username"];

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return next(new ExpressError(400, "userId is required", "MISSING_USER_ID"));
  }

  if (!username || typeof username !== "string" || !username.trim()) {
    return next(new ExpressError(400, "username is required", "MISSING_USERNAME"));
  }

  req.user = {
    userId: userId.trim(),
    username: username.trim(),
  };

  next();
};

module.exports = {
  validateUserPayload,
};
