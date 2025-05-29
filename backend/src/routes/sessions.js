const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');

// Import utility functions
const { sendSuccess, sendError, sendErrorPage, asyncHandler } = require('../utils/response');
const { generateSessionId, formatSessionForAPI } = require('../utils/session');
const {
  validateSessionIdWithResponse,
  getChatRenderData
} = require('../utils/routeHelpers');
const logger = require('../utils/logger');

// API endpoint for sessions (used by sidebar)
router.get('/api/sessions', asyncHandler(async (req, res) => {
  try {
    const sessions = await chatService.getAllChatSessions();
    const formattedSessions = sessions.map(formatSessionForAPI);
    sendSuccess(res, formattedSessions);
  } catch (error) {
    logger.error('Error fetching sessions', 'SESSION_ROUTES', error);
    sendError(res, 'Failed to fetch sessions', 500);
  }
}));

// Delete session endpoint
router.post('/sessions/:sessionId/delete', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const theme = req.cookies.theme || 'light';

  if (!validateSessionIdWithResponse(sessionId, res)) return;

  try {
    const deleted = await chatService.deleteChatSession(sessionId);
    if (deleted) {
      logger.info(`Session deleted: ${sessionId}`, 'SESSION_ROUTES');

      // Get remaining sessions after deletion
      const remainingSessions = await chatService.getAllChatSessions();

      if (remainingSessions.length > 0) {
        // Redirect to the most recent remaining session
        const mostRecentSession = remainingSessions[0]; // Sessions are typically sorted by most recent
        res.redirect(`/?session=${mostRecentSession.sessionId}`);
      } else {
        // No sessions left, render empty chat without creating new session
        const renderData = getChatRenderData(null, [], null, false, null, theme);
        renderData.sessions = [];
        renderData.currentSessionId = null;
        renderData.noSessions = true;
        res.render('chat', renderData);
      }
    } else {
      sendErrorPage(res, 'Session not found or could not be deleted.');
    }
  } catch (error) {
    logger.error('Error deleting session', 'SESSION_ROUTES', error);
    sendErrorPage(res, 'Failed to delete session');
  }
}));

// Create new session
router.get('/new', (req, res) => {
  const newSessionId = generateSessionId();
  res.redirect(`/?session=${newSessionId}`);
});

module.exports = router;