const { inputValidationMiddleware } = require('../../src/middleware/validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      render: jest.fn()
    };
    next = jest.fn();
  });

  describe('inputValidationMiddleware', () => {
    it('should pass through requests without message', () => {
      inputValidationMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.render).not.toHaveBeenCalled();
    });

    it('should sanitize and pass clean messages', () => {
      req.body.message = '  Hello world!  ';

      inputValidationMiddleware(req, res, next);

      expect(req.body.message).toBe('Hello world!');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block messages with script tags', () => {
      req.body.message = 'Hello <script>alert("xss")</script>';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with javascript: protocol', () => {
      req.body.message = 'Click here: javascript:alert("xss")';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with vbscript: protocol', () => {
      req.body.message = 'Click here: vbscript:msgbox("xss")';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with onload event handler', () => {
      req.body.message = '<img onload="alert(1)" src="x">';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with onerror event handler', () => {
      req.body.message = '<img onerror="alert(1)" src="invalid">';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with onclick event handler', () => {
      req.body.message = '<div onclick="alert(1)">Click me</div>';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with eval function', () => {
      req.body.message = 'eval("alert(1)")';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block messages with expression function', () => {
      req.body.message = 'expression(alert(1))';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should be case insensitive for suspicious patterns', () => {
      req.body.message = 'Hello <SCRIPT>alert("xss")</SCRIPT>';

      inputValidationMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', {
        error: 'Message contains potentially unsafe content. Please modify your message.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle empty message body', () => {
      req.body.message = '';

      inputValidationMiddleware(req, res, next);

      expect(req.body.message).toBe('');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only messages', () => {
      req.body.message = '   \n\t   ';

      inputValidationMiddleware(req, res, next);

      expect(req.body.message).toBe('');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow legitimate messages with safe HTML-like content', () => {
      req.body.message = 'I love <3 programming and using > operators';

      inputValidationMiddleware(req, res, next);

      expect(req.body.message).toBe('I love <3 programming and using > operators');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle requests with no body', () => {
      req.body = undefined;

      expect(() => {
        inputValidationMiddleware(req, res, next);
      }).not.toThrow();

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});