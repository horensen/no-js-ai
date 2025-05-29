// Re-export all security middleware from separate modules
const {
  apiRateLimitMiddleware,
  chatRateLimitMiddleware,
  streamingRateLimitMiddleware
} = require('./rateLimiting');

const {
  inputValidationMiddleware,
  sessionValidationMiddleware,
  csrfProtectionMiddleware
} = require('./validation');

const {
  securityMiddleware,
  streamingSecurityMiddleware,
  commonSecurityHeaders
} = require('./headers');

module.exports = {
  securityMiddleware,
  apiRateLimitMiddleware,
  chatRateLimitMiddleware,
  streamingRateLimitMiddleware,
  inputValidationMiddleware,
  sessionValidationMiddleware,
  csrfProtectionMiddleware,
  streamingSecurityMiddleware,
  commonSecurityHeaders
};