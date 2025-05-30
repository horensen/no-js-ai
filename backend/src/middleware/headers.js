// Common security headers for all responses
const commonSecurityHeaders = (req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'none'; object-src 'none';");

  // Custom headers
  res.setHeader('X-Powered-By', 'No-JS AI Chat');
  res.setHeader('Server', 'Secure-Chat/1.0');

  next();
};

module.exports = {
  commonSecurityHeaders
};