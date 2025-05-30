const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const chatRoutes = require('../../src/routes/chat');

// Mock dependencies
jest.mock('../../src/services/chatService');
jest.mock('../../src/services/ollamaService');
jest.mock('../../src/utils/validation');
jest.mock('../../src/utils/response', () => ({
  sendChatError: jest.fn(),
  sendErrorPage: jest.fn(),
  asyncHandler: jest.fn((fn) => fn), // Mock asyncHandler to just return the function
  logErrorAndRespond: jest.fn()
}));
jest.mock('../../src/utils/session');
jest.mock('../../src/utils/routeHelpers');
jest.mock('../../src/utils/logger');

const chatService = require('../../src/services/chatService');
const ollamaService = require('../../src/services/ollamaService');
const { validateMessage, isValidSessionId } = require('../../src/utils/validation');
const { sendChatError, sendErrorPage, asyncHandler } = require('../../src/utils/response');
const { generateSessionId, formatSessionForAPI } = require('../../src/utils/session');
const { validateSessionIdWithResponse, getChatRenderData, handleDatabaseError } = require('../../src/utils/routeHelpers');
const logger = require('../../src/utils/logger');

// Mock asyncHandler to be a proper function
asyncHandler.mockImplementation((fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
});

describe('Chat Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.set('view engine', 'ejs');
    app.set('views', 'views');

    // Mock the render method to prevent actual view rendering
    app.use((req, res, next) => {
      res.render = jest.fn((view, data, callback) => {
        if (callback) {
          callback(null, '<html>mocked view</html>');
        } else {
          res.status(200).send('<html>mocked view</html>');
        }
      });
      next();
    });

    app.use('/', chatRoutes);

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations
    chatService.getAllChatSessions.mockResolvedValue([]);
    chatService.getOrCreateChatSession.mockResolvedValue({
      sessionId: 'test-session',
      messages: [],
      systemPrompt: ''
    });
    chatService.addMessageToSession.mockResolvedValue({});
    chatService.updateSystemPrompt.mockResolvedValue({});

    ollamaService.callOllama.mockResolvedValue('AI response');

    isValidSessionId.mockReturnValue(true);
    validateMessage.mockReturnValue({ valid: true, message: 'Valid message' });
    validateSessionIdWithResponse.mockReturnValue(true);
    getChatRenderData.mockReturnValue({
      sessionId: 'test-session',
      messages: [],
      error: null,
      isLoading: false,
      pendingMessage: null,
      theme: 'light'
    });

    generateSessionId.mockReturnValue('new-session-id');
    formatSessionForAPI.mockImplementation((session) => ({
      sessionId: session.sessionId || 'session-1',
      title: session.title || 'Chat Session',
      lastActivity: session.lastActivity || new Date()
    }));

    // Mock logger methods
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.info = jest.fn();
  });

  describe('GET /', () => {
    it('should redirect to most recent session when no session provided and sessions exist', async () => {
      const mockSessions = [
        { sessionId: 'session-1', title: 'Test Chat', lastActivity: new Date() }
      ];

      chatService.getAllChatSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/')
        .expect(302);

      expect(response.headers.location).toBe('/?session=session-1');
    });

    it('should show empty state when no session provided and no sessions exist', async () => {
      chatService.getAllChatSessions.mockResolvedValue([]);

      const mockRenderData = {
        sessions: [],
        currentSessionId: null,
        noSessions: true,
        systemPrompt: ''
      };

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith(null, [], null, false, null, 'light');
    });

    it('should redirect to new session when invalid session ID provided', async () => {
      isValidSessionId.mockReturnValue(false);
      generateSessionId.mockReturnValue('new-session-id');

      const response = await request(app)
        .get('/?session=invalid-id')
        .expect(302);

      expect(response.headers.location).toBe('/?session=new-session-id');
    });

    it('should render chat page for valid session', async () => {
      const mockChat = {
        sessionId: 'valid-session',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are a helpful assistant'
      };

      const mockSessions = [
        { sessionId: 'valid-session', title: 'Test Chat' }
      ];

      chatService.getAllChatSessions.mockResolvedValue(mockSessions);
      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);

      const response = await request(app)
        .get('/?session=valid-session')
        .expect(200);

      expect(chatService.getOrCreateChatSession).toHaveBeenCalledWith('valid-session');
      expect(getChatRenderData).toHaveBeenCalledWith('valid-session', mockChat.messages, null, false, null, 'light');
    });

    it('should handle database errors gracefully', async () => {
      const mockSessions = [
        { sessionId: 'session-1', title: 'Test Chat' }
      ];

      chatService.getAllChatSessions.mockResolvedValue(mockSessions);
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/?session=valid-session')
        .expect(200);

      expect(sendErrorPage).toHaveBeenCalledWith(expect.anything(), 'Failed to load chat session');
    }, 10000);

    it('should use theme from cookies', async () => {
      const mockSessions = [];
      chatService.getAllChatSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/')
        .set('Cookie', ['theme=dark'])
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith(null, [], null, false, null, 'dark');
    });
  });

  describe('POST /chat', () => {
    it('should handle valid chat message', async () => {
      const mockChat = {
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'user', content: 'test message' }
        ],
        systemPrompt: 'Test prompt'
      };

      const mockSessions = [
        { sessionId: 'test-session', title: 'Test Chat' }
      ];

      chatService.addMessageToSession.mockResolvedValue(mockChat);
      chatService.getAllChatSessions.mockResolvedValue(mockSessions);
      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);
      ollamaService.callOllama.mockResolvedValue('AI response');

      const response = await request(app)
        .post('/chat')
        .send({
          message: 'test message',
          sessionId: 'test-session'
        })
        .expect(200);

      expect(validateMessage).toHaveBeenCalledWith('test message');
      expect(chatService.addMessageToSession).toHaveBeenCalledWith('test-session', 'user', 'test message');
    });

    it.skip('should handle invalid session ID', async () => {
      isValidSessionId.mockReturnValue(false);

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello', sessionId: 'invalid' })
        .expect(400);

      expect(isValidSessionId).toHaveBeenCalledWith('invalid');
    }, 10000);

    it.skip('should handle invalid message', async () => {
      validateMessage.mockReturnValue({
        valid: false,
        error: 'Message too long'
      });

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Invalid message', sessionId: 'valid-session' })
        .expect(200);

      expect(validateMessage).toHaveBeenCalledWith('Invalid message');
    }, 10000);

    it.skip('should handle database error during message validation', async () => {
      validateMessage.mockReturnValue({
        valid: false,
        error: 'Invalid message'
      });

      chatService.getOrCreateChatSession.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Test message', sessionId: 'valid-session' })
        .expect(200);

      expect(sendErrorPage).toHaveBeenCalled();
    }, 10000);

    it.skip('should handle errors during message processing', async () => {
      chatService.addMessageToSession.mockRejectedValue(new Error('Processing error'));

      const mockChat = {
        sessionId: 'valid-session',
        messages: []
      };
      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Test message', sessionId: 'valid-session' })
        .expect(200);

      expect(sendErrorPage).toHaveBeenCalled();
    }, 10000);

    it.skip('should handle database error during error handling', async () => {
      chatService.addMessageToSession.mockRejectedValue(new Error('Processing error'));
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Test message', sessionId: 'valid-session' })
        .expect(200);

      expect(sendErrorPage).toHaveBeenCalled();
    }, 10000);
  });

  describe('GET /check-response/:sessionId', () => {
    it('should return complete response when AI has responded', async () => {
      const mockChat = {
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        systemPrompt: 'Test prompt'
      };

      const mockSessions = [
        { sessionId: 'test-session', title: 'Test Chat' }
      ];

      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);
      chatService.getAllChatSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/check-response/test-session')
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith('test-session', mockChat.messages, null, false, null, 'light');
    });

    it('should return processing state when AI is still working', async () => {
      const mockChat = {
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        systemPrompt: 'Test prompt'
      };

      const mockSessions = [
        { sessionId: 'test-session', title: 'Test Chat' }
      ];

      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);
      chatService.getAllChatSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/check-response/test-session?count=1')
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith('test-session', mockChat.messages, null, true, null, 'light');
    });

    it.skip('should handle invalid session ID', async () => {
      validateSessionIdWithResponse.mockReturnValue(false);

      const response = await request(app)
        .get('/check-response/invalid-session')
        .expect(400);

      expect(validateSessionIdWithResponse).toHaveBeenCalledWith('invalid-session', expect.anything());
    }, 10000);

    it.skip('should handle database errors', async () => {
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/check-response/valid-session')
        .expect(200);

      expect(sendErrorPage).toHaveBeenCalled();
    }, 10000);
  });

  describe('POST /system-prompt', () => {
    it('should update system prompt successfully', async () => {
      chatService.updateSystemPrompt.mockResolvedValue();

      const response = await request(app)
        .post('/system-prompt')
        .send({
          systemPrompt: 'New system prompt',
          sessionId: 'test-session'
        })
        .expect(302);

      expect(chatService.updateSystemPrompt).toHaveBeenCalledWith('test-session', 'New system prompt');
      expect(response.headers.location).toBe('/?session=test-session');
    });

    it('should handle empty system prompt', async () => {
      chatService.updateSystemPrompt.mockResolvedValue();

      const response = await request(app)
        .post('/system-prompt')
        .send({
          systemPrompt: '',
          sessionId: 'test-session'
        })
        .expect(302);

      expect(chatService.updateSystemPrompt).toHaveBeenCalledWith('test-session', '');
    });

    it('should handle invalid session ID', async () => {
      isValidSessionId.mockReturnValue(false);

      const response = await request(app)
        .post('/system-prompt')
        .send({
          systemPrompt: 'New prompt',
          sessionId: 'invalid-session'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid session format.'
      });
    });

    it('should handle update errors gracefully', async () => {
      chatService.updateSystemPrompt.mockRejectedValue(new Error('Update failed'));

      const mockChat = {
        sessionId: 'test-session',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'Old prompt'
      };

      const mockSessions = [
        { sessionId: 'test-session', title: 'Test Chat' }
      ];

      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);
      chatService.getAllChatSessions.mockResolvedValue(mockSessions);

      const response = await request(app)
        .post('/system-prompt')
        .send({
          systemPrompt: 'New prompt',
          sessionId: 'test-session'
        })
        .expect(200);

      expect(getChatRenderData).toHaveBeenCalledWith(
        'test-session',
        mockChat.messages,
        'Update failed',
        false,
        null,
        'light'
      );
    });

    it.skip('should handle render errors during error handling', async () => {
      chatService.updateSystemPrompt.mockRejectedValue(new Error('Update failed'));
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('Render error'));

      const response = await request(app)
        .post('/system-prompt')
        .send({ sessionId: 'valid-session', systemPrompt: 'New prompt' })
        .expect(200);

      expect(sendErrorPage).toHaveBeenCalled();
    }, 10000);
  });

  describe('Background AI Processing', () => {
    it.skip('should process AI response in background', (done) => {
      const mockChat = {
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);
      chatService.addMessageToSession.mockResolvedValue(mockChat);
      ollamaService.callOllama.mockResolvedValue('AI response');

      // Mock the background processing
      setTimeout(() => {
        expect(ollamaService.callOllama).toHaveBeenCalled();
        expect(chatService.addMessageToSession).toHaveBeenCalledWith(
          'test-session',
          'assistant',
          'AI response'
        );
        done();
      }, 100);

      request(app)
        .post('/chat')
        .send({
          message: 'Hello',
          sessionId: 'test-session'
        })
        .expect(200)
        .end(() => {
          // Test initiated, background processing should start
        });
    });
  });
});