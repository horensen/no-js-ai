const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../utils/constants');

// Rate limiting configuration - More restrictive for chat
const chatRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMITS.CHAT.windowMs,
  max: RATE_LIMITS.CHAT.max,
  message: {
    error: RATE_LIMITS.CHAT.message,
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      error: 'Rate limit exceeded. Please wait a moment before sending another message.'
    });
  }
});

module.exports = {
  chatRateLimitMiddleware
};