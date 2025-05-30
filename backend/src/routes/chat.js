const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const ollamaService = require('../services/ollamaService');

// Import utility functions
const { validateMessage, isValidSessionId } = require('../utils/validation');
const { sendChatError, sendErrorPage, asyncHandler } = require('../utils/response');
const { generateSessionId, formatSessionForAPI } = require('../utils/session');
const {
  validateSessionIdWithResponse,
  getChatRenderData,
  handleDatabaseError
} = require('../utils/routeHelpers');
const logger = require('../utils/logger');

// Home route with session handling
router.get('/', asyncHandler(async (req, res) => {
  let sessionId = req.query.session;
  const theme = req.cookies.theme || 'light';

  // Load all sessions for sidebar first
  const allSessions = await chatService.getAllChatSessions();
  const formattedSessions = allSessions.map(formatSessionForAPI);

  // If no session provided and sessions exist, redirect to most recent
  if (!sessionId && formattedSessions.length > 0) {
    const mostRecentSession = formattedSessions[0];
    return res.redirect(`/?session=${mostRecentSession.sessionId}`);
  }

  // If no session provided and no sessions exist, show empty state
  if (!sessionId && formattedSessions.length === 0) {
    const renderData = getChatRenderData(null, [], null, false, null, theme);
    renderData.sessions = [];
    renderData.currentSessionId = null;
    renderData.noSessions = true;
    renderData.systemPrompt = '';
    return res.render('chat', renderData);
  }

  // Generate new session if provided ID is invalid
  if (!isValidSessionId(sessionId)) {
    sessionId = generateSessionId();
    return res.redirect(`/?session=${sessionId}`);
  }

  try {
    // Load current chat session
    const chat = await chatService.getOrCreateChatSession(sessionId);

    logger.debug(`Rendering chat for session ${sessionId}, message count: ${chat.messages.length}`, 'CHAT_ROUTES');

    // Include sessions and system prompt in render data for server-side rendering
    const renderData = getChatRenderData(sessionId, chat.messages, null, false, null, theme);
    renderData.sessions = formattedSessions;
    renderData.currentSessionId = sessionId;
    renderData.systemPrompt = chat.systemPrompt || '';

    res.render('chat', renderData);
  } catch (error) {
    logger.error('Error loading chat session', 'CHAT_ROUTES', error);
    sendErrorPage(res, 'Failed to load chat session');
  }
}));

// Handle chat messages with immediate user message display
router.post('/chat', asyncHandler(async (req, res) => {
  const { message, sessionId } = req.body;
  const theme = req.cookies.theme || 'light';

  // Validate session ID - for POST /chat we want to send a chat error, not error page
  if (!isValidSessionId(sessionId)) {
    return sendChatError(res, sessionId, [], 'Invalid session format.', [], false, theme);
  }

  // Validate message
  const validation = validateMessage(message);
  if (!validation.valid) {
    try {
      const chat = await chatService.getOrCreateChatSession(sessionId);
      const allSessions = await chatService.getAllChatSessions();
      const formattedSessions = allSessions.map(formatSessionForAPI);
      return sendChatError(res, sessionId, chat.messages, validation.error, formattedSessions, false, theme);
    } catch (dbError) {
      handleDatabaseError(dbError, res);
      return;
    }
  }

  try {
    // Add user message immediately
    const chatWithUserMessage = await chatService.addMessageToSession(sessionId, 'user', validation.message);

    // Load sessions for sidebar
    const allSessions = await chatService.getAllChatSessions();
    const formattedSessions = allSessions.map(formatSessionForAPI);

    // Show loading page with user message immediately visible
    const renderData = getChatRenderData(sessionId, chatWithUserMessage.messages, null, true, validation.message, theme);
    renderData.sessions = formattedSessions;
    renderData.currentSessionId = sessionId;
    renderData.systemPrompt = chatWithUserMessage.systemPrompt || '';
    renderData.isProcessing = true; // Flag to indicate AI is processing
    renderData.scrollToAnchor = 'loading-anchor';
    renderData.messageCountBeforeAI = chatWithUserMessage.messages.length; // Track message count for polling

    res.render('chat', renderData);

    // Process AI response in background and automatically redirect when done
    setImmediate(async () => {
      try {
        // Get the updated chat with all messages for context
        const chatWithHistory = await chatService.getOrCreateChatSession(sessionId);

        // Pass the conversation history and system prompt to Ollama for context
        const aiResponse = await ollamaService.callOllama(
          chatWithHistory.messages,
          null,
          chatWithHistory.systemPrompt || ''
        );
        await chatService.addMessageToSession(sessionId, 'assistant', aiResponse);

        // Log completion for debugging
        logger.debug(`AI response completed for session ${sessionId}`, 'CHAT_ROUTES');
      } catch (error) {
        logger.error('Background AI processing error', 'CHAT_ROUTES', error);
        // Store error in session for display
        await chatService.addMessageToSession(sessionId, 'assistant', 'Sorry, I encountered an error processing your request. Please try again.');
      }
    });

  } catch (error) {
    logger.error('Error processing chat message', 'CHAT_ROUTES', error);

    try {
      const chat = await chatService.getOrCreateChatSession(sessionId);
      const allSessions = await chatService.getAllChatSessions();
      const formattedSessions = allSessions.map(formatSessionForAPI);
      sendChatError(res, sessionId, chat.messages, error.message || 'An error occurred while processing your message', formattedSessions, false, theme);
    } catch (dbError) {
      handleDatabaseError(dbError, res);
    }
  }
}));

// Check for response completion - enhanced with better response detection
router.get('/check-response/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const theme = req.cookies.theme || 'light';

  if (!validateSessionIdWithResponse(sessionId, res)) return;

  try {
    const chat = await chatService.getOrCreateChatSession(sessionId);
    const allSessions = await chatService.getAllChatSessions();
    const formattedSessions = allSessions.map(formatSessionForAPI);

    // Get the expected message count from query parameter (if available)
    const expectedCount = parseInt(req.query.count) || 0;
    const currentCount = chat.messages.length;

    // Check if we have a new AI response (last message is from assistant)
    const lastMessage = chat.messages[chat.messages.length - 1];
    const hasAIResponse = lastMessage && lastMessage.role === 'assistant';

    // Also check if message count has increased (indicating new response)
    const hasNewMessage = expectedCount > 0 ? currentCount > expectedCount : true;

    logger.debug(`Check response - Session: ${sessionId}, Expected: ${expectedCount}, Current: ${currentCount}, HasAI: ${hasAIResponse}, HasNew: ${hasNewMessage}`, 'CHAT_ROUTES');

    if (hasAIResponse && hasNewMessage) {
      // AI has responded - show the complete conversation with final redirect to clean URL
      const renderData = getChatRenderData(sessionId, chat.messages, null, false, null, theme);
      renderData.sessions = formattedSessions;
      renderData.currentSessionId = sessionId;
      renderData.systemPrompt = chat.systemPrompt || '';
      renderData.responseComplete = true;

      res.render('chat', renderData);
    } else {
      // AI is still processing - continue waiting with refresh
      const renderData = getChatRenderData(sessionId, chat.messages, null, true, null, theme);
      renderData.sessions = formattedSessions;
      renderData.currentSessionId = sessionId;
      renderData.systemPrompt = chat.systemPrompt || '';
      renderData.isProcessing = true;
      renderData.scrollToAnchor = 'loading-anchor';
      renderData.expectedMessageCount = expectedCount || currentCount; // Track for next check
      renderData.messageCountBeforeAI = expectedCount || (currentCount - 1); // Pass the count for next refresh

      res.render('chat', renderData);
    }
  } catch (error) {
    logger.error('Error checking response', 'CHAT_ROUTES', error);
    sendErrorPage(res, 'Error checking response status');
  }
}));

// Update system prompt
router.post('/system-prompt', asyncHandler(async (req, res) => {
  const { systemPrompt, sessionId } = req.body;

  // Validate session ID
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid session format.'
    });
  }

  try {
    // Update system prompt
    await chatService.updateSystemPrompt(sessionId, systemPrompt || '');

    // Redirect back to the chat session
    res.redirect(`/?session=${sessionId}`);
  } catch (error) {
    logger.error('Error updating system prompt', 'CHAT_ROUTES', error);

    // Try to render the chat page with error
    try {
      const chat = await chatService.getOrCreateChatSession(sessionId);
      const allSessions = await chatService.getAllChatSessions();
      const formattedSessions = allSessions.map(formatSessionForAPI);
      const theme = req.cookies.theme || 'light';

      const renderData = getChatRenderData(sessionId, chat.messages, error.message || 'Failed to update system prompt', false, null, theme);
      renderData.sessions = formattedSessions;
      renderData.currentSessionId = sessionId;
      renderData.systemPrompt = chat.systemPrompt || '';

      res.render('chat', renderData);
    } catch (renderError) {
      sendErrorPage(res, 'Failed to update system prompt');
    }
  }
}));

module.exports = router;