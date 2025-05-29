/**
 * Route helper utilities to reduce duplication in route handlers
 */

const { isValidSessionId, validateMessage } = require('./validation');
const { sendChatError, sendErrorPage, sendError } = require('./response');
const chatService = require('../services/chatService');
const { ERROR_MESSAGES } = require('./constants');
const { processMessages } = require('./markdown');
const logger = require('./logger');

/**
 * Validate session ID with consistent error handling
 * @param {string} sessionId - Session ID to validate
 * @param {Object} res - Express response object
 * @param {Function} errorHandler - Optional custom error handler
 * @returns {boolean} True if valid, false if invalid (and error response sent)
 */
function validateSessionIdWithResponse(sessionId, res, errorHandler = null) {
  if (!isValidSessionId(sessionId)) {
    if (errorHandler) {
      errorHandler(res, ERROR_MESSAGES.SESSION_INVALID);
    } else {
      sendErrorPage(res, ERROR_MESSAGES.SESSION_INVALID);
    }
    return false;
  }
  return true;
}

/**
 * Validate message with consistent error handling
 * @param {string} message - Message to validate
 * @param {string} sessionId - Session ID for error context
 * @param {Object} res - Express response object
 * @param {boolean} isStreaming - Whether this is for a streaming endpoint
 * @returns {Object|null} Validation result or null if invalid (and error response sent)
 */
async function validateMessageWithResponse(message, sessionId, res, isStreaming = false) {
  const validation = validateMessage(message);
  if (!validation.valid) {
    if (isStreaming) {
      // For streaming endpoints, send a direct error response
      sendError(res, validation.error, 400);
    } else {
      // For non-streaming endpoints, get chat context and send chat error
      try {
        const chat = await chatService.getOrCreateChatSession(sessionId);
        sendChatError(res, sessionId, chat.messages, validation.error);
      } catch (dbError) {
        console.error('Database error:', dbError);
        sendErrorPage(res, ERROR_MESSAGES.DATABASE_ERROR);
      }
    }
    return null;
  }
  return validation;
}

/**
 * Standard chat page render data
 * @param {string} sessionId - Session ID
 * @param {Array} messages - Chat messages
 * @param {string|null} error - Error message
 * @param {boolean} isLoading - Loading state
 * @param {string|null} pendingMessage - Current pending message
 * @param {string|null} theme - Theme preference from cookies
 * @returns {Object} Template data
 */
function getChatRenderData(sessionId, messages, error = null, isLoading = false, pendingMessage = null, theme = null) {
  // Process messages to convert markdown in AI responses and escape user messages
  console.log(`[DEBUG] getChatRenderData: Input messages:`, JSON.stringify(messages.slice(-1), null, 2));
  const processedMessages = processMessages(messages);
  console.log(`[DEBUG] getChatRenderData: Processed messages:`, JSON.stringify(processedMessages.slice(-1), null, 2));

  return {
    sessionId,
    messages: processedMessages,
    error,
    isLoading,
    pendingMessage,
    theme
  };
}

/**
 * Handle database errors consistently
 * @param {Error} error - Database error
 * @param {Object} res - Express response object
 * @param {string} fallbackMessage - Fallback error message
 */
function handleDatabaseError(error, res, fallbackMessage = ERROR_MESSAGES.DATABASE_ERROR) {
  console.error('Database error:', error);
  sendErrorPage(res, fallbackMessage);
}

/**
 * Wrapper for common session and message validation pattern
 * @param {string} sessionId - Session ID to validate
 * @param {string} message - Message to validate
 * @param {Object} res - Express response object
 * @param {boolean} isStreaming - Whether this is for a streaming endpoint
 * @returns {Object|null} Object with {sessionId, validation} or null if invalid
 */
async function validateSessionAndMessage(sessionId, message, res, isStreaming = false) {
  // Validate session ID
  if (!validateSessionIdWithResponse(sessionId, res)) {
    return null;
  }

  // Validate message
  const validation = await validateMessageWithResponse(message, sessionId, res, isStreaming);
  if (!validation) {
    return null;
  }

  return { sessionId, validation };
}

module.exports = {
  validateSessionIdWithResponse,
  validateMessageWithResponse,
  getChatRenderData,
  handleDatabaseError,
  validateSessionAndMessage
};