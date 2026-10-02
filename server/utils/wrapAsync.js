/**
 * Utility wrapper for asynchronous route handlers/middleware.
 * Eliminates repetitive try-catch blocks and forwards any rejected promise to next(err).
 * Mirrors the wrapAsync utility from the reference project.
 */
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
