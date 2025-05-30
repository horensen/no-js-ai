// Input validation middleware
const inputValidationMiddleware = (req, res, next) => {
  if (req.body && req.body.message) {
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

module.exports = {
  inputValidationMiddleware
};