const request = require('supertest');
const express = require('express');

// Mock express-rate-limit to control its behavior
const mockRateLimit = jest.fn();
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock middleware function that can be configured
    const createMockMiddleware = (config) => {
      return (req, res, next) => {
        // Simulate rate limiting behavior
        req.rateLimit = {
          limit: config.max,
          remaining: config.max - 1,
          reset: new Date(Date.now() + config.windowMs)
        };

        // Simulate hitting rate limit if configured
        if (req.headers['x-test-exceed-limit']) {
          if (config.handler) {
            return config.handler(req, res);
          } else {
            return res.status(429).json(config.message);
          }
        }

        next();
      };
    };

    // Configure the mock to return our mock middleware
    mockRateLimit.mockImplementation((config) => createMockMiddleware(config));

    // Import the middleware after mocking
    rateLimitingMiddleware = require('../../src/middleware/rateLimiting');

    // Setup test app
    app = express();
    app.use(express.json());
  });

  describe('apiRateLimitMiddleware', () => {
    test('should export API rate limiting middleware', () => {
      expect(rateLimitingMiddleware.apiRateLimitMiddleware).toBeDefined();
      expect(typeof rateLimitingMiddleware.apiRateLimitMiddleware).toBe('function');
    });

    test('should configure API rate limiting correctly', () => {
      // Check that rateLimit was called with correct configuration
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

    test('should allow requests within limits', async () => {
      app.use('/api', rateLimitingMiddleware.apiRateLimitMiddleware);
      app.get('/api/test', (req, res) => {
        res.json({ success: true, rateLimit: req.rateLimit });
      });

      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.rateLimit).toBeDefined();
    });

    test('should block requests when rate limit exceeded', async () => {
      app.use('/api', rateLimitingMiddleware.apiRateLimitMiddleware);
      app.get('/api/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/api/test')
        .set('x-test-exceed-limit', 'true')
        .expect(429);

      expect(response.body.error).toBe('Too many API requests');
    });
  });

  describe('chatRateLimitMiddleware', () => {
    test('should export chat rate limiting middleware', () => {
      expect(rateLimitingMiddleware.chatRateLimitMiddleware).toBeDefined();
      expect(typeof rateLimitingMiddleware.chatRateLimitMiddleware).toBe('function');
    });

    test('should configure chat rate limiting correctly', () => {
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

    test('should use custom handler for chat rate limiting', async () => {
      // Get the chat middleware config
      const chatConfig = mockRateLimit.mock.calls.find(call =>
        call[0].message && call[0].message.error === 'Too many chat requests'
      )[0];

      expect(chatConfig.handler).toBeDefined();

      // Test the custom handler
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        render: jest.fn()
      };

      chatConfig.handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Rate limit exceeded. Please wait a moment before sending another message.'
      });
    });

    test('should allow chat requests within limits', async () => {
      app.use('/chat', rateLimitingMiddleware.chatRateLimitMiddleware);
      app.post('/chat', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/chat')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('streamingRateLimitMiddleware', () => {
    test('should export streaming rate limiting middleware', () => {
      expect(rateLimitingMiddleware.streamingRateLimitMiddleware).toBeDefined();
      expect(typeof rateLimitingMiddleware.streamingRateLimitMiddleware).toBe('function');
    });

    test('should configure streaming rate limiting correctly', () => {
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

    test('should use custom handler for streaming rate limiting', async () => {
      // Get the streaming middleware config
      const streamingConfig = mockRateLimit.mock.calls.find(call =>
        call[0].message && call[0].message.error === 'Too many streaming requests'
      )[0];

      expect(streamingConfig.handler).toBeDefined();

      // Test the custom handler
      const mockReq = {};
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };

      streamingConfig.handler(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(429, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      expect(mockRes.write).toHaveBeenCalledWith('event: error\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"type": "error", "message": "Rate limit exceeded for streaming"}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should allow streaming requests within limits', async () => {
      app.use('/stream', rateLimitingMiddleware.streamingRateLimitMiddleware);
      app.get('/stream', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/stream')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('middleware integration', () => {
    test('should work with Express application', async () => {
      const testApp = express();

      testApp.use('/api', rateLimitingMiddleware.apiRateLimitMiddleware);
      testApp.use('/chat', rateLimitingMiddleware.chatRateLimitMiddleware);
      testApp.use('/stream', rateLimitingMiddleware.streamingRateLimitMiddleware);

      testApp.get('/api/test', (req, res) => res.json({ endpoint: 'api' }));
      testApp.post('/chat/test', (req, res) => res.json({ endpoint: 'chat' }));
      testApp.get('/stream/test', (req, res) => res.json({ endpoint: 'stream' }));

      // Test all endpoints work
      await request(testApp).get('/api/test').expect(200);
      await request(testApp).post('/chat/test').expect(200);
      await request(testApp).get('/stream/test').expect(200);
    });
  });
});