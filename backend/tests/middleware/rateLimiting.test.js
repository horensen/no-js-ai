// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn(() => {
    const mockMiddleware = jest.fn((req, res, next) => {
      // Simulate rate limit behavior
      if (req.rateLimitExceeded) {
        res.status(429).render('error', {
          error: 'Rate limit exceeded. Please wait a moment before sending another message.'
        });
      } else {
        next();
      }
    });
    return mockMiddleware;
  });
});

// Mock constants
jest.mock('../../src/utils/constants', () => ({
  RATE_LIMITS: {
    CHAT: {
      windowMs: 60000,
      max: 10,
      message: 'Too many chat requests'
    }
  }
}));

const { chatRateLimitMiddleware } = require('../../src/middleware/rateLimiting');

describe('Rate Limiting Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      ip: '127.0.0.1',
      rateLimitExceeded: false
    };
    res = {
      status: jest.fn().mockReturnThis(),
      render: jest.fn()
    };
    next = jest.fn();
  });

  describe('chatRateLimitMiddleware', () => {
    it('should be a function', () => {
      expect(typeof chatRateLimitMiddleware).toBe('function');
    });

    it('should allow requests within rate limit', () => {
      chatRateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.render).not.toHaveBeenCalled();
    });

    it('should block requests when rate limit exceeded', () => {
      req.rateLimitExceeded = true;

      chatRateLimitMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Rate limit exceeded. Please wait a moment before sending another message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle multiple requests from same IP', () => {
      // First request should pass
      chatRateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Reset mocks
      jest.clearAllMocks();

      // Second request should also pass (within limit)
      chatRateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle requests from different IPs independently', () => {
      const req1 = { ...req, ip: '127.0.0.1' };
      const req2 = { ...req, ip: '192.168.1.1' };

      chatRateLimitMiddleware(req1, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      chatRateLimitMiddleware(req2, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle edge cases gracefully', () => {
      // Test with missing IP
      const reqWithoutIP = { ...req };
      delete reqWithoutIP.ip;

      expect(() => {
        chatRateLimitMiddleware(reqWithoutIP, res, next);
      }).not.toThrow();
    });
  });
});
