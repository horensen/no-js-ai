const helmet = require('helmet');

// Enhanced security middleware configuration
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for streaming
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "fonts.gstatic.com", "fonts.googleapis.com"],
      connectSrc: ["'self'"], // Allow EventSource connections
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

// Security headers for streaming
const streamingSecurityMiddleware = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

// Common security headers for all responses
const commonSecurityHeaders = (req, res, next) => {
  res.setHeader('X-Powered-By', 'No-JS AI Chat');
  res.setHeader('Server', 'Secure-Chat/1.0');
  next();
};

module.exports = {
  securityMiddleware,
  streamingSecurityMiddleware,
  commonSecurityHeaders
};