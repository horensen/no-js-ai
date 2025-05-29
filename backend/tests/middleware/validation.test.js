const {
  inputValidationMiddleware,
  sessionValidationMiddleware,
  csrfProtectionMiddleware
} = require('../../src/middleware/validation');

describe('Validation Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = global.testHelpers.mockRequest();
    mockRes = global.testHelpers.mockResponse();
    mockNext = jest.fn();
  });

  describe('inputValidationMiddleware', () => {
    test('should pass through when no message in body', () => {
      inputValidationMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should sanitize message by trimming whitespace', () => {
      mockReq.body.message = '  Hello world  ';
      inputValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.body.message).toBe('Hello world');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject suspicious script content', () => {
      mockReq.body.message = '<script>alert("xss")</script>';
      inputValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject javascript: URLs', () => {
      mockReq.body.message = 'javascript:alert("xss")';
      inputValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject eval expressions', () => {
      mockReq.body.message = 'eval(malicious_code)';
      inputValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow safe content', () => {
      mockReq.body.message = 'Hello, how are you today?';
      inputValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('sessionValidationMiddleware', () => {
    test('should pass through when no session ID', () => {
      sessionValidationMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should accept valid session ID in body', () => {
      mockReq.body.sessionId = 'validSession123';
      sessionValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should accept valid session ID in params', () => {
      mockReq.params.sessionId = 'validSession123';
      sessionValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should accept valid session ID in query', () => {
      mockReq.query.session = 'validSession123';
      sessionValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject invalid session ID format', () => {
      mockReq.body.sessionId = 'invalid!session';
      sessionValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Invalid session format. Please start a new chat.'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject session ID that is too short', () => {
      mockReq.body.sessionId = 'short';
      sessionValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('csrfProtectionMiddleware', () => {
    test('should pass through GET requests', () => {
      mockReq.method = 'GET';
      csrfProtectionMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should pass through POST with valid referer', () => {
      mockReq.method = 'POST';
      mockReq.get = jest.fn()
        .mockReturnValueOnce('http://localhost:3000/chat') // referer
        .mockReturnValueOnce('localhost:3000'); // host

      csrfProtectionMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject POST without referer', () => {
      mockReq.method = 'POST';
      mockReq.get = jest.fn()
        .mockReturnValueOnce(null) // no referer
        .mockReturnValueOnce('localhost:3000'); // host

      csrfProtectionMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        error: 'Request must originate from this application.'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject POST with mismatched referer', () => {
      mockReq.method = 'POST';
      mockReq.get = jest.fn()
        .mockReturnValueOnce('http://malicious.com/attack') // bad referer
        .mockReturnValueOnce('localhost:3000'); // host

      csrfProtectionMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});