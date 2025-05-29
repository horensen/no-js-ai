// Input validation middleware
const inputValidationMiddleware = (req, res, next) => {
  if (req.body.message) {
    // Sanitize message input
    const message = req.body.message.trim();

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /eval\(/i,
      /expression\(/i
    ];

    const hasSuspiciousContent = suspiciousPatterns.some(pattern =>
      pattern.test(message)
    );

    if (hasSuspiciousContent) {
      return res.status(400).render('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
    }

    // Update the sanitized message
    req.body.message = message;
  }

  next();
};

// Session validation middleware
const sessionValidationMiddleware = (req, res, next) => {
  const sessionId = req.body.sessionId || req.params.sessionId || req.query.session;

  if (sessionId) {
    // Validate session ID format (alphanumeric, specific length)
    const sessionIdPattern = /^[a-zA-Z0-9]{10,50}$/;

    if (!sessionIdPattern.test(sessionId)) {
      return res.status(400).render('error', {
        error: 'Invalid session format. Please start a new chat.'
      });
    }
  }

  next();
};

// CSRF-like protection using double submit pattern
const csrfProtectionMiddleware = (req, res, next) => {
  // For POST requests, check if they have proper form submission
  if (req.method === 'POST') {
    const referer = req.get('Referer');
    const host = req.get('Host');

    // Check if request comes from same origin
    if (!referer || !referer.includes(host)) {
      return res.status(403).render('error', {
        error: 'Request must originate from this application.'
      });
    }
  }

  next();
};

module.exports = {
  inputValidationMiddleware,
  sessionValidationMiddleware,
  csrfProtectionMiddleware
};