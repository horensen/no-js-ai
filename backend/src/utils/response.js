/**
 * Response utility functions for consistent API responses and error handling
 */

const { HTTP_STATUS, ERROR_MESSAGES, PATHS } = require('./constants');
const { processMessages } = require('./markdown');
const logger = require('./logger');

/**
 * Send a successful JSON response
 * @param {object} res - Express response object
 * @param {any} data - Data to send
 * @param {number} status - HTTP status code
 */
function sendSuccess(res, data, status = HTTP_STATUS.OK) {
  res.status(status).json({
    success: true,
    data: data
  });
}

/**
 * Send an error JSON response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {object} details - Additional error details
 */
function sendError(res, message, status = HTTP_STATUS.BAD_REQUEST, details = null) {
  const response = {
    success: false,
    error: message
  };

  if (details) {
    response.details = details;
  }

  res.status(status).json(response);
}

/**
 * Send a chat error by rendering the chat page with error
 * @param {object} res - Express response object
 * @param {string} sessionId - Session ID
 * @param {Array} messages - Current messages
 * @param {string} errorMessage - Error message to display
 * @param {Array} sessions - Available sessions for sidebar
 * @param {boolean} isLoading - Loading state
 * @param {string} theme - Theme preference
 */
function sendChatError(res, sessionId, messages, errorMessage, sessions = [], isLoading = false, theme = 'light') {
  // Process messages for markdown rendering
  const processedMessages = processMessages(messages || []);

  res.render('chat', {
    sessionId,
    messages: processedMessages,
    error: errorMessage,
    isLoading,
    pendingMessage: null,
    sessions: sessions,
    currentSessionId: sessionId,
    theme
  });
}

/**
 * Send an error page
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 */
function sendErrorPage(res, message, status = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
  const theme = res.req.cookies?.theme || 'light';
  res.status(status).render('error', {
    error: message,
    theme
  });
}

/**
 * Async handler wrapper for routes
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Set up Server-Sent Events headers
 * @param {object} res - Express response object
 */
function setupSSE(res) {
  res.writeHead(HTTP_STATUS.OK, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
}

/**
 * Send a Server-Sent Event
 * @param {object} res - Express response object
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
function sendSSEEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Log error with context and send appropriate response
 * @param {Error} error - Error object
 * @param {object} res - Express response object
 * @param {string} context - Error context
 * @param {string} userMessage - User-friendly error message
 * @param {number} status - HTTP status code
 */
function logErrorAndRespond(error, res, context = 'UNKNOWN', userMessage = ERROR_MESSAGES.DATABASE_ERROR, status = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
  logger.error(`${context} Error: ${error.message}`, context, error);

  if (res.headersSent) {
    return; // Response already sent
  }

  // Check if this is an API request or page request
  const isApiRequest = res.req.path.startsWith('/api/') ||
                      res.req.get('Content-Type')?.includes('application/json') ||
                      res.req.get('Accept')?.includes('application/json');

  if (isApiRequest) {
    sendError(res, userMessage, status);
  } else {
    sendErrorPage(res, userMessage, status);
  }
}

/**
 * Create template data for chat rendering
 * @param {string} sessionId - Session ID
 * @param {Array} messages - Chat messages
 * @param {string} error - Error message if any
 * @param {boolean} isLoading - Loading state
 * @param {string} pendingMessage - Current pending message
 * @returns {object} - Template data object
 */
function createChatTemplateData(sessionId, messages = [], error = null, isLoading = false, pendingMessage = null) {
  return {
    sessionId,
    messages: messages || [],
    error,
    isLoading,
    pendingMessage
  };
}

/**
 * Send validation error response
 * @param {object} res - Express response object
 * @param {string} field - Field that failed validation
 * @param {string} message - Validation error message
 * @param {boolean} isApiRequest - Whether this is an API request
 */
function sendValidationError(res, field, message, isApiRequest = false) {
  const errorDetails = { field, message };

  if (isApiRequest) {
    sendError(res, `Validation failed: ${message}`, HTTP_STATUS.BAD_REQUEST, errorDetails);
  } else {
    sendErrorPage(res, message, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * Check if response headers have been sent
 * @param {object} res - Express response object
 * @returns {boolean} - True if headers sent
 */
function isResponseSent(res) {
  return res.headersSent;
}

/**
 * Send rate limit exceeded response
 * @param {object} res - Express response object
 * @param {string} customMessage - Custom rate limit message
 */
function sendRateLimitError(res, customMessage = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED) {
  const isApiRequest = res.req.path.startsWith('/api/');

  if (isApiRequest) {
    sendError(res, customMessage, HTTP_STATUS.TOO_MANY_REQUESTS);
  } else {
    sendErrorPage(res, customMessage, HTTP_STATUS.TOO_MANY_REQUESTS);
  }
}

module.exports = {
  sendSuccess,
  sendError,
  sendChatError,
  sendErrorPage,
  asyncHandler,
  setupSSE,
  sendSSEEvent,
  logErrorAndRespond,
  createChatTemplateData,
  sendValidationError,
  isResponseSent,
  sendRateLimitError
};