const {
  validateSessionIdWithResponse,
  validateMessageWithResponse,
  getChatRenderData,
  handleDatabaseError,
  validateSessionAndMessage
} = require('../../src/utils/routeHelpers');
const { isValidSessionId, validateMessage } = require('../../src/utils/validation');
const { sendChatError, sendErrorPage, sendError } = require('../../src/utils/response');
const chatService = require('../../src/services/chatService');
const { ERROR_MESSAGES } = require('../../src/utils/constants');

// Mock dependencies
jest.mock('../../src/utils/validation');
jest.mock('../../src/utils/response');
jest.mock('../../src/services/chatService');

describe('Route Helpers', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = global.testHelpers.mockResponse();
    jest.clearAllMocks();
  });

  describe('validateSessionIdWithResponse', () => {
    test('should return true for valid session ID', () => {
      isValidSessionId.mockReturnValue(true);

      const result = validateSessionIdWithResponse('valid-session', mockRes);

      expect(result).toBe(true);
      expect(sendErrorPage).not.toHaveBeenCalled();
    });

    test('should return false and send error for invalid session ID', () => {
      isValidSessionId.mockReturnValue(false);

      const result = validateSessionIdWithResponse('invalid-session', mockRes);

      expect(result).toBe(false);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, 'Invalid session format.');
    });

    test('should use custom error handler when provided', () => {
      isValidSessionId.mockReturnValue(false);
      const customErrorHandler = jest.fn();

      const result = validateSessionIdWithResponse('invalid-session', mockRes, customErrorHandler);

      expect(result).toBe(false);
      expect(customErrorHandler).toHaveBeenCalledWith(mockRes, 'Invalid session format.');
      expect(sendErrorPage).not.toHaveBeenCalled();
    });
  });

  describe('validateMessageWithResponse', () => {
    test('should return validation result for valid message', async () => {
      const validationResult = { valid: true, message: 'Clean message' };
      validateMessage.mockReturnValue(validationResult);

      const result = await validateMessageWithResponse('test message', 'session-123', mockRes);

      expect(result).toEqual(validationResult);
      expect(sendChatError).not.toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    test('should return null and send chat error for invalid message (non-streaming)', async () => {
      const validationResult = { valid: false, error: 'Invalid message' };
      validateMessage.mockReturnValue(validationResult);

      const mockChat = { messages: [{ role: 'user', content: 'previous' }] };
      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);

      const result = await validateMessageWithResponse('bad message', 'session-123', mockRes, false);

      expect(result).toBeNull();
      expect(sendChatError).toHaveBeenCalledWith(mockRes, 'session-123', mockChat.messages, 'Invalid message');
      expect(sendError).not.toHaveBeenCalled();
    });

    test('should return null and send error for invalid message (streaming)', async () => {
      const validationResult = { valid: false, error: 'Invalid message' };
      validateMessage.mockReturnValue(validationResult);

      const result = await validateMessageWithResponse('bad message', 'session-123', mockRes, true);

      expect(result).toBeNull();
      expect(sendError).toHaveBeenCalledWith(mockRes, 'Invalid message', 400);
      expect(sendChatError).not.toHaveBeenCalled();
    });

    test('should handle database error during validation', async () => {
      const validationResult = { valid: false, error: 'Invalid message' };
      validateMessage.mockReturnValue(validationResult);

      const dbError = new Error('Database connection failed');
      chatService.getOrCreateChatSession.mockRejectedValue(dbError);
      console.error = jest.fn(); // Mock console.error

      const result = await validateMessageWithResponse('bad message', 'session-123', mockRes, false);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Database error:', dbError);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.DATABASE_ERROR);
    });
  });

  describe('getChatRenderData', () => {
    test('should return template data with defaults', () => {
      const sessionId = 'test-session';
      const messages = [{ role: 'user', content: 'Hello' }];

      const result = getChatRenderData(sessionId, messages);

      expect(result).toEqual({
        sessionId: 'test-session',
        messages: messages,
        error: null,
        isLoading: false,
        pendingMessage: null,
        theme: null
      });
    });

    test('should return template data with custom values', () => {
      const sessionId = 'test-session';
      const messages = [{ role: 'user', content: 'Hello' }];
      const error = 'Test error';
      const isLoading = true;
      const pendingMessage = 'Pending';

      const result = getChatRenderData(sessionId, messages, error, isLoading, pendingMessage);

      expect(result).toEqual({
        sessionId: 'test-session',
        messages: messages,
        error: 'Test error',
        isLoading: true,
        pendingMessage: 'Pending',
        theme: null
      });
    });
  });

  describe('handleDatabaseError', () => {
    test('should log error and send error page with default message', () => {
      const error = new Error('Database connection failed');
      console.error = jest.fn(); // Mock console.error

      handleDatabaseError(error, mockRes);

      expect(console.error).toHaveBeenCalledWith('Database error:', error);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.DATABASE_ERROR);
    });

    test('should log error and send error page with custom message', () => {
      const error = new Error('Database connection failed');
      const customMessage = 'Custom database error message';
      console.error = jest.fn(); // Mock console.error

      handleDatabaseError(error, mockRes, customMessage);

      expect(console.error).toHaveBeenCalledWith('Database error:', error);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, customMessage);
    });
  });

  describe('validateSessionAndMessage', () => {
    test('should return validation object for valid inputs', async () => {
      isValidSessionId.mockReturnValue(true);
      const validationResult = { valid: true, message: 'Clean message' };
      validateMessage.mockReturnValue(validationResult);

      const result = await validateSessionAndMessage('valid-session', 'valid message', mockRes);

      expect(result).toEqual({
        sessionId: 'valid-session',
        validation: validationResult
      });
    });

    test('should return null for invalid session ID', async () => {
      isValidSessionId.mockReturnValue(false);

      const result = await validateSessionAndMessage('invalid-session', 'valid message', mockRes);

      expect(result).toBeNull();
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, 'Invalid session format.');
    });

    test('should return null for invalid message (non-streaming)', async () => {
      isValidSessionId.mockReturnValue(true);
      const validationResult = { valid: false, error: 'Invalid message' };
      validateMessage.mockReturnValue(validationResult);

      const mockChat = { messages: [] };
      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);

      const result = await validateSessionAndMessage('valid-session', 'invalid message', mockRes, false);

      expect(result).toBeNull();
      expect(sendChatError).toHaveBeenCalled();
    });

    test('should return null for invalid message (streaming)', async () => {
      isValidSessionId.mockReturnValue(true);
      const validationResult = { valid: false, error: 'Invalid message' };
      validateMessage.mockReturnValue(validationResult);

      const result = await validateSessionAndMessage('valid-session', 'invalid message', mockRes, true);

      expect(result).toBeNull();
      expect(sendError).toHaveBeenCalledWith(mockRes, 'Invalid message', 400);
    });
  });
});