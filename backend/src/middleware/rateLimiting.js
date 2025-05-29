const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../utils/constants');

// General API rate limiting
const apiRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMITS.API.windowMs,
  max: RATE_LIMITS.API.max,
  message: {
    error: RATE_LIMITS.API.message
  },
  standardHeaders: true,
  legacyHeaders: false
});

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

// Streaming rate limiting - Even more restrictive
const streamingRateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMITS.STREAMING.windowMs,
  max: RATE_LIMITS.STREAMING.max,
  message: {
    error: RATE_LIMITS.STREAMING.message
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.writeHead(429, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: error\n`);
    res.write(`data: {"type": "error", "message": "Rate limit exceeded for streaming"}\n\n`);
    res.end();
  }
});

module.exports = {
  apiRateLimitMiddleware,
  chatRateLimitMiddleware,
  streamingRateLimitMiddleware
};