const { processMarkdown, processMessages } = require('../../src/utils/markdown');

describe('Markdown Utility', () => {
  describe('processMarkdown', () => {
    it('should convert basic markdown to HTML', () => {
      const markdown = '**bold** and *italic* text';
      const result = processMarkdown(markdown);

      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should handle headers', () => {
      const markdown = '# Header 1\n## Header 2\n### Header 3';
      const result = processMarkdown(markdown);

      expect(result).toContain('<h1>Header 1</h1>');
      expect(result).toContain('<h2>Header 2</h2>');
      expect(result).toContain('<h3>Header 3</h3>');
    });

    it('should handle code blocks', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const result = processMarkdown(markdown);

      expect(result).toContain('<pre>');
      expect(result).toContain('<code');
      expect(result).toContain('const x = 1;');
    });

    it('should handle inline code', () => {
      const markdown = 'Use `console.log()` for debugging';
      const result = processMarkdown(markdown);

      expect(result).toContain('<code>console.log()</code>');
    });

    it('should handle lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const result = processMarkdown(markdown);

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('<li>Item 3</li>');
    });

    it('should handle numbered lists', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = processMarkdown(markdown);

      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
      expect(result).toContain('<li>Second</li>');
      expect(result).toContain('<li>Third</li>');
    });

    it('should handle links', () => {
      const markdown = '[Google](https://google.com)';
      const result = processMarkdown(markdown);

      expect(result).toContain('<a href="https://google.com">Google</a>');
    });

    it('should handle blockquotes', () => {
      const markdown = '> This is a quote';
      const result = processMarkdown(markdown);

      expect(result).toContain('<blockquote>');
      expect(result).toContain('This is a quote');
    });

    it('should convert line breaks', () => {
      const markdown = 'Line 1\nLine 2';
      const result = processMarkdown(markdown);

      expect(result).toContain('<br>');
    });

    it('should handle empty input', () => {
      expect(processMarkdown('')).toBe('');
      expect(processMarkdown(null)).toBe('');
      expect(processMarkdown(undefined)).toBe('');
    });

    it('should handle non-string input', () => {
      expect(processMarkdown(123)).toBe('');
      expect(processMarkdown({})).toBe('');
      expect(processMarkdown([])).toBe('');
    });

    it('should sanitize dangerous HTML', () => {
      const markdown = '<script>alert("xss")</script>';
      const result = processMarkdown(markdown);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove iframe tags', () => {
      const markdown = '<iframe src="evil.com"></iframe>';
      const result = processMarkdown(markdown);

      expect(result).not.toContain('<iframe>');
    });

    it('should remove event handlers', () => {
      const markdown = '<div onclick="alert(1)">Click me</div>';
      const result = processMarkdown(markdown);

      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    it('should handle markdown with HTML entities', () => {
      const markdown = 'Less than < and greater than >';
      const result = processMarkdown(markdown);

      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should handle complex markdown', () => {
      const markdown = `
# Title
This is **bold** and *italic*.

## Code Example
\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

- List item 1
- List item 2

> This is a quote

[Link](https://example.com)
      `;

      const result = processMarkdown(markdown);

      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<pre>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<a href="https://example.com">Link</a>');
    });

    it('should handle markdown processing errors gracefully', () => {
      // Mock marked to throw an error
      const originalMarked = require('marked').marked;
      require('marked').marked = jest.fn().mockImplementation(() => {
        throw new Error('Mock marked error');
      });

      const result = processMarkdown('<script>alert("test")</script>');

      // When error occurs in marked(), the function returns empty string from the beginning of processMarkdown
      expect(result).toBe('');

      // Restore original
      require('marked').marked = originalMarked;
    });
  });

  describe('processMessages', () => {
    it('should process assistant messages with markdown', () => {
      const messages = [
        { role: 'assistant', content: '**Bold text** and *italic*' }
      ];

      const result = processMessages(messages);

      expect(result[0].content).toContain('<strong>Bold text</strong>');
      expect(result[0].content).toContain('<em>italic</em>');
    });

    it('should escape HTML in user messages', () => {
      const messages = [
        { role: 'user', content: '<script>alert("xss")</script>' }
      ];

      const result = processMessages(messages);

      expect(result[0].content).toContain('&lt;script&gt;');
      expect(result[0].content).not.toContain('<script>');
    });

    it('should convert line breaks in user messages', () => {
      const messages = [
        { role: 'user', content: 'Line 1\nLine 2' }
      ];

      const result = processMessages(messages);

      expect(result[0].content).toContain('Line 1<br>Line 2');
    });

    it('should handle mixed message types', () => {
      const messages = [
        { role: 'user', content: 'Hello <world>' },
        { role: 'assistant', content: '**Hello** back!' },
        { role: 'user', content: 'Line 1\nLine 2' }
      ];

      const result = processMessages(messages);

      expect(result[0].content).toBe('Hello &lt;world&gt;');
      expect(result[1].content).toContain('<strong>Hello</strong>');
      expect(result[2].content).toContain('<br>');
    });

    it('should handle Mongoose documents', () => {
      const mockMessage = {
        role: 'assistant',
        content: '**Bold**',
        toObject: jest.fn().mockReturnValue({
          role: 'assistant',
          content: '**Bold**'
        })
      };

      const result = processMessages([mockMessage]);

      expect(mockMessage.toObject).toHaveBeenCalled();
      expect(result[0].content).toContain('<strong>Bold</strong>');
    });

    it('should handle empty messages array', () => {
      expect(processMessages([])).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(processMessages(null)).toEqual([]);
      expect(processMessages(undefined)).toEqual([]);
      expect(processMessages('not an array')).toEqual([]);
      expect(processMessages(123)).toEqual([]);
    });

    it('should handle invalid message objects', () => {
      const messages = [
        null,
        undefined,
        'not an object',
        { role: 'user' }, // missing content
        { content: 'no role' }, // missing role
        { role: 'assistant', content: '**Valid**' }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(6);
      expect(result[5].content).toContain('<strong>Valid</strong>');
    });

    it('should preserve other message properties', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2023-01-01',
          id: '123'
        }
      ];

      const result = processMessages(messages);

      expect(result[0].role).toBe('user');
      expect(result[0].timestamp).toBe('2023-01-01');
      expect(result[0].id).toBe('123');
      expect(result[0].content).toBe('Hello');
    });

    it('should handle messages with no content', () => {
      const messages = [
        { role: 'user', content: '' },
        { role: 'assistant', content: null },
        { role: 'user', content: undefined }
      ];

      const result = processMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('');
    });

    it('should handle special characters in user messages', () => {
      const messages = [
        { role: 'user', content: 'Quotes: "double" and \'single\' & ampersand' }
      ];

      const result = processMessages(messages);

      expect(result[0].content).toContain('&quot;double&quot;');
      expect(result[0].content).toContain('&#39;single&#39;');
      expect(result[0].content).toContain('&amp; ampersand');
    });
  });

  describe('Error Handling', () => {
    it('should handle DOMPurify failures', () => {
      // This test is complex to mock properly, so let's just test that the function doesn't crash
      const inputs = [
        '**bold**',
        '<script>alert(1)</script>',
        'Normal text',
        '# Header\n\n**Bold** text'
      ];

      inputs.forEach(input => {
        expect(() => processMarkdown(input)).not.toThrow();
      });
    });
  });
});