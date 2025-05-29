const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Mock all dependencies before importing the router
jest.mock('../../src/services/chatService');
jest.mock('../../src/services/ollamaService');
jest.mock('../../src/utils/validation');
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/session');
jest.mock('../../src/utils/routeHelpers');
jest.mock('../../src/utils/logger');

const chatService = require('../../src/services/chatService');
const ollamaService = require('../../src/services/ollamaService');
const validation = require('../../src/utils/validation');
const response = require('../../src/utils/response');
const session = require('../../src/utils/session');
const routeHelpers = require('../../src/utils/routeHelpers');
const logger = require('../../src/utils/logger');

describe('Chat Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Mock template engine
    app.set('view engine', 'ejs');
    app.set('views', 'views');

    // Mock render function
    app.use((req, res, next) => {
      res.render = jest.fn((template, data) => {
        res.status(200).json({ template, ...data });
      });
      next();
    });

    // Setup default mocks
    setupDefaultMocks();

    // Import and use the chat router after mocks are set up
    const chatRouter = require('../../src/routes/chat');
    app.use('/', chatRouter);
  });

  function setupDefaultMocks() {
    // Chat service mocks
    chatService.getAllChatSessions.mockResolvedValue([
      { sessionId: 'session1', messages: [], createdAt: new Date(), updatedAt: new Date() }
    ]);
    chatService.getOrCreateChatSession.mockResolvedValue({
      sessionId: 'test-session',
      messages: [{ role: 'user', content: 'Hello', timestamp: new Date() }]
    });
    chatService.addMessageToSession.mockResolvedValue({
      sessionId: 'test-session',
      messages: [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'user', content: 'New message', timestamp: new Date() }
      ]
    });

    // Ollama service mocks
    ollamaService.callOllama.mockResolvedValue('AI response');

    // Validation mocks
    validation.validateMessage.mockReturnValue({ valid: true, message: 'Hello' });
    validation.isValidSessionId.mockReturnValue(true);

    // Response utils mocks
    response.asyncHandler.mockImplementation((fn) => fn);
    response.sendChatError.mockImplementation((res, sessionId, messages, error, sessions, isLoading, theme) => {
      res.status(400).json({ error, sessionId, messages, sessions, isLoading, theme });
    });
    response.sendErrorPage.mockImplementation((res, message, status = 500) => {
      res.status(status).json({ error: message });
    });

    // Session utils mocks
    session.generateSessionId.mockReturnValue('new-session-id');
    session.formatSessionForAPI.mockImplementation((session) => ({
      sessionId: session.sessionId,
      messageCount: session.messages?.length || 0,
      lastMessage: session.messages?.[session.messages.length - 1] || null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }));

    // Route helpers mocks
    routeHelpers.validateSessionIdWithResponse.mockReturnValue(true);
    routeHelpers.getChatRenderData.mockImplementation((sessionId, messages, error, isLoading, pendingMessage, theme) => ({
      sessionId,
      messages: messages || [],
      error,
      isLoading,
      pendingMessage,
      theme: theme || 'light'
    }));
    routeHelpers.handleDatabaseError.mockImplementation((error, res) => {
      res.status(500).json({ error: 'Database error' });
    });

    // Logger mocks
    logger.debug.mockImplementation(() => {});
    logger.error.mockImplementation(() => {});
  }

  describe('GET /', () => {
    test('should redirect to most recent session when no session provided', async () => {
      chatService.getAllChatSessions.mockResolvedValue([
        { sessionId: 'recent-session', messages: [], createdAt: new Date(), updatedAt: new Date() }
      ]);

      const response = await request(app)
        .get('/')
        .expect(302);

      expect(response.headers.location).toBe('/?session=recent-session');
    });

    test('should show empty state when no sessions exist', async () => {
      chatService.getAllChatSessions.mockResolvedValue([]);

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.template).toBe('chat');
      expect(response.body.noSessions).toBe(true);
      expect(response.body.currentSessionId).toBeNull();
    });

    test('should redirect when invalid session ID provided', async () => {
      validation.isValidSessionId.mockReturnValue(false);
      session.generateSessionId.mockReturnValue('new-session');

      const response = await request(app)
        .get('/?session=invalid')
        .expect(302);

      expect(response.headers.location).toBe('/?session=new-session');
    });

    test('should render chat with valid session', async () => {
      const response = await request(app)
        .get('/?session=valid-session')
        .expect(200);

      expect(response.body.template).toBe('chat');
      expect(response.body.sessionId).toBe('valid-session');
      expect(chatService.getOrCreateChatSession).toHaveBeenCalledWith('valid-session');
    });

    test('should handle database errors', async () => {
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .get('/?session=test-session')
        .expect(500);

      expect(response.body.error).toBe('Failed to load chat session');
    });

    test('should handle theme from cookies', async () => {
      const response = await request(app)
        .get('/?session=test-session')
        .set('Cookie', 'theme=dark')
        .expect(200);

      expect(routeHelpers.getChatRenderData).toHaveBeenCalledWith(
        'test-session',
        expect.any(Array),
        null,
        false,
        null,
        'dark'
      );
    });
  });

  describe('POST /chat', () => {
    test('should process valid chat message', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'test-session' })
        .expect(200);

      expect(response.body.template).toBe('chat');
      expect(response.body.isProcessing).toBe(true);
      expect(chatService.addMessageToSession).toHaveBeenCalledWith('test-session', 'user', 'Hello');
    });

    test('should handle invalid session ID', async () => {
      validation.isValidSessionId.mockReturnValue(false);

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'invalid' })
        .expect(400);

      expect(response.body.error).toBe('Invalid session format.');
    });

    test('should handle invalid message', async () => {
      validation.validateMessage.mockReturnValue({ valid: false, error: 'Message too long' });

      const response = await request(app)
        .post('/chat')
        .send({ message: 'x'.repeat(1000), sessionId: 'test-session' })
        .expect(400);

      expect(response.body.error).toBe('Message too long');
    });

    test('should handle database error on message validation', async () => {
      validation.validateMessage.mockReturnValue({ valid: false, error: 'Invalid message' });
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'test-session' })
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });

    test('should handle error during message processing', async () => {
      chatService.addMessageToSession.mockRejectedValue(new Error('Processing error'));

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'test-session' })
        .expect(400);

      expect(response.body.error).toContain('Processing error');
    });

    test('should handle database error during error handling', async () => {
      chatService.addMessageToSession.mockRejectedValue(new Error('First error'));
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('Second error'));

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'test-session' })
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });

    test('should handle theme from cookies in POST', async () => {
      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'test-session' })
        .set('Cookie', 'theme=dark')
        .expect(200);

      expect(routeHelpers.getChatRenderData).toHaveBeenCalledWith(
        'test-session',
        expect.any(Array),
        null,
        true,
        'Hello',
        'dark'
      );
    });
  });

  describe('GET /check-response/:sessionId', () => {
    test('should return complete response when AI has responded', async () => {
      chatService.getOrCreateChatSession.mockResolvedValue({
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date() }
        ]
      });

      const response = await request(app)
        .get('/check-response/test-session?count=1')
        .expect(200);

      expect(response.body.template).toBe('chat');
      expect(response.body.responseComplete).toBe(true);
    });

    test('should return processing state when AI has not responded', async () => {
      chatService.getOrCreateChatSession.mockResolvedValue({
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() }
        ]
      });

      const response = await request(app)
        .get('/check-response/test-session?count=0')
        .expect(200);

      expect(response.body.template).toBe('chat');
      expect(response.body.isProcessing).toBe(true);
    });

    test('should handle invalid session ID', async () => {
      routeHelpers.validateSessionIdWithResponse.mockImplementation((sessionId, res) => {
        res.status(400).json({ error: 'Invalid session ID' });
        return false;
      });

      const response = await request(app)
        .get('/check-response/invalid-session')
        .expect(400);

      expect(response.body.error).toBe('Invalid session ID');
      expect(routeHelpers.validateSessionIdWithResponse).toHaveBeenCalledWith('invalid-session', expect.any(Object));
    });

    test('should handle database errors', async () => {
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .get('/check-response/test-session')
        .expect(500);

      expect(response.body.error).toBe('Error checking response status');
    });

    test('should handle theme from cookies in check-response', async () => {
      chatService.getOrCreateChatSession.mockResolvedValue({
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date() }
        ]
      });

      const response = await request(app)
        .get('/check-response/test-session')
        .set('Cookie', 'theme=dark')
        .expect(200);

      expect(routeHelpers.getChatRenderData).toHaveBeenCalledWith(
        'test-session',
        expect.any(Array),
        null,
        false,
        null,
        'dark'
      );
    });

    test('should handle expected count parameter', async () => {
      chatService.getOrCreateChatSession.mockResolvedValue({
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() }
        ]
      });

      const response = await request(app)
        .get('/check-response/test-session?count=5')
        .expect(200);

      expect(response.body.expectedMessageCount).toBe(5);
      expect(response.body.messageCountBeforeAI).toBe(5);
    });
  });

  describe('Route integration', () => {
    test('should handle all routes without errors', async () => {
      // Test that all routes are properly registered
      expect(app._router).toBeDefined();

      // Verify the routes respond
      await request(app).get('/').expect(302); // Redirect

      const postResponse = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'test-session' })
        .expect(200);

      expect(postResponse.body.template).toBe('chat');

      await request(app).get('/check-response/test-session').expect(200);
    });
  });
});