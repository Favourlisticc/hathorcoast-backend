/**
 * Async handler wrapper to eliminate try-catch blocks in controllers
 * @param {Function} fn Function to be wrapped
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler; 