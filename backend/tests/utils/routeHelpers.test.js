const routeHelpers = require('../../src/utils/routeHelpers');
const { isValidSessionId, validateMessage } = require('../../src/utils/validation');
const { sendChatError, sendErrorPage, sendError } = require('../../src/utils/response');
const chatService = require('../../src/services/chatService');
const { ERROR_MESSAGES } = require('../../src/utils/constants');
const { processMessages } = require('../../src/utils/markdown');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/validation');
jest.mock('../../src/utils/response');
jest.mock('../../src/services/chatService');
jest.mock('../../src/utils/constants', () => ({
  ERROR_MESSAGES: {
    SESSION_INVALID: 'Invalid session ID',
    DATABASE_ERROR: 'Database error occurred'
  }
}));
jest.mock('../../src/utils/markdown');
jest.mock('../../src/utils/logger');

describe('RouteHelpers', () => {
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      render: jest.fn(),
      redirect: jest.fn()
    };

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mock implementations
    processMessages.mockImplementation((messages) => messages);
  });

  describe('validateSessionIdWithResponse', () => {
    it('should return true for valid session ID', () => {
      isValidSessionId.mockReturnValue(true);

      const result = routeHelpers.validateSessionIdWithResponse('validSession123', mockRes);

      expect(result).toBe(true);
      expect(isValidSessionId).toHaveBeenCalledWith('validSession123');
      expect(sendErrorPage).not.toHaveBeenCalled();
    });

    it('should return false and send error page for invalid session ID', () => {
      isValidSessionId.mockReturnValue(false);

      const result = routeHelpers.validateSessionIdWithResponse('invalid', mockRes);

      expect(result).toBe(false);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.SESSION_INVALID);
    });

    it('should use custom error handler when provided', () => {
      isValidSessionId.mockReturnValue(false);
      const customErrorHandler = jest.fn();

      const result = routeHelpers.validateSessionIdWithResponse('invalid', mockRes, customErrorHandler);

      expect(result).toBe(false);
      expect(customErrorHandler).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.SESSION_INVALID);
      expect(sendErrorPage).not.toHaveBeenCalled();
    });
  });

  describe('validateMessageWithResponse', () => {
    it('should return validation result for valid message', async () => {
      const mockValidation = {
        valid: true,
        message: 'Valid message'
      };

      validateMessage.mockReturnValue(mockValidation);

      const result = await routeHelpers.validateMessageWithResponse('Valid message', 'session123', mockRes);

      expect(result).toBe(mockValidation);
      expect(validateMessage).toHaveBeenCalledWith('Valid message');
      expect(sendError).not.toHaveBeenCalled();
      expect(sendChatError).not.toHaveBeenCalled();
    });

    it('should send direct error for invalid message in streaming mode', async () => {
      const mockValidation = {
        valid: false,
        error: 'Message too long'
      };

      validateMessage.mockReturnValue(mockValidation);

      const result = await routeHelpers.validateMessageWithResponse('Invalid message', 'session123', mockRes, true);

      expect(result).toBeNull();
      expect(sendError).toHaveBeenCalledWith(mockRes, 'Message too long', 400);
      expect(sendChatError).not.toHaveBeenCalled();
    });

    it('should send chat error for invalid message in non-streaming mode', async () => {
      const mockValidation = {
        valid: false,
        error: 'Message too long'
      };

      const mockChat = {
        messages: [{ role: 'user', content: 'Previous message' }]
      };

      validateMessage.mockReturnValue(mockValidation);
      chatService.getOrCreateChatSession.mockResolvedValue(mockChat);

      const result = await routeHelpers.validateMessageWithResponse('Invalid message', 'session123', mockRes, false);

      expect(result).toBeNull();
      expect(chatService.getOrCreateChatSession).toHaveBeenCalledWith('session123');
      expect(sendChatError).toHaveBeenCalledWith(mockRes, 'session123', mockChat.messages, 'Message too long');
      expect(sendError).not.toHaveBeenCalled();
    });

    it('should handle database error during chat retrieval', async () => {
      const mockValidation = {
        valid: false,
        error: 'Message too long'
      };

      validateMessage.mockReturnValue(mockValidation);
      chatService.getOrCreateChatSession.mockRejectedValue(new Error('Database error'));

      const result = await routeHelpers.validateMessageWithResponse('Invalid message', 'session123', mockRes, false);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Database error:', expect.any(Error));
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.DATABASE_ERROR);
    });
  });

  describe('getChatRenderData', () => {
    it('should return render data with processed messages', () => {
      const mockMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const processedMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '<p>Hi there!</p>' }
      ];

      processMessages.mockReturnValue(processedMessages);

      const result = routeHelpers.getChatRenderData(
        'session123',
        mockMessages,
        'Test error',
        true,
        'Pending message',
        'dark'
      );

      expect(processMessages).toHaveBeenCalledWith(mockMessages);
      expect(result).toEqual({
        sessionId: 'session123',
        messages: processedMessages,
        error: 'Test error',
        isLoading: true,
        pendingMessage: 'Pending message',
        theme: 'dark'
      });
    });

    it('should use default values when not provided', () => {
      const mockMessages = [];
      processMessages.mockReturnValue([]);

      const result = routeHelpers.getChatRenderData('session123', mockMessages);

      expect(result).toEqual({
        sessionId: 'session123',
        messages: [],
        error: null,
        isLoading: false,
        pendingMessage: null,
        theme: null
      });
    });

    it('should log debug information', () => {
      const mockMessages = [
        { role: 'user', content: 'Hello' }
      ];

      processMessages.mockReturnValue(mockMessages);

      routeHelpers.getChatRenderData('session123', mockMessages);

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG] getChatRenderData: Input messages:',
        expect.any(String)
      );
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG] getChatRenderData: Processed messages:',
        expect.any(String)
      );
    });
  });

  describe('handleDatabaseError', () => {
    it('should log error and send error page', () => {
      const mockError = new Error('Database connection failed');

      routeHelpers.handleDatabaseError(mockError, mockRes);

      expect(console.error).toHaveBeenCalledWith('Database error:', mockError);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.DATABASE_ERROR);
    });

    it('should use custom fallback message when provided', () => {
      const mockError = new Error('Database connection failed');
      const customMessage = 'Custom error message';

      routeHelpers.handleDatabaseError(mockError, mockRes, customMessage);

      expect(console.error).toHaveBeenCalledWith('Database error:', mockError);
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, customMessage);
    });
  });

  describe('validateSessionAndMessage', () => {
    let mockRes;

    beforeEach(() => {
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        render: jest.fn(),
        redirect: jest.fn()
      };

      // Reset all mocks
      jest.clearAllMocks();
    });

    it('should return validation object for valid session and message', async () => {
      const mockValidation = {
        valid: true,
        message: 'Valid message'
      };

      // Mock the underlying validation functions
      isValidSessionId.mockReturnValue(true);
      validateMessage.mockReturnValue(mockValidation);

      const result = await routeHelpers.validateSessionAndMessage('session123', 'Valid message', mockRes, false);

      expect(result).toEqual({
        sessionId: 'session123',
        validation: mockValidation
      });
      expect(isValidSessionId).toHaveBeenCalledWith('session123');
      expect(validateMessage).toHaveBeenCalledWith('Valid message');
    });

    it('should return null for invalid session ID', async () => {
      isValidSessionId.mockReturnValue(false);

      const result = await routeHelpers.validateSessionAndMessage('invalid', 'Valid message', mockRes, false);

      expect(result).toBeNull();
      expect(isValidSessionId).toHaveBeenCalledWith('invalid');
      expect(sendErrorPage).toHaveBeenCalled();
    });

    it('should return null for invalid message', async () => {
      isValidSessionId.mockReturnValue(true);
      validateMessage.mockReturnValue({
        valid: false,
        error: 'Invalid message'
      });

      chatService.getOrCreateChatSession.mockResolvedValue({
        messages: []
      });

      const result = await routeHelpers.validateSessionAndMessage('session123', 'Invalid message', mockRes, false);

      expect(result).toBeNull();
      expect(isValidSessionId).toHaveBeenCalledWith('session123');
      expect(validateMessage).toHaveBeenCalledWith('Invalid message');
      expect(sendChatError).toHaveBeenCalled();
    });

    it('should pass streaming flag correctly', async () => {
      isValidSessionId.mockReturnValue(true);
      validateMessage.mockReturnValue({
        valid: false,
        error: 'Invalid message'
      });

      await routeHelpers.validateSessionAndMessage('session123', 'Valid message', mockRes, true);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Invalid message', 400);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete validation flow', async () => {
      const mockValidation = {
        valid: true,
        message: 'Valid message'
      };

      isValidSessionId.mockReturnValue(true);
      validateMessage.mockReturnValue(mockValidation);

      const result = await routeHelpers.validateSessionAndMessage('validSession123', 'Valid message', mockRes, false);

      expect(result).toEqual({
        sessionId: 'validSession123',
        validation: mockValidation
      });
    });

    it('should handle complete error flow', async () => {
      isValidSessionId.mockReturnValue(false);

      const result = await routeHelpers.validateSessionAndMessage('invalid', 'Valid message', mockRes, false);

      expect(result).toBeNull();
      expect(sendErrorPage).toHaveBeenCalledWith(mockRes, ERROR_MESSAGES.SESSION_INVALID);
    });
  });
});