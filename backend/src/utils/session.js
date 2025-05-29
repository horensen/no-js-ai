/**
 * Session utilities for session management and ID generation
 */

/**
 * Generate a random session ID
 * @param {number} length - Length of session ID (default: 15)
 * @returns {string} - Generated session ID
 */
function generateSessionId(length = 15) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create session preview from messages
 * @param {array} messages - Array of messages
 * @returns {string} - Preview text
 */
function createSessionPreview(messages) {
  if (!messages || messages.length === 0) {
    return 'New chat';
  }

  // Find the first user message
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  if (!firstUserMessage) {
    return 'New chat';
  }

  // Truncate and clean the message for preview
  const preview = firstUserMessage.content
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .substring(0, 50); // Limit to 50 characters

  return preview.length < firstUserMessage.content.trim().length
    ? preview + '...'
    : preview;
}

/**
 * Get last message from session
 * @param {array} messages - Array of messages
 * @returns {object|null} - Last message or null
 */
function getLastMessage(messages) {
  if (!messages || messages.length === 0) {
    return null;
  }
  return messages[messages.length - 1];
}

/**
 * Count messages by role
 * @param {array} messages - Array of messages
 * @returns {object} - Message counts by role
 */
function countMessagesByRole(messages) {
  if (!messages || messages.length === 0) {
    return { user: 0, assistant: 0, total: 0 };
  }

  const counts = messages.reduce((acc, msg) => {
    acc[msg.role] = (acc[msg.role] || 0) + 1;
    acc.total++;
    return acc;
  }, { user: 0, assistant: 0, total: 0 });

  return counts;
}

/**
 * Format session data for API response
 * @param {object} session - Session object from database
 * @returns {object} - Formatted session data
 */
function formatSessionForAPI(session) {
  const lastMessage = getLastMessage(session.messages);
  const messageCounts = countMessagesByRole(session.messages);

  return {
    sessionId: session.sessionId,
    messageCount: session.messages.length,
    messageCounts,
    preview: createSessionPreview(session.messages),
    lastMessage,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

/**
 * Validate session exists and user has access
 * @param {object} session - Session object
 * @param {string} userId - User ID (for future multi-user support)
 * @returns {boolean} - True if valid
 */
function validateSessionAccess(session, userId = null) {
  if (!session) {
    return false;
  }

  // For now, all sessions are accessible
  // In future, can add user-specific validation
  return true;
}

/**
 * Clean old sessions (for maintenance)
 * @param {Date} cutoffDate - Date before which sessions should be cleaned
 * @returns {object} - Cleanup criteria
 */
function getSessionCleanupCriteria(cutoffDate) {
  return {
    updatedAt: { $lt: cutoffDate },
    // Only clean sessions with no messages or very old sessions
    $or: [
      { 'messages.0': { $exists: false } }, // No messages
      { updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // 30 days old
    ]
  };
}

module.exports = {
  generateSessionId,
  createSessionPreview,
  getLastMessage,
  countMessagesByRole,
  formatSessionForAPI,
  validateSessionAccess,
  getSessionCleanupCriteria
};