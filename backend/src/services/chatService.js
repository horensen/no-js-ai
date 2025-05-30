/**
 * Chat service for managing conversations and sessions
 */

const Chat = require('../models/Chat');
const logger = require('../utils/logger');
const { createSessionPreview } = require('../utils/session');
const { MAX_MESSAGE_LENGTH } = require('../utils/constants');

// Constants for this service
const DEFAULT_SESSION_CLEANUP_DAYS = 7;
const MAX_SESSIONS_PER_QUERY = 100;
const MAX_SYSTEM_PROMPT_LENGTH = 2000;

/**
 * Validate session ID format
 * @param {string} sessionId - Session identifier to validate
 * @throws {Error} If session ID is invalid
 */
function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Session ID is required and must be a string');
  }
  if (sessionId.length < 10 || sessionId.length > 50) {
    throw new Error('Session ID must be between 10 and 50 characters');
  }
  if (!/^[a-zA-Z0-9]+$/.test(sessionId)) {
    throw new Error('Session ID can only contain alphanumeric characters');
  }
}

/**
 * Validate message content
 * @param {string} content - Message content to validate
 * @param {string} role - Message role (user/assistant)
 * @throws {Error} If content is invalid
 */
function validateMessageContent(content, role) {
  if (!content || typeof content !== 'string') {
    throw new Error('Message content is required and must be a string');
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    throw new Error('Message content cannot be empty');
  }

  if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
  }

  if (!['user', 'assistant'].includes(role)) {
    throw new Error('Message role must be either "user" or "assistant"');
  }
}

/**
 * Generate a unique session ID with improved entropy
 * @returns {string} Generated session ID
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  const additional = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}-${additional}`;
}

/**
 * Get or create a chat session with enhanced error handling
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} - Chat session object
 */
async function getOrCreateChatSession(sessionId) {
  const startTime = Date.now();

  try {
    validateSessionId(sessionId);

    let chat = await Chat.findOne({ sessionId }).lean(false);

    if (!chat) {
      chat = new Chat({
        sessionId,
        messages: [],
        systemPrompt: '',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await chat.save();
      logger.debug(`Created new chat session: ${sessionId}`, 'CHAT_SERVICE');
    } else {
      logger.debug(`Retrieved existing chat session: ${sessionId}`, 'CHAT_SERVICE');
    }

    const duration = Date.now() - startTime;
    logger.debug(`getOrCreateChatSession completed in ${duration}ms`, 'CHAT_SERVICE');

    return chat;
  } catch (error) {
    logger.error('Error getting/creating chat session', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get conversation history for Ollama with optimized query
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Array>} - Array of messages
 */
async function getChatHistory(sessionId) {
  const startTime = Date.now();

  try {
    validateSessionId(sessionId);

    const chat = await Chat.findOne({ sessionId })
      .select('messages')
      .lean();

    const messages = chat ? chat.messages : [];

    const duration = Date.now() - startTime;
    logger.debug(`getChatHistory completed in ${duration}ms, returned ${messages.length} messages`, 'CHAT_SERVICE');

    return messages;
  } catch (error) {
    logger.error('Error getting chat history', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get system prompt for a chat session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<string>} - System prompt
 */
async function getSystemPrompt(sessionId) {
  try {
    validateSessionId(sessionId);

    const chat = await Chat.findOne({ sessionId })
      .select('systemPrompt')
      .lean();

    return chat ? (chat.systemPrompt || '') : '';
  } catch (error) {
    logger.error('Error getting system prompt', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Update system prompt for a chat session with validation
 * @param {string} sessionId - Session identifier
 * @param {string} systemPrompt - New system prompt
 * @returns {Promise<object>} - Updated chat session
 */
async function updateSystemPrompt(sessionId, systemPrompt) {
  try {
    validateSessionId(sessionId);

    // Validate and sanitize system prompt
    const trimmedPrompt = systemPrompt ? systemPrompt.trim() : '';

    if (trimmedPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
      throw new Error(`System prompt too long. Maximum ${MAX_SYSTEM_PROMPT_LENGTH} characters allowed.`);
    }

    const chat = await getOrCreateChatSession(sessionId);
    chat.systemPrompt = trimmedPrompt;
    chat.updatedAt = new Date();

    await chat.save();

    logger.debug(`Updated system prompt for session ${sessionId}`, 'CHAT_SERVICE');
    return chat;
  } catch (error) {
    logger.error('Error updating system prompt', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get all chat sessions with metadata and pagination support
 * @param {number} limit - Maximum number of sessions to return
 * @param {number} skip - Number of sessions to skip
 * @returns {Promise<Array>} - Array of session objects with metadata
 */
async function getAllChatSessions(limit = MAX_SESSIONS_PER_QUERY, skip = 0) {
  const startTime = Date.now();

  try {
    // Validate pagination parameters
    const validLimit = Math.min(Math.max(1, parseInt(limit) || MAX_SESSIONS_PER_QUERY), MAX_SESSIONS_PER_QUERY);
    const validSkip = Math.max(0, parseInt(skip) || 0);

    const sessions = await Chat.find({})
      .sort({ updatedAt: -1 })
      .limit(validLimit)
      .skip(validSkip)
      .select('sessionId messages systemPrompt createdAt updatedAt')
      .lean();

    const result = sessions.map(session => ({
      sessionId: session.sessionId,
      messageCount: session.messages?.length || 0,
      messages: session.messages || [], // Include messages for API formatting
      systemPrompt: session.systemPrompt || '',
      lastMessage: session.messages?.length > 0
        ? session.messages[session.messages.length - 1]
        : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      preview: createSessionPreview(session.messages || [])
    }));

    const duration = Date.now() - startTime;
    logger.debug(`getAllChatSessions completed in ${duration}ms, returned ${result.length} sessions`, 'CHAT_SERVICE');

    return result;
  } catch (error) {
    logger.error('Error getting all chat sessions', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Delete a chat session with validation
 * @param {string} sessionId - Session identifier
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
async function deleteChatSession(sessionId) {
  try {
    validateSessionId(sessionId);

    const result = await Chat.deleteOne({ sessionId });
    const deleted = result.deletedCount > 0;

    if (deleted) {
      logger.info(`Chat session deleted: ${sessionId}`, 'CHAT_SERVICE');
    } else {
      logger.warn(`Attempted to delete non-existent session: ${sessionId}`, 'CHAT_SERVICE');
    }

    return deleted;
  } catch (error) {
    logger.error('Error deleting chat session', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Add a message to a chat session with enhanced validation
 * @param {string} sessionId - Session identifier
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {string} content - Message content
 * @returns {Promise<object>} - Updated chat session
 */
async function addMessageToSession(sessionId, role, content) {
  const startTime = Date.now();

  try {
    validateSessionId(sessionId);
    validateMessageContent(content, role);

    const chat = await getOrCreateChatSession(sessionId);

    const message = {
      role,
      content: content.trim(),
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.updatedAt = new Date();

    await chat.save();

    const duration = Date.now() - startTime;
    logger.debug(`Added ${role} message to session ${sessionId} in ${duration}ms`, 'CHAT_SERVICE');

    return chat;
  } catch (error) {
    logger.error('Error adding message to session', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Clear all messages from a chat session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} - Updated chat session
 */
async function clearChatSession(sessionId) {
  try {
    validateSessionId(sessionId);

    const chat = await getOrCreateChatSession(sessionId);
    chat.messages = [];
    chat.updatedAt = new Date();

    await chat.save();

    logger.info(`Chat session cleared: ${sessionId}`, 'CHAT_SERVICE');
    return chat;
  } catch (error) {
    logger.error('Error clearing chat session', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get session statistics with enhanced metrics
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Session statistics or null if not found
 */
async function getSessionStats(sessionId) {
  try {
    validateSessionId(sessionId);

    const chat = await Chat.findOne({ sessionId }).lean();

    if (!chat) {
      return null;
    }

    const messages = chat.messages || [];
    const userMessages = messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = messages.filter(msg => msg.role === 'assistant').length;
    const totalCharacters = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    const avgMessageLength = messages.length > 0 ? Math.round(totalCharacters / messages.length) : 0;

    return {
      sessionId: chat.sessionId,
      totalMessages: messages.length,
      userMessages,
      assistantMessages,
      totalCharacters,
      avgMessageLength,
      systemPrompt: chat.systemPrompt || '',
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    };
  } catch (error) {
    logger.error('Error getting session stats', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Clean up old sessions with improved logging and error handling
 * @param {number} daysOld - Sessions older than this will be deleted
 * @returns {Promise<number>} - Number of sessions deleted
 */
async function cleanupOldSessions(daysOld = DEFAULT_SESSION_CLEANUP_DAYS) {
  const startTime = Date.now();

  try {
    // Validate input
    const validDaysOld = Math.max(1, parseInt(daysOld) || DEFAULT_SESSION_CLEANUP_DAYS);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - validDaysOld);

    // Count sessions before deletion for better logging
    const sessionsToDelete = await Chat.countDocuments({
      updatedAt: { $lt: cutoffDate }
    });

    if (sessionsToDelete === 0) {
      logger.info('No old sessions found for cleanup', 'CHAT_SERVICE');
      return 0;
    }

    const result = await Chat.deleteMany({
      updatedAt: { $lt: cutoffDate }
    });

    const duration = Date.now() - startTime;
    logger.info(`Cleaned up ${result.deletedCount} sessions older than ${validDaysOld} days in ${duration}ms`, 'CHAT_SERVICE');

    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up old sessions', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get session count for monitoring
 * @returns {Promise<number>} - Total number of sessions
 */
async function getTotalSessionCount() {
  try {
    const count = await Chat.countDocuments({});
    logger.debug(`Total session count: ${count}`, 'CHAT_SERVICE');
    return count;
  } catch (error) {
    logger.error('Error getting session count', 'CHAT_SERVICE', error);
    throw error;
  }
}

module.exports = {
  generateSessionId,
  getOrCreateChatSession,
  getChatHistory,
  getSystemPrompt,
  updateSystemPrompt,
  getAllChatSessions,
  deleteChatSession,
  addMessageToSession,
  clearChatSession,
  getSessionStats,
  cleanupOldSessions,
  getTotalSessionCount,

  // Export validation functions for testing
  validateSessionId,
  validateMessageContent
};