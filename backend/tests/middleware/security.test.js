const {
  securityMiddleware,
  apiRateLimitMiddleware,
  chatRateLimitMiddleware,
  streamingRateLimitMiddleware,
  inputValidationMiddleware,
  sessionValidationMiddleware,
  csrfProtectionMiddleware,
  streamingSecurityMiddleware,
  commonSecurityHeaders
} = require('../../src/middleware/security');

describe('Security Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      path: '/test',
      method: 'GET',
      headers: {}
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      render: jest.fn(),
      removeHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('securityMiddleware', () => {
    test('should be defined', () => {
      expect(securityMiddleware).toBeDefined();
      expect(typeof securityMiddleware).toBe('function');
    });

    test('should call next for valid request', (done) => {
      securityMiddleware(mockReq, mockRes, (err) => {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    });
  });

  describe('streamingSecurityMiddleware', () => {
    test('should be defined', () => {
      expect(streamingSecurityMiddleware).toBeDefined();
      expect(typeof streamingSecurityMiddleware).toBe('function');
    });

    test('should set security headers', () => {
      streamingSecurityMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('commonSecurityHeaders', () => {
    test('should be defined', () => {
      expect(commonSecurityHeaders).toBeDefined();
      expect(typeof commonSecurityHeaders).toBe('function');
    });

    test('should set common headers', () => {
      commonSecurityHeaders(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Powered-By', 'No-JS AI Chat');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Server', 'Secure-Chat/1.0');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('rate limiting middleware', () => {
    test('should export rate limiting functions', () => {
      expect(apiRateLimitMiddleware).toBeDefined();
      expect(chatRateLimitMiddleware).toBeDefined();
      expect(streamingRateLimitMiddleware).toBeDefined();
    });
  });

  describe('validation middleware', () => {
    test('should export validation functions', () => {
      expect(inputValidationMiddleware).toBeDefined();
      expect(sessionValidationMiddleware).toBeDefined();
      expect(csrfProtectionMiddleware).toBeDefined();
    });
  });
});