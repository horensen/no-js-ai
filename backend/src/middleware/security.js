// Re-export all security middleware from separate modules
const {
  chatRateLimitMiddleware
} = require('./rateLimiting');

const {
  inputValidationMiddleware
} = require('./validation');

const {
  commonSecurityHeaders
} = require('./headers');

module.exports = {
  chatRateLimitMiddleware,
  inputValidationMiddleware,
  commonSecurityHeaders
};