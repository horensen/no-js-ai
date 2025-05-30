const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const sessionsRoutes = require('../../src/routes/sessions');

// Mock dependencies
jest.mock('../../src/services/chatService');
jest.mock('../../src/utils/response', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
  sendErrorPage: jest.fn(),
  asyncHandler: jest.fn((fn) => fn), // Mock asyncHandler to just return the function
  logErrorAndRespond: jest.fn()
}));
jest.mock('../../src/utils/session');
jest.mock('../../src/utils/routeHelpers');
jest.mock('../../src/utils/logger');

const chatService = require('../../src/services/chatService');
const { sendSuccess, sendError, sendErrorPage, asyncHandler } = require('../../src/utils/response');
const { generateSessionId, formatSessionForAPI } = require('../../src/utils/session');
const { validateSessionIdWithResponse, getChatRenderData } = require('../../src/utils/routeHelpers');
const logger = require('../../src/utils/logger');

// Mock asyncHandler to be a proper function
asyncHandler.mockImplementation((fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
});

describe('Sessions Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));

    // Mock view engine
    app.set('view engine', 'ejs');
    app.set('views', 'views');

    // Mock render function
    app.use((req, res, next) => {
      res.render = jest.fn((view, data) => {
        res.json({ view, data });
      });
      next();
    });

    app.use('/', sessionsRoutes);

    // Reset mocks
    jest.clearAllMocks();

    // Mock response utilities
    sendSuccess.mockImplementation((res, data) => {
      res.json({ success: true, data });
    });
    sendError.mockImplementation((res, message, status = 500) => {
      res.status(status).json({ success: false, error: message });
    });
    sendErrorPage.mockImplementation((res, message) => {
      res.status(500).json({ error: message });
    });

    // Reset validateSessionIdWithResponse to default behavior
    validateSessionIdWithResponse.mockReturnValue(true);

    // Mock other utilities with default behavior
    getChatRenderData.mockReturnValue({
      sessions: [],
      currentSessionId: null,
      noSessions: true,
      theme: 'light'
    });
  });

  describe('GET /api/sessions', () => {
    it('should return formatted sessions successfully', async () => {
      const mockSessions = [
        { sessionId: 'session1', messages: [] },
        { sessionId: 'session2', messages: [] }
      ];
      const mockFormattedSessions = [
        { sessionId: 'session1', id: 'session1', title: 'Session 1' },
        { sessionId: 'session2', id: 'session2', title: 'Session 2' }
      ];

      chatService.getAllChatSessions.mockResolvedValue(mockSessions);
      formatSessionForAPI.mockImplementation((session, index) => mockFormattedSessions[index]);

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(chatService.getAllChatSessions).toHaveBeenCalled();
      expect(formatSessionForAPI).toHaveBeenCalledTimes(2);
      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), mockFormattedSessions);
    });

    it('should handle errors when fetching sessions', async () => {
      const error = new Error('Database error');
      chatService.getAllChatSessions.mockRejectedValue(error);

      const response = await request(app)
        .get('/api/sessions')
        .expect(500);

      expect(logger.error).toHaveBeenCalledWith('Error fetching sessions', 'SESSION_ROUTES', error);
      expect(sendError).toHaveBeenCalledWith(expect.any(Object), 'Failed to fetch sessions', 500);
    });

    it('should handle empty sessions list', async () => {
      chatService.getAllChatSessions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(sendSuccess).toHaveBeenCalledWith(expect.any(Object), []);
    });
  });

  describe('POST /sessions/:sessionId/delete', () => {
    it('should delete session and redirect to most recent remaining session', async () => {
      const sessionId = 'session-to-delete';
      const remainingSessions = [
        { sessionId: 'session1' },
        { sessionId: 'session2' }
      ];

      chatService.deleteChatSession.mockResolvedValue(true);
      chatService.getAllChatSessions.mockResolvedValue(remainingSessions);

      const response = await request(app)
        .post(`/sessions/${sessionId}/delete`)
        .expect(302);

      expect(chatService.deleteChatSession).toHaveBeenCalledWith(sessionId);
      expect(chatService.getAllChatSessions).toHaveBeenCalled();
      expect(response.headers.location).toBe('/?session=session1');
      expect(logger.info).toHaveBeenCalledWith(`Session deleted: ${sessionId}`, 'SESSION_ROUTES');
    });

    it('should render empty chat when no sessions remain', async () => {
      const sessionId = 'last-session';

      chatService.deleteChatSession.mockResolvedValue(true);
      chatService.getAllChatSessions.mockResolvedValue([]);

      const response = await request(app)
        .post(`/sessions/${sessionId}/delete`)
        .set('Cookie', ['theme=dark'])
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith(null, [], null, false, null, 'dark');
      expect(response.body.view).toBe('chat');
    });

    it('should handle session not found', async () => {
      const sessionId = 'nonexistent-session';

      chatService.deleteChatSession.mockResolvedValue(false);

      const response = await request(app)
        .post(`/sessions/${sessionId}/delete`)
        .expect(500);

      expect(sendErrorPage).toHaveBeenCalledWith(expect.any(Object), 'Session not found or could not be deleted.');
    });

    it('should handle invalid session ID', async () => {
      const sessionId = 'invalid-session';
      validateSessionIdWithResponse.mockImplementation((sessionId, res) => {
        res.status(400).json({ error: 'Invalid session ID' });
        return false;
      });

      const response = await request(app)
        .post(`/sessions/${sessionId}/delete`)
        .expect(400);

      expect(validateSessionIdWithResponse).toHaveBeenCalledWith(sessionId, expect.any(Object));
      expect(chatService.deleteChatSession).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const sessionId = 'session-with-error';
      const error = new Error('Deletion failed');

      chatService.deleteChatSession.mockRejectedValue(error);

      const response = await request(app)
        .post(`/sessions/${sessionId}/delete`)
        .expect(500);

      expect(logger.error).toHaveBeenCalledWith('Error deleting session', 'SESSION_ROUTES', error);
      expect(sendErrorPage).toHaveBeenCalledWith(expect.any(Object), 'Failed to delete session');
    });

    it('should use light theme by default', async () => {
      const sessionId = 'session-to-delete';

      chatService.deleteChatSession.mockResolvedValue(true);
      chatService.getAllChatSessions.mockResolvedValue([]);

      const response = await request(app)
        .post(`/sessions/${sessionId}/delete`)
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith(null, [], null, false, null, 'light');
    });
  });

  describe('GET /new', () => {
    it('should generate new session ID and redirect', async () => {
      const newSessionId = 'new-session-123';
      generateSessionId.mockReturnValue(newSessionId);

      const response = await request(app)
        .get('/new')
        .expect(302);

      expect(generateSessionId).toHaveBeenCalled();
      expect(response.headers.location).toBe(`/?session=${newSessionId}`);
    });

    it('should handle multiple new session requests', async () => {
      generateSessionId
        .mockReturnValueOnce('session-1')
        .mockReturnValueOnce('session-2');

      const response1 = await request(app)
        .get('/new')
        .expect(302);

      const response2 = await request(app)
        .get('/new')
        .expect(302);

      expect(response1.headers.location).toBe('/?session=session-1');
      expect(response2.headers.location).toBe('/?session=session-2');
      expect(generateSessionId).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed session deletion requests', async () => {
      validateSessionIdWithResponse.mockImplementation((sessionId, res) => {
        res.status(400).json({ error: 'Malformed session ID' });
        return false;
      });

      const response = await request(app)
        .post('/sessions/malformed-id/delete')
        .expect(400);

      expect(validateSessionIdWithResponse).toHaveBeenCalled();
    });

    it('should handle concurrent session operations', async () => {
      const sessionId = 'concurrent-session';
      chatService.deleteChatSession.mockResolvedValue(true);
      chatService.getAllChatSessions.mockResolvedValue([]);

      // Reset validateSessionIdWithResponse to return true for this test
      validateSessionIdWithResponse.mockReturnValue(true);

      const promises = [
        request(app).post(`/sessions/${sessionId}/delete`).expect(200),
        request(app).post(`/sessions/${sessionId}/delete`).expect(200)
      ];

      const responses = await Promise.all(promises);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
    });
  });
});