/**
 * Chat service for managing conversations and sessions
 */

const Chat = require('../models/Chat');
const logger = require('../utils/logger');
const { createSessionPreview } = require('../utils/session');

// Helper function to generate session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Get or create a chat session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} - Chat session object
 */
async function getOrCreateChatSession(sessionId) {
  try {
    let chat = await Chat.findOne({ sessionId });

    if (!chat) {
      chat = new Chat({ sessionId, messages: [] });
      await chat.save();
      logger.debug(`Created new chat session: ${sessionId}`, 'CHAT_SERVICE');
    }

    return chat;
  } catch (error) {
    logger.error('Error getting/creating chat session', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get conversation history for Ollama
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Array>} - Array of messages
 */
async function getChatHistory(sessionId) {
  try {
    const chat = await Chat.findOne({ sessionId });
    return chat ? chat.messages : [];
  } catch (error) {
    logger.error('Error getting chat history', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Get all chat sessions with metadata
 * @returns {Promise<Array>} - Array of session objects with metadata
 */
async function getAllChatSessions() {
  try {
    const sessions = await Chat.find({})
      .sort({ updatedAt: -1 })
      .select('sessionId messages createdAt updatedAt');

    return sessions.map(session => ({
      sessionId: session.sessionId,
      messageCount: session.messages.length,
      messages: session.messages, // Include messages for API formatting
      lastMessage: session.messages.length > 0
        ? session.messages[session.messages.length - 1]
        : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      preview: createSessionPreview(session.messages)
    }));
  } catch (error) {
    logger.error('Error getting all chat sessions', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Delete a chat session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
async function deleteChatSession(sessionId) {
  try {
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
 * Add a message to a chat session
 * @param {string} sessionId - Session identifier
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {string} content - Message content
 * @returns {Promise<object>} - Updated chat session
 */
async function addMessageToSession(sessionId, role, content) {
  try {
    const chat = await getOrCreateChatSession(sessionId);

    const message = {
      role,
      content: content.trim(),
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.updatedAt = new Date();

    await chat.save();

    logger.debug(`Added ${role} message to session ${sessionId}`, 'CHAT_SERVICE');
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
 * Get session statistics
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} - Session statistics
 */
async function getSessionStats(sessionId) {
  try {
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return null;
    }

    const userMessages = chat.messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = chat.messages.filter(msg => msg.role === 'assistant').length;
    const totalCharacters = chat.messages.reduce((sum, msg) => sum + msg.content.length, 0);

    return {
      sessionId: chat.sessionId,
      totalMessages: chat.messages.length,
      userMessages,
      assistantMessages,
      totalCharacters,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    };
  } catch (error) {
    logger.error('Error getting session stats', 'CHAT_SERVICE', error);
    throw error;
  }
}

/**
 * Clean up old sessions (for maintenance)
 * @param {number} daysOld - Sessions older than this will be deleted
 * @returns {Promise<number>} - Number of sessions deleted
 */
async function cleanupOldSessions(daysOld = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Chat.deleteMany({
      updatedAt: { $lt: cutoffDate }
    });

    logger.info(`Cleaned up ${result.deletedCount} old sessions`, 'CHAT_SERVICE');
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up old sessions', 'CHAT_SERVICE', error);
    throw error;
  }
}

module.exports = {
  generateSessionId,
  getOrCreateChatSession,
  getChatHistory,
  getAllChatSessions,
  deleteChatSession,
  addMessageToSession,
  clearChatSession,
  getSessionStats,
  cleanupOldSessions
};