const {
  isValidSessionId,
  validateMessage,
  isValidModel,
  sanitizeHtml,
  validateUrlParams,
  hasSuspiciousContent
} = require('../../src/utils/validation');

describe('Validation Utils', () => {
  describe('isValidSessionId', () => {
    test('should accept valid session IDs', () => {
      expect(isValidSessionId('abcdefghij')).toBe(true);
      expect(isValidSessionId('ABC123xyz789')).toBe(true);
      expect(isValidSessionId('1234567890123456789012345678901234567890123456789')).toBe(true); // 49 chars
    });

    test('should reject invalid session IDs', () => {
      expect(isValidSessionId('')).toBe(false);
      expect(isValidSessionId('short')).toBe(false); // too short
      expect(isValidSessionId('a'.repeat(51))).toBe(false); // too long
      expect(isValidSessionId('invalid-chars!')).toBe(false);
      expect(isValidSessionId('has spaces')).toBe(false);
      expect(isValidSessionId(null)).toBe(false);
      expect(isValidSessionId(undefined)).toBe(false);
      expect(isValidSessionId(123)).toBe(false);
    });
  });

  describe('validateMessage', () => {
    test('should accept valid messages', () => {
      const result = validateMessage('Hello world');
      expect(result.valid).toBe(true);
      expect(result.message).toBe('Hello world');
    });

    test('should trim whitespace', () => {
      const result = validateMessage('  Hello world  ');
      expect(result.valid).toBe(true);
      expect(result.message).toBe('Hello world');
    });

    test('should reject empty messages', () => {
      expect(validateMessage('').valid).toBe(false);
      expect(validateMessage('   ').valid).toBe(false);
      expect(validateMessage(null).valid).toBe(false);
      expect(validateMessage(undefined).valid).toBe(false);
    });

    test('should reject non-string messages', () => {
      expect(validateMessage(123).valid).toBe(false);
      expect(validateMessage({}).valid).toBe(false);
      expect(validateMessage([]).valid).toBe(false);
      expect(validateMessage(true).valid).toBe(false);
    });

    test('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(2001);
      const result = validateMessage(longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    test('should respect custom max length', () => {
      const result = validateMessage('Hello world', 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 characters');
    });

    test('should detect suspicious content', () => {
      const suspiciousMessages = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onload=alert("xss")',
        'eval(malicious)',
        'expression(malicious)'
      ];

      suspiciousMessages.forEach(msg => {
        const result = validateMessage(msg);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('unsafe content');
      });
    });

    test('should allow safe HTML-like content', () => {
      const safeMessages = [
        'I love <3 coding',
        'Math: 2 > 1',
        'Email: user@example.com',
        'Code: function() { return true; }'
      ];

      safeMessages.forEach(msg => {
        const result = validateMessage(msg);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('isValidModel', () => {
    test('should accept valid model names', () => {
      expect(isValidModel('llama3.2')).toBe(true);
      expect(isValidModel('gpt-4')).toBe(true);
      expect(isValidModel('model_name')).toBe(true);
      expect(isValidModel('llama3.2:latest')).toBe(true);
      expect(isValidModel('123')).toBe(true);
      expect(isValidModel('a')).toBe(true);
    });

    test('should reject invalid model names', () => {
      expect(isValidModel('')).toBe(false);
      expect(isValidModel('model with spaces')).toBe(false);
      expect(isValidModel('model@invalid')).toBe(false);
      expect(isValidModel('model#invalid')).toBe(false);
      expect(isValidModel('model$invalid')).toBe(false);
      expect(isValidModel(null)).toBe(false);
      expect(isValidModel(undefined)).toBe(false);
      expect(isValidModel(123)).toBe(false);
      expect(isValidModel({})).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    test('should escape HTML characters', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(sanitizeHtml('Hello & goodbye'))
        .toBe('Hello &amp; goodbye');
      expect(sanitizeHtml("It's a 'test'"))
        .toBe('It&#039;s a &#039;test&#039;');
    });

    test('should handle all special characters', () => {
      expect(sanitizeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
    });

    test('should handle edge cases', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
      expect(sanitizeHtml(123)).toBe('');
      expect(sanitizeHtml({})).toBe('');
      expect(sanitizeHtml([])).toBe('');
      expect(sanitizeHtml(false)).toBe('');
    });

    test('should preserve safe text', () => {
      expect(sanitizeHtml('Hello world')).toBe('Hello world');
      expect(sanitizeHtml('123 456')).toBe('123 456');
      expect(sanitizeHtml('user@example.com')).toBe('user@example.com');
    });
  });

  describe('validateUrlParams', () => {
    test('should validate and return valid parameters', () => {
      const params = {
        sessionId: 'validSessionId123',
        model: 'llama3.2',
        invalid: 'should be ignored'
      };

      const result = validateUrlParams(params);
      expect(result.sessionId).toBe('validSessionId123');
      expect(result.model).toBe('llama3.2');
      expect(result.invalid).toBeUndefined();
    });

    test('should exclude invalid parameters', () => {
      const params = {
        sessionId: 'invalid session!',
        model: 'invalid model@name'
      };

      const result = validateUrlParams(params);
      expect(result.sessionId).toBeUndefined();
      expect(result.model).toBeUndefined();
    });

    test('should handle empty parameters', () => {
      const result = validateUrlParams({});
      expect(Object.keys(result)).toHaveLength(0);
    });

    test('should handle null/undefined parameters', () => {
      expect(validateUrlParams(null)).toEqual({});
      expect(validateUrlParams(undefined)).toEqual({});
    });

    test('should handle partial valid parameters', () => {
      const params = {
        sessionId: 'validSessionId123',
        model: 'invalid model@name',
        other: 'ignored'
      };

      const result = validateUrlParams(params);
      expect(result.sessionId).toBe('validSessionId123');
      expect(result.model).toBeUndefined();
      expect(result.other).toBeUndefined();
    });
  });

  describe('hasSuspiciousContent', () => {
    test('should detect suspicious patterns', () => {
      const suspiciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onload=alert("xss")',
        'onclick=malicious()',
        'eval(malicious)',
        'expression(malicious)',
        'vbscript:msgbox("xss")',
        'data:text/html,<script>alert("xss")</script>',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<img src="x" onerror="alert(\'xss\')">'
      ];

      suspiciousInputs.forEach(input => {
        expect(hasSuspiciousContent(input)).toBe(true);
      });
    });

    test('should allow safe content', () => {
      const safeInputs = [
        'Hello world',
        'I love <3 coding',
        'Math: 2 > 1 and 3 < 5',
        'Email: user@example.com',
        'Code: function() { return true; }',
        'https://example.com',
        'const x = "hello";',
        'if (condition) { doSomething(); }',
        'Normal text with punctuation!',
        '日本語のテキスト',
        'Émojis: 😀 🚀 💻'
      ];

      safeInputs.forEach(input => {
        expect(hasSuspiciousContent(input)).toBe(false);
      });
    });

    test('should handle edge cases', () => {
      expect(hasSuspiciousContent('')).toBe(false);
      expect(hasSuspiciousContent(null)).toBe(false);
      expect(hasSuspiciousContent(undefined)).toBe(false);
      expect(hasSuspiciousContent(123)).toBe(false);
      expect(hasSuspiciousContent({})).toBe(false);
      expect(hasSuspiciousContent([])).toBe(false);
      expect(hasSuspiciousContent(true)).toBe(false);
    });

    test('should be case-insensitive for some patterns', () => {
      expect(hasSuspiciousContent('JAVASCRIPT:alert("xss")')).toBe(true);
      expect(hasSuspiciousContent('Javascript:alert("xss")')).toBe(true);
      expect(hasSuspiciousContent('OnLoad=alert("xss")')).toBe(true);
      expect(hasSuspiciousContent('EVAL(malicious)')).toBe(true);
    });

    test('should detect suspicious patterns in mixed content', () => {
      expect(hasSuspiciousContent('This looks normal but has <script>alert("xss")</script> in it')).toBe(true);
      expect(hasSuspiciousContent('Click here: javascript:alert("xss") for more info')).toBe(true);
      expect(hasSuspiciousContent('Some text then eval(bad) and more text')).toBe(true);
    });
  });
});