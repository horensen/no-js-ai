const {
  sendSuccess,
  sendError,
  sendChatError,
  sendErrorPage,
  asyncHandler,
  logErrorAndRespond,
  createChatTemplateData,
  isResponseSent
} = require('../../src/utils/response');

// Mock dependencies
jest.mock('../../src/utils/constants');
jest.mock('../../src/utils/markdown');
jest.mock('../../src/utils/logger');

const { HTTP_STATUS, ERROR_MESSAGES, PATHS } = require('../../src/utils/constants');
const { processMessages } = require('../../src/utils/markdown');
const logger = require('../../src/utils/logger');

describe('Response Utility', () => {
  let mockRes;
  let mockReq;

  beforeEach(() => {
    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      headersSent: false,
      req: {}
    };

    // Mock request object
    mockReq = {
      path: '/test',
      get: jest.fn(),
      cookies: { theme: 'light' }
    };

    mockRes.req = mockReq;

    // Reset mocks
    jest.clearAllMocks();

    // Mock constants
    HTTP_STATUS.OK = 200;
    HTTP_STATUS.BAD_REQUEST = 400;
    HTTP_STATUS.INTERNAL_SERVER_ERROR = 500;
    ERROR_MESSAGES.DATABASE_ERROR = 'Database error occurred';

    // Mock processMessages
    processMessages.mockImplementation((messages) => messages || []);
  });

  describe('sendSuccess', () => {
    it('should send successful response with default status', () => {
      const data = { message: 'Success' };

      sendSuccess(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: data
      });
    });

    it('should send successful response with custom status', () => {
      const data = { id: 123 };
      const status = 201;

      sendSuccess(mockRes, data, status);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: data
      });
    });

    it('should handle null data', () => {
      sendSuccess(mockRes, null);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: null
      });
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];

      sendSuccess(mockRes, data);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: data
      });
    });
  });

  describe('sendError', () => {
    it('should send error response with default status', () => {
      const message = 'Something went wrong';

      sendError(mockRes, message);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message
      });
    });

    it('should send error response with custom status', () => {
      const message = 'Not found';
      const status = 404;

      sendError(mockRes, message, status);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message
      });
    });

    it('should include details when provided', () => {
      const message = 'Validation failed';
      const details = { field: 'email', reason: 'invalid format' };

      sendError(mockRes, message, 400, details);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        details: details
      });
    });

    it('should not include details when null', () => {
      const message = 'Error';

      sendError(mockRes, message, 400, null);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message
      });
    });
  });

  describe('sendChatError', () => {
    it('should render chat page with error', () => {
      const sessionId = 'session123';
      const messages = [{ role: 'user', content: 'Hello' }];
      const errorMessage = 'Chat error occurred';
      const sessions = [{ id: 'session1' }];

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

    it('should handle null messages', () => {
      const sessionId = 'session123';
      const errorMessage = 'Error';

      sendChatError(mockRes, sessionId, null, errorMessage);

      expect(processMessages).toHaveBeenCalledWith([]);
      expect(mockRes.render).toHaveBeenCalledWith('chat', expect.objectContaining({
        messages: []
      }));
    });

    it('should use custom theme', () => {
      const sessionId = 'session123';
      const messages = [];
      const errorMessage = 'Error';
      const theme = 'dark';

      sendChatError(mockRes, sessionId, messages, errorMessage, [], false, theme);

      expect(mockRes.render).toHaveBeenCalledWith('chat', expect.objectContaining({
        theme: 'dark'
      }));
    });

    it('should handle loading state', () => {
      const sessionId = 'session123';
      const messages = [];
      const errorMessage = 'Error';
      const isLoading = true;

      sendChatError(mockRes, sessionId, messages, errorMessage, [], isLoading);

      expect(mockRes.render).toHaveBeenCalledWith('chat', expect.objectContaining({
        isLoading: true
      }));
    });
  });

  describe('sendErrorPage', () => {
    it('should render error page with default status', () => {
      const message = 'Page error';

      sendErrorPage(mockRes, message);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: message,
        theme: 'light'
      });
    });

    it('should render error page with custom status', () => {
      const message = 'Not found';
      const status = 404;

      sendErrorPage(mockRes, message, status);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: message,
        theme: 'light'
      });
    });

    it('should use theme from cookies', () => {
      mockReq.cookies = { theme: 'dark' };
      const message = 'Error';

      sendErrorPage(mockRes, message);

      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: message,
        theme: 'dark'
      });
    });

    it('should handle missing cookies', () => {
      mockReq.cookies = undefined;
      const message = 'Error';

      sendErrorPage(mockRes, message);

      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: message,
        theme: 'light'
      });
    });
  });

  describe('asyncHandler', () => {
    it('should wrap async function and handle success', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const next = jest.fn();
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, next);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward errors', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const next = jest.fn();
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, next);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should handle non-promise functions', async () => {
      const syncFn = jest.fn().mockReturnValue('sync result');
      const next = jest.fn();
      const wrappedFn = asyncHandler(syncFn);

      await wrappedFn(mockReq, mockRes, next);

      expect(syncFn).toHaveBeenCalledWith(mockReq, mockRes, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('logErrorAndRespond', () => {
    beforeEach(() => {
      mockReq.path = '/test';
      mockReq.get = jest.fn().mockReturnValue(null);
    });

    it('should log error and send JSON response for API requests', () => {
      mockReq.path = '/api/test';
      const error = new Error('Test error');
      const context = 'TEST_CONTEXT';
      const userMessage = 'User friendly error';

      logErrorAndRespond(error, mockRes, context, userMessage, 400);

      expect(logger.error).toHaveBeenCalledWith(
        'TEST_CONTEXT Error: Test error',
        context,
        error
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: userMessage
      });
    });

    it('should detect API request by Content-Type header', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'Content-Type') return 'application/json';
        return null;
      });

      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    it('should detect API request by Accept header', () => {
      mockReq.get.mockImplementation((header) => {
        if (header === 'Accept') return 'application/json';
        return null;
      });

      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    it('should render error page for non-API requests', () => {
      const error = new Error('Test error');
      const userMessage = 'Page error';

      logErrorAndRespond(error, mockRes, 'CONTEXT', userMessage, 404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: userMessage,
        theme: 'light'
      });
    });

    it('should not respond if headers already sent', () => {
      mockRes.headersSent = true;
      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    it('should use default values', () => {
      const error = new Error('Test error');

      logErrorAndRespond(error, mockRes);

      expect(logger.error).toHaveBeenCalledWith(
        'UNKNOWN Error: Test error',
        'UNKNOWN',
        error
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createChatTemplateData', () => {
    it('should create template data with all parameters', () => {
      const sessionId = 'session123';
      const messages = [{ role: 'user', content: 'Hello' }];
      const error = 'Error message';
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

    it('should use default values', () => {
      const sessionId = 'session123';

      const result = createChatTemplateData(sessionId);

      expect(result).toEqual({
        sessionId,
        messages: [],
        error: null,
        isLoading: false,
        pendingMessage: null
      });
    });

    it('should handle null messages', () => {
      const sessionId = 'session123';

      const result = createChatTemplateData(sessionId, null);

      expect(result).toEqual({
        sessionId,
        messages: [],
        error: null,
        isLoading: false,
        pendingMessage: null
      });
    });
  });

  describe('isResponseSent', () => {
    it('should return true when headers are sent', () => {
      mockRes.headersSent = true;

      expect(isResponseSent(mockRes)).toBe(true);
    });

    it('should return false when headers are not sent', () => {
      mockRes.headersSent = false;

      expect(isResponseSent(mockRes)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error flow', () => {
      const error = new Error('Integration test error');
      mockReq.path = '/api/integration';

      logErrorAndRespond(error, mockRes, 'INTEGRATION', 'Integration failed', 422);

      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Integration failed'
      });
    });

    it('should handle chat error with processed messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '**Bold** response' }
      ];
      processMessages.mockReturnValue(messages);

      sendChatError(mockRes, 'session123', messages, 'Chat failed');

      expect(processMessages).toHaveBeenCalledWith(messages);
      expect(mockRes.render).toHaveBeenCalledWith('chat', expect.objectContaining({
        messages: messages
      }));
    });
  });
});