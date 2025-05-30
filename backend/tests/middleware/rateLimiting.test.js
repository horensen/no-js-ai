const request = require('supertest');
const express = require('express');

// Mock express-rate-limit before importing the module
const mockRateLimit = jest.fn();
const mockRateLimitFunction = (req, res, next) => next();

// Set up the mock to return our middleware function
mockRateLimit.mockReturnValue(mockRateLimitFunction);

jest.mock('express-rate-limit', () => mockRateLimit);

// Mock constants
jest.mock('../../src/utils/constants', () => ({
  RATE_LIMITS: {
    API: {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many API requests'
    },
    CHAT: {
      windowMs: 60 * 1000,
      max: 10,
      message: 'Too many chat requests'
    },
    STREAMING: {
      windowMs: 30 * 1000,
      max: 5,
      message: 'Too many streaming requests'
    }
  }
}));

describe('Rate Limiting Middleware', () => {
  let app;
  let rateLimitingMiddleware;

  beforeAll(() => {
    // Clear any previous calls to the mock
    jest.clearAllMocks();

    // Import the middleware module after mocks are set up
    rateLimitingMiddleware = require('../../src/middleware/rateLimiting');
  });

  beforeEach(() => {
    // Reset the mock implementation before each test
    mockRateLimit.mockReturnValue(mockRateLimitFunction);

    app = express();
    app.use(express.json());
  });

  describe('apiRateLimitMiddleware', () => {
    test('should be defined', () => {
      expect(rateLimitingMiddleware.apiRateLimitMiddleware).toBeDefined();
    });

    test('should configure API rate limiting correctly', () => {
      // Check that mockRateLimit was called with the correct API configuration
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 100,
          message: { error: 'Too many API requests' },
          standardHeaders: true,
          legacyHeaders: false
        })
      );
    });

    test('should allow requests within limit', async () => {
      app.use('/api', rateLimitingMiddleware.apiRateLimitMiddleware);
      app.get('/api/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });

  describe('chatRateLimitMiddleware', () => {
    test('should be defined', () => {
      expect(rateLimitingMiddleware.chatRateLimitMiddleware).toBeDefined();
    });

    test('should configure chat rate limiting correctly', () => {
      // Check that mockRateLimit was called with the correct chat configuration
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 60 * 1000,
          max: 10,
          message: {
            error: 'Too many chat requests',
            retryAfter: 60
          },
          standardHeaders: true,
          legacyHeaders: false,
          handler: expect.any(Function)
        })
      );
    });

    test('should have custom handler for chat rate limiting', () => {
      // Find the chat configuration call
      const chatConfig = mockRateLimit.mock.calls.find(call =>
        call[0].message &&
        call[0].message.error === 'Too many chat requests' &&
        call[0].handler
      );

      expect(chatConfig).toBeDefined();
      expect(chatConfig[0].handler).toBeInstanceOf(Function);
    });

    test('should work with Express app', async () => {
      app.use('/chat', rateLimitingMiddleware.chatRateLimitMiddleware);
      app.get('/chat/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/chat/test')
        .expect(200);
    });
  });

  describe('streamingRateLimitMiddleware', () => {
    test('should be defined', () => {
      expect(rateLimitingMiddleware.streamingRateLimitMiddleware).toBeDefined();
    });

    test('should configure streaming rate limiting correctly', () => {
      // Check that mockRateLimit was called with the correct streaming configuration
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 30 * 1000,
          max: 5,
          message: { error: 'Too many streaming requests' },
          standardHeaders: true,
          legacyHeaders: false,
          handler: expect.any(Function)
        })
      );
    });

    test('should have custom handler for streaming rate limiting', () => {
      // Find the streaming configuration call
      const streamingConfig = mockRateLimit.mock.calls.find(call =>
        call[0].message &&
        call[0].message.error === 'Too many streaming requests' &&
        call[0].handler
      );

      expect(streamingConfig).toBeDefined();
      expect(streamingConfig[0].handler).toBeInstanceOf(Function);
    });

    test('should work with Express app', async () => {
      app.use('/stream', rateLimitingMiddleware.streamingRateLimitMiddleware);
      app.get('/stream/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/stream/test')
        .expect(200);
    });
  });

  describe('Rate limiting integration', () => {
    test('should work with Express app', async () => {
      app.use('/api', rateLimitingMiddleware.apiRateLimitMiddleware);
      app.use('/chat', rateLimitingMiddleware.chatRateLimitMiddleware);
      app.use('/stream', rateLimitingMiddleware.streamingRateLimitMiddleware);

      app.get('/api/test', (req, res) => res.json({ api: true }));
      app.get('/chat/test', (req, res) => res.json({ chat: true }));
      app.get('/stream/test', (req, res) => res.json({ stream: true }));

      await request(app).get('/api/test').expect(200);
      await request(app).get('/chat/test').expect(200);
      await request(app).get('/stream/test').expect(200);
    });

    test('should call rate limit with different configurations', () => {
      // Verify that mockRateLimit was called multiple times with different configs
      expect(mockRateLimit).toHaveBeenCalledTimes(3);

      // Check API config
      expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({
        max: 100,
        windowMs: 15 * 60 * 1000
      }));

      // Check Chat config
      expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({
        max: 10,
        windowMs: 60 * 1000
      }));

      // Check Streaming config
      expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({
        max: 5,
        windowMs: 30 * 1000
      }));
    });
  });
});