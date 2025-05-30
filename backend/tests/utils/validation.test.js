const {
  isValidSessionId,
  validateMessage,
  sanitizeHtml,
  hasSuspiciousContent
} = require('../../src/utils/validation');

describe('Validation Utilities', () => {
  describe('isValidSessionId', () => {
    it('should accept valid session IDs', () => {
      const validIds = [
        'abc1234567890',
        'A1B2C3D4E5F6G7H8I9',
        'test123456',
        '1234567890123456789012345678901234567890'
      ];

      validIds.forEach(id => {
        expect(isValidSessionId(id)).toBe(true);
      });
    });

    it('should reject invalid session IDs', () => {
      const invalidIds = [
        '',
        null,
        undefined,
        'short',
        'a'.repeat(51), // Too long
        'contains-dash',
        'contains_underscore',
        'contains space',
        'contains@symbol',
        'contains.dot',
        'contains!exclamation'
      ];

      invalidIds.forEach(id => {
        expect(isValidSessionId(id)).toBe(false);
      });
    });

    it('should handle non-string inputs', () => {
      const nonStringInputs = [
        123,
        [],
        {},
        true,
        false,
        Symbol('test')
      ];

      nonStringInputs.forEach(input => {
        expect(isValidSessionId(input)).toBe(false);
      });
    });

    it('should enforce minimum length', () => {
      expect(isValidSessionId('a'.repeat(9))).toBe(false);
      expect(isValidSessionId('a'.repeat(10))).toBe(true);
    });

    it('should enforce maximum length', () => {
      expect(isValidSessionId('a'.repeat(50))).toBe(true);
      expect(isValidSessionId('a'.repeat(51))).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('should accept valid messages', () => {
      const validMessages = [
        'Hello, how are you?',
        'This is a test message.',
        'Message with numbers 123 and symbols!',
        'A'.repeat(1000), // Long but valid message
        '🚀 Emojis are allowed! 😊'
      ];

      validMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.message).toBe(message);
      });
    });

    it('should reject empty or whitespace-only messages', () => {
      const emptyMessages = [
        '',
        '   ',
        '\n\t',
        null,
        undefined
      ];

      emptyMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'A'.repeat(2001); // Default max is 2000
      const result = validateMessage(longMessage);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect custom max length', () => {
      const message = 'A'.repeat(100);

      // Should pass with default length
      expect(validateMessage(message).valid).toBe(true);

      // Should fail with custom short length
      const result = validateMessage(message, 50);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle non-string inputs gracefully', () => {
      const nonStringInputs = [123, [], {}, true];

      nonStringInputs.forEach(input => {
        const result = validateMessage(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should provide clean message after validation', () => {
      const messageWithWhitespace = '  Hello World  ';
      const result = validateMessage(messageWithWhitespace);

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Hello World');
    });

    it('should handle edge cases', () => {
      // Single character
      expect(validateMessage('A').valid).toBe(true);

      // Exactly at max length
      const maxLengthMessage = 'A'.repeat(2000);
      expect(validateMessage(maxLengthMessage).valid).toBe(true);

      // Just over max length
      const overMaxMessage = 'A'.repeat(2001);
      expect(validateMessage(overMaxMessage).valid).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove potentially dangerous HTML tags', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        '<iframe src="malicious.com"></iframe>',
        '<object data="malicious.swf"></object>',
        '<embed src="malicious.swf">',
        'Hello <script>evil()</script> World'
      ];

      dangerousInputs.forEach(input => {
        const sanitized = sanitizeHtml(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<object');
        expect(sanitized).not.toContain('<embed');
      });
    });

    it('should preserve safe content', () => {
      const safeInputs = [
        'Hello World',
        'This is a normal message with numbers 123',
        'Emojis are safe: 🚀 😊 🎉',
        'Punctuation is fine: !@#$%^&*()',
        'Line breaks\nare okay'
      ];

      safeInputs.forEach(input => {
        const sanitized = sanitizeHtml(input);
        // Should preserve the basic content structure
        expect(sanitized.length).toBeGreaterThan(0);
        expect(typeof sanitized).toBe('string');
      });
    });

    it('should handle null and undefined inputs', () => {
      expect(sanitizeHtml(null)).toBeDefined();
      expect(sanitizeHtml(undefined)).toBeDefined();
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeHtml(123)).toBeDefined();
      expect(sanitizeHtml(true)).toBeDefined();
      expect(sanitizeHtml({})).toBeDefined();
    });
  });

  describe('hasSuspiciousContent', () => {
    it('should detect suspicious JavaScript patterns', () => {
      const suspiciousInputs = [
        '<script>alert("test")</script>',
        'javascript:void(0)',
        'vbscript:msgbox("test")',
        'onload="alert(1)"',
        'onerror="malicious()"',
        'onclick="steal()"',
        'eval("malicious code")',
        'expression(alert(1))',
        'document.cookie'
      ];

      suspiciousInputs.forEach(input => {
        expect(hasSuspiciousContent(input)).toBe(true);
      });
    });

    it('should not flag normal content as suspicious', () => {
      const normalInputs = [
        'Hello, how are you?',
        'I need help with my script for a play',
        'Can you evaluate this math problem?',
        'The document says...',
        'I have a question about expressions',
        'What is the onclick event in web development?'
      ];

      normalInputs.forEach(input => {
        expect(hasSuspiciousContent(input)).toBe(false);
      });
    });

    it('should be case insensitive for suspicious patterns', () => {
      const caseVariations = [
        '<SCRIPT>alert(1)</SCRIPT>',
        '<Script>Alert(1)</Script>',
        'JAVASCRIPT:void(0)',
        'JavaScript:Void(0)',
        'EVAL("test")',
        'Eval("test")'
      ];

      caseVariations.forEach(input => {
        expect(hasSuspiciousContent(input)).toBe(true);
      });
    });

    it('should handle empty and null inputs', () => {
      expect(hasSuspiciousContent('')).toBe(false);
      expect(hasSuspiciousContent(null)).toBe(false);
      expect(hasSuspiciousContent(undefined)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete message flow', () => {
      const userInput = '  Hello! How can you help me today?  ';

      // Validate message
      const validation = validateMessage(userInput);
      expect(validation.valid).toBe(true);

      // Sanitize the validated message
      const sanitized = sanitizeHtml(validation.message);
      expect(sanitized).toBe('Hello! How can you help me today?');

      // Check for suspicious content
      expect(hasSuspiciousContent(sanitized)).toBe(false);
    });

    it('should handle malicious input through the full pipeline', () => {
      const maliciousInput = '<script>alert("xss")</script>Please help me';

      // Should be flagged as suspicious
      expect(hasSuspiciousContent(maliciousInput)).toBe(true);

      // But validation might still pass for length
      const validation = validateMessage(maliciousInput);
      expect(validation.valid).toBe(false); // Should be false due to suspicious content

      // Sanitization should clean it
      const sanitized = sanitizeHtml(maliciousInput);
      expect(sanitized).not.toContain('<script>');
    });

    it('should handle edge cases in combination', () => {
      const edgeCases = [
        '', // Empty
        ' ', // Just whitespace
        'A'.repeat(2001), // Too long
        null, // Null
        undefined, // Undefined
        '<script>alert(1)</script>', // Malicious
        'Normal message' // Normal
      ];

      edgeCases.forEach(input => {
        // Should not throw errors
        expect(() => {
          const validation = validateMessage(input);
          const sanitized = sanitizeHtml(input);
          const suspicious = hasSuspiciousContent(input);
        }).not.toThrow();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large inputs efficiently', () => {
      const largeInput = 'A'.repeat(100000);
      const startTime = Date.now();

      sanitizeHtml(largeInput);
      hasSuspiciousContent(largeInput);
      validateMessage(largeInput);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle many validations efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const message = `Test message ${i}`;
        validateMessage(message);
        sanitizeHtml(message);
        hasSuspiciousContent(message);
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});