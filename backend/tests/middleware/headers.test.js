const { securityMiddleware, streamingSecurityMiddleware, commonSecurityHeaders } = require('../../src/middleware/headers');

describe('Headers Middleware', () => {
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
      set: jest.fn(),
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
});