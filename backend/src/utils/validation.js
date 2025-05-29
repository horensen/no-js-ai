/**
 * Validation utilities for input sanitization and validation
 */

const {
  MAX_MESSAGE_LENGTH,
  SESSION_ID_PATTERN,
  SUSPICIOUS_PATTERNS,
  ERROR_MESSAGES
} = require('./constants');

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} - True if valid
 */
function isValidSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  return SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Validate message content
 * @param {string} message - Message to validate
 * @param {number} maxLength - Maximum length (default from constants)
 * @returns {object} - { valid: boolean, error?: string, message?: string }
 */
function validateMessage(message, maxLength = MAX_MESSAGE_LENGTH) {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: ERROR_MESSAGES.MESSAGE_REQUIRED };
  }

  const trimmedMessage = message.trim();

  if (trimmedMessage.length === 0) {
    return { valid: false, error: 'Please enter a message' };
  }

  if (trimmedMessage.length > maxLength) {
    return {
      valid: false,
      error: ERROR_MESSAGES.MESSAGE_TOO_LONG.replace('{maxLength}', maxLength)
    };
  }

  // Check for suspicious patterns (XSS prevention)
  const hasSuspiciousContent = SUSPICIOUS_PATTERNS.some(pattern =>
    pattern.test(trimmedMessage)
  );

  if (hasSuspiciousContent) {
    return { valid: false, error: ERROR_MESSAGES.MESSAGE_UNSAFE };
  }

  return { valid: true, message: trimmedMessage };
}

/**
 * Validate model name
 * @param {string} model - Model name to validate
 * @returns {boolean} - True if valid
 */
function isValidModel(model) {
  if (!model || typeof model !== 'string') {
    return false;
  }
  // Allow alphanumeric, dots, hyphens, underscores, colons
  return /^[a-zA-Z0-9._:-]+$/.test(model);
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeHtml(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and normalize URL parameters
 * @param {object} params - Parameters to validate
 * @returns {object} - Validated parameters
 */
function validateUrlParams(params) {
  const result = {};

  if (!params || typeof params !== 'object') {
    return result;
  }

  if (params.sessionId && isValidSessionId(params.sessionId)) {
    result.sessionId = params.sessionId;
  }

  if (params.model && isValidModel(params.model)) {
    result.model = params.model;
  }

  return result;
}

/**
 * Check if input contains suspicious patterns
 * @param {string} input - Input to check
 * @returns {boolean} - True if suspicious
 */
function hasSuspiciousContent(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }

  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(input));
}

module.exports = {
  isValidSessionId,
  validateMessage,
  isValidModel,
  sanitizeHtml,
  validateUrlParams,
  hasSuspiciousContent
};