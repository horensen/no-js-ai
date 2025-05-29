const { processMarkdown, processMessages } = require('../../src/utils/markdown');

describe('Markdown Utils', () => {
  describe('processMarkdown', () => {
    test('should return empty string for null or undefined input', () => {
      expect(processMarkdown(null)).toBe('');
      expect(processMarkdown(undefined)).toBe('');
    });

    test('should return empty string for non-string input', () => {
      expect(processMarkdown(123)).toBe('');
      expect(processMarkdown({})).toBe('');
      expect(processMarkdown([])).toBe('');
    });

    test('should process basic markdown', () => {
      const input = '**bold** text';
      const result = processMarkdown(input);

      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('text');
    });

    test('should handle empty string', () => {
      expect(processMarkdown('')).toBe('');
    });

    test('should sanitize dangerous HTML', () => {
      const input = '<script>alert("xss")</script>';
      const result = processMarkdown(input);

      expect(result).not.toContain('<script>');
    });

    test('should process code blocks', () => {
      const input = '```javascript\nconsole.log("hello");\n```';
      const result = processMarkdown(input);

      expect(result).toContain('<pre>');
      expect(result).toContain('<code');
    });

    test('should process inline code', () => {
      const input = 'Use `console.log()` for debugging';
      const result = processMarkdown(input);

      expect(result).toContain('<code>console.log()</code>');
    });

    test('should process headings', () => {
      const input = '# Main Title';
      const result = processMarkdown(input);

      expect(result).toContain('<h1>Main Title</h1>');
    });

    test('should process links', () => {
      const input = '[GitHub](https://github.com)';
      const result = processMarkdown(input);

      expect(result).toContain('<a href="https://github.com">GitHub</a>');
    });

    test('should process lists', () => {
      const input = '- Item 1\n- Item 2';
      const result = processMarkdown(input);

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
    });
  });

  describe('processMessages', () => {
    test('should return empty array for non-array input', () => {
      expect(processMessages(null)).toEqual([]);
      expect(processMessages(undefined)).toEqual([]);
      expect(processMessages('not an array')).toEqual([]);
      expect(processMessages({})).toEqual([]);
    });

    test('should handle empty array', () => {
      expect(processMessages([])).toEqual([]);
    });

    test('should process assistant messages with markdown', () => {
      const messages = [
        {
          role: 'assistant',
          content: '**Hello** there!'
        }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('<strong>Hello</strong>');
    });

    test('should process user messages with HTML escaping', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hello <script>alert("xss")</script>'
        }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should handle line breaks in user messages', () => {
      const messages = [
        {
          role: 'user',
          content: 'Line 1\nLine 2'
        }
      ];

      const result = processMessages(messages);

      expect(result[0].content).toBe('Line 1<br>Line 2');
    });

    test('should handle messages with toObject method (Mongoose documents)', () => {
      const mongooseDoc = {
        role: 'assistant',
        content: '*italic text*',
        toObject: jest.fn().mockReturnValue({
          role: 'assistant',
          content: '*italic text*'
        })
      };

      const result = processMessages([mongooseDoc]);

      expect(mongooseDoc.toObject).toHaveBeenCalled();
      expect(result[0].content).toContain('<em>italic text</em>');
    });

    test('should handle mixed message types', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hello & <test>'
        },
        {
          role: 'assistant',
          content: '**Response**'
        },
        {
          role: 'system',
          content: 'System message'
        }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('Hello &amp; &lt;test&gt;');
      expect(result[1].content).toContain('<strong>Response</strong>');
      expect(result[2].content).toBe('System message'); // Unchanged
    });

    test('should handle null or invalid message objects', () => {
      const messages = [
        null,
        undefined,
        'not an object',
        {
          role: 'user',
          content: 'Valid message'
        }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(4);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeUndefined();
      expect(result[2]).toBe('not an object');
      expect(result[3].content).toBe('Valid message');
    });

    test('should handle messages without content', () => {
      const messages = [
        {
          role: 'user'
          // no content property
        },
        {
          role: 'assistant',
          content: null
        }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: 'user' });
      expect(result[1]).toEqual({ role: 'assistant', content: null });
    });

    test('should preserve other message properties', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: new Date('2023-01-01'),
          id: 'msg-123'
        }
      ];

      const result = processMessages(messages);

      expect(result[0]).toEqual({
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2023-01-01'),
        id: 'msg-123'
      });
    });

    test('should handle special characters in user messages', () => {
      const message = {
        role: 'user',
        content: '& < > " \''
      };

      const result = processMessages([message]);

      expect(result[0].content).toBe('&amp; &lt; &gt; &quot; &#39;');
    });

    test('should process complex assistant markdown', () => {
      const message = {
        role: 'assistant',
        content: '# Title\n\n**Bold** and *italic* text with `code`'
      };

      const result = processMessages([message]);

      expect(result[0].content).toContain('<h1>Title</h1>');
      expect(result[0].content).toContain('<strong>Bold</strong>');
      expect(result[0].content).toContain('<em>italic</em>');
      expect(result[0].content).toContain('<code>code</code>');
    });
  });
});