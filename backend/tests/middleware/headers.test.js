const { commonSecurityHeaders } = require('../../src/middleware/headers');

describe('Headers Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      setHeader: jest.fn()
    };
    next = jest.fn();
  });

  describe('commonSecurityHeaders', () => {
    it('should set all required security headers', () => {
      commonSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', "default-src 'self'; script-src 'none'; object-src 'none';");
    });

    it('should set custom headers', () => {
      commonSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Powered-By', 'No-JS AI Chat');
      expect(res.setHeader).toHaveBeenCalledWith('Server', 'Secure-Chat/1.0');
    });

    it('should call next() to continue middleware chain', () => {
      commonSecurityHeaders(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should set exactly 7 headers', () => {
      commonSecurityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledTimes(7);
    });

    it('should work with different request objects', () => {
      const customReq = { method: 'POST', url: '/test' };

      commonSecurityHeaders(customReq, res, next);

      expect(res.setHeader).toHaveBeenCalledTimes(7);
      expect(next).toHaveBeenCalled();
    });

    it('should not modify request object', () => {
      const originalReq = { ...req };

      commonSecurityHeaders(req, res, next);

      expect(req).toEqual(originalReq);
    });
  });
});