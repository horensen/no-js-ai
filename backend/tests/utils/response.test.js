const {
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
} = require('../../src/utils/response');

// Mock dependencies
jest.mock('../../src/utils/constants', () => ({
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
    TOO_MANY_REQUESTS: 429
  },
  ERROR_MESSAGES: {
    DATABASE_ERROR: 'Database error occurred',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded'
  }
}));

jest.mock('../../src/utils/markdown', () => ({
  processMessages: jest.fn((messages) => messages)
}));

jest.mock('../../src/utils/logger');

const { processMessages } = require('../../src/utils/markdown');

describe('Response Utils', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      path: '/test',
      cookies: { theme: 'light' },
      get: jest.fn()
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      render: jest.fn(),
      writeHead: jest.fn(),
      write: jest.fn(),
      req: mockReq,
      headersSent: false
    };

    jest.clearAllMocks();
  });

  describe('sendSuccess', () => {
    test('should send success response with default status', () => {
      const data = { message: 'Success' };

      sendSuccess(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: data
      });
    });

    test('should send success response with custom status', () => {
      const data = { id: 1 };

      sendSuccess(mockRes, data, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: data
      });
    });

    test('should handle null data', () => {
      sendSuccess(mockRes, null);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: null
      });
    });
  });

  describe('sendError', () => {
    test('should send error response with default status', () => {
      const message = 'Something went wrong';

      sendError(mockRes, message);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message
      });
    });

    test('should send error response with custom status', () => {
      const message = 'Server error';

      sendError(mockRes, message, 500);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message
      });
    });

    test('should include details when provided', () => {
      const message = 'Validation error';
      const details = { field: 'email', value: 'invalid' };

      sendError(mockRes, message, 400, details);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        details: details
      });
    });
  });

  describe('sendChatError', () => {
    test('should render chat with error', () => {
      const sessionId = 'test-session';
      const messages = [{ role: 'user', content: 'Hello' }];
      const errorMessage = 'Chat error';
      const sessions = [{ sessionId: 'session1' }];

      processMessages.mockReturnValue(messages);

      sendChatError(mockRes, sessionId, messages, errorMessage, sessions);

      expect(processMessages).toHaveBeenCalledWith(messages);
      expect(mockRes.render).toHaveBeenCalledWith('chat', {
        sessionId,
        messages,
        error: errorMessage,
        isLoading: false,
        pendingMessage: null,
        sessions,
        currentSessionId: sessionId,
        theme: 'light'
      });
    });

    test('should handle null messages', () => {
      sendChatError(mockRes, 'session', null, 'Error');

      expect(processMessages).toHaveBeenCalledWith([]);
    });

    test('should use custom theme and loading state', () => {
      sendChatError(mockRes, 'session', [], 'Error', [], true, 'dark');

      expect(mockRes.render).toHaveBeenCalledWith('chat', expect.objectContaining({
        isLoading: true,
        theme: 'dark'
      }));
    });
  });

  describe('sendErrorPage', () => {
    test('should render error page with default status', () => {
      const message = 'Page error';

      sendErrorPage(mockRes, message);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: message,
        theme: 'light'
      });
    });

    test('should use theme from cookies', () => {
      mockReq.cookies = { theme: 'dark' };

      sendErrorPage(mockRes, 'Error');

      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Error',
        theme: 'dark'
      });
    });

    test('should handle missing cookies', () => {
      mockReq.cookies = undefined;

      sendErrorPage(mockRes, 'Error');

      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Error',
        theme: 'light'
      });
    });

    test('should use custom status', () => {
      sendErrorPage(mockRes, 'Not found', 404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('asyncHandler', () => {
    test('should handle successful async function', async () => {
      const mockNext = jest.fn();
      const asyncFn = jest.fn().mockResolvedValue('success');

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should catch and forward errors', async () => {
      const error = new Error('Async error');
      const mockNext = jest.fn();
      const asyncFn = jest.fn().mockRejectedValue(error);

      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('should handle sync functions that return promises', async () => {
      const mockNext = jest.fn();
      const syncFn = (req, res, next) => Promise.resolve('sync success');

      const wrappedFn = asyncHandler(syncFn);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('setupSSE', () => {
    test('should set up Server-Sent Events headers', () => {
      setupSSE(mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
    });
  });

  describe('sendSSEEvent', () => {
    test('should send Server-Sent Event', () => {
      const eventName = 'message';
      const data = { content: 'Hello' };

      sendSSEEvent(mockRes, eventName, data);

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${eventName}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
    });
  });

  describe('logErrorAndRespond', () => {
    test('should send JSON error for API requests', () => {
      mockReq.path = '/api/test';
      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes, 'TEST_CONTEXT');

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database error occurred'
      });
    });

    test('should detect API request by Content-Type', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'Content-Type') return 'application/json';
        return null;
      });

      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should detect API request by Accept header', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'Accept') return 'application/json';
        return null;
      });

      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should send error page for non-API requests', () => {
      mockReq.path = '/page';
      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Database error occurred',
        theme: 'light'
      });
    });

    test('should not respond if headers already sent', () => {
      mockRes.headersSent = true;
      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should use custom message and status', () => {
      mockReq.path = '/api/test';
      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes, 'CUSTOM', 'Custom error', 400);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Custom error'
      });
    });
  });

  describe('createChatTemplateData', () => {
    test('should create template data with all parameters', () => {
      const sessionId = 'test-session';
      const messages = [{ role: 'user', content: 'Hello' }];
      const error = 'Test error';
      const isLoading = true;
      const pendingMessage = 'Pending...';

      const result = createChatTemplateData(sessionId, messages, error, isLoading, pendingMessage);

      expect(result).toEqual({
        sessionId,
        messages,
        error,
        isLoading,
        pendingMessage
      });
    });

    test('should use default values', () => {
      const result = createChatTemplateData('session');

      expect(result).toEqual({
        sessionId: 'session',
        messages: [],
        error: null,
        isLoading: false,
        pendingMessage: null
      });
    });

    test('should handle null messages', () => {
      const result = createChatTemplateData('session', null);

      expect(result.messages).toEqual([]);
    });
  });

  describe('sendValidationError', () => {
    test('should send JSON validation error for API requests', () => {
      sendValidationError(mockRes, 'email', 'Invalid email', true);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed: Invalid email',
        details: { field: 'email', message: 'Invalid email' }
      });
    });

    test('should send error page for non-API requests', () => {
      sendValidationError(mockRes, 'password', 'Password too short', false);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Password too short',
        theme: 'light'
      });
    });

    test('should default to non-API request', () => {
      sendValidationError(mockRes, 'field', 'Error message');

      expect(mockRes.render).toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('isResponseSent', () => {
    test('should return false when headers not sent', () => {
      mockRes.headersSent = false;

      const result = isResponseSent(mockRes);

      expect(result).toBe(false);
    });

    test('should return true when headers sent', () => {
      mockRes.headersSent = true;

      const result = isResponseSent(mockRes);

      expect(result).toBe(true);
    });
  });

  describe('sendRateLimitError', () => {
    test('should send JSON error for API requests', () => {
      mockReq.path = '/api/test';

      sendRateLimitError(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded'
      });
    });

    test('should send error page for non-API requests', () => {
      mockReq.path = '/page';

      sendRateLimitError(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Rate limit exceeded',
        theme: 'light'
      });
    });

    test('should use custom message', () => {
      mockReq.path = '/api/test';
      const customMessage = 'Custom rate limit message';

      sendRateLimitError(mockRes, customMessage);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: customMessage
      });
    });
  });
});