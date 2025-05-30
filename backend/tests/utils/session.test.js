const { generateSessionId, formatSessionForAPI } = require('../../src/utils/session');

describe('Session Utility', () => {
  describe('generateSessionId', () => {
    it('should generate a session ID', () => {
      const sessionId = generateSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should generate unique session IDs', () => {
      const sessionId1 = generateSessionId();
      const sessionId2 = generateSessionId();

      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should generate session IDs with consistent format', () => {
      const sessionId = generateSessionId();

      // Should be alphanumeric and possibly contain hyphens
      expect(sessionId).toMatch(/^[a-zA-Z0-9-]+$/);
    });

    it('should generate multiple unique IDs', () => {
      const sessionIds = new Set();

      for (let i = 0; i < 100; i++) {
        sessionIds.add(generateSessionId());
      }

      // All should be unique
      expect(sessionIds.size).toBe(100);
    });
  });

  describe('formatSessionForAPI', () => {
    it('should format session for API response', () => {
      const session = {
        sessionId: 'test-session-123',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z')
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted).toHaveProperty('sessionId', 'test-session-123');
      expect(formatted).toHaveProperty('id', 'test-session-123');
      expect(formatted).toHaveProperty('title');
      expect(formatted).toHaveProperty('lastMessage');
      expect(formatted).toHaveProperty('messageCount', 2);
      expect(formatted).toHaveProperty('createdAt');
      expect(formatted).toHaveProperty('updatedAt');
    });

    it('should handle session with no messages', () => {
      const session = {
        sessionId: 'empty-session',
        messages: [],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z')
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.sessionId).toBe('empty-session');
      expect(formatted.id).toBe('empty-session');
      expect(formatted.messageCount).toBe(0);
      expect(formatted.lastMessage).toBeNull();
      expect(formatted.title).toBe('New Chat');
    });

    it('should generate title from first user message', () => {
      const session = {
        sessionId: 'titled-session',
        messages: [
          { role: 'user', content: 'What is the weather like today?' },
          { role: 'assistant', content: 'I cannot check the weather.' }
        ],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z')
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.title).toContain('What is the weather');
    });

    it('should truncate long titles', () => {
      const longMessage = 'This is a very long message that should be truncated because it exceeds the maximum length allowed for session titles in the API response format';

      const session = {
        sessionId: 'long-title-session',
        messages: [
          { role: 'user', content: longMessage }
        ],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z')
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.title.length).toBeLessThanOrEqual(50);
      expect(formatted.title).toContain('...');
    });

    it('should handle session with only assistant messages', () => {
      const session = {
        sessionId: 'assistant-only',
        messages: [
          { role: 'assistant', content: 'Hello! How can I help you?' }
        ],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z')
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.title).toBe('New Chat');
      expect(formatted.messageCount).toBe(1);
    });

    it('should format dates correctly', () => {
      const session = {
        sessionId: 'date-test',
        messages: [],
        createdAt: new Date('2023-01-01T12:30:45Z'),
        updatedAt: new Date('2023-01-02T15:45:30Z')
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.createdAt).toEqual(new Date('2023-01-01T12:30:45Z'));
      expect(formatted.updatedAt).toEqual(new Date('2023-01-02T15:45:30Z'));
    });

    it('should handle missing optional fields', () => {
      const session = {
        sessionId: 'minimal-session',
        messages: [
          { role: 'user', content: 'Test' }
        ]
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.sessionId).toBe('minimal-session');
      expect(formatted.id).toBe('minimal-session');
      expect(formatted.messageCount).toBe(1);
      expect(formatted.createdAt).toBeUndefined();
      expect(formatted.updatedAt).toBeUndefined();
    });

    it('should handle Mongoose document objects', () => {
      const mockSession = {
        sessionId: 'mongoose-session',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z'),
        toObject: jest.fn().mockReturnValue({
          sessionId: 'mongoose-session',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T01:00:00Z')
        })
      };

      const formatted = formatSessionForAPI(mockSession);

      expect(mockSession.toObject).toHaveBeenCalled();
      expect(formatted.sessionId).toBe('mongoose-session');
      expect(formatted.id).toBe('mongoose-session');
    });

    it('should handle session without sessionId', () => {
      const session = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      const formatted = formatSessionForAPI(session);

      expect(formatted.sessionId).toBeUndefined();
      expect(formatted.id).toBeUndefined();
    });

    it('should return both sessionId and id properties for sidebar compatibility', () => {
      const session = {
        sessionId: 'compatibility-test-session',
        messages: [
          { role: 'user', content: 'Test message' }
        ],
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T01:00:00Z')
      };

      const formatted = formatSessionForAPI(session);

      // Both properties should exist with the same value
      expect(formatted.sessionId).toBe('compatibility-test-session');
      expect(formatted.id).toBe('compatibility-test-session');
      expect(formatted.sessionId).toBe(formatted.id);

      // This ensures the sidebar delete functionality works correctly
      expect(formatted).toHaveProperty('sessionId');
      expect(formatted).toHaveProperty('id');
    });
  });

  describe('Error Handling', () => {
    it('should handle null session gracefully', () => {
      expect(() => formatSessionForAPI(null)).not.toThrow();

      const result = formatSessionForAPI(null);
      expect(result.sessionId).toBeNull();
      expect(result.id).toBeNull();
      expect(result.title).toBe('New Chat');
      expect(result.messageCount).toBe(0);
    });

    it('should handle undefined session gracefully', () => {
      expect(() => formatSessionForAPI(undefined)).not.toThrow();

      const result = formatSessionForAPI(undefined);
      expect(result.sessionId).toBeNull();
      expect(result.id).toBeNull();
      expect(result.title).toBe('New Chat');
      expect(result.messageCount).toBe(0);
    });

    it('should handle malformed messages array', () => {
      const session = {
        sessionId: 'malformed-session',
        messages: 'not-an-array'
      };

      expect(() => formatSessionForAPI(session)).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large message arrays efficiently', () => {
      const messages = Array(1000).fill().map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));

      const session = {
        sessionId: 'large-session',
        messages,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const startTime = Date.now();
      const formatted = formatSessionForAPI(session);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(formatted.messageCount).toBe(1000);
    });

    it('should handle many session formatting operations', () => {
      const sessions = Array(100).fill().map((_, i) => ({
        sessionId: `session-${i}`,
        messages: [
          { role: 'user', content: `Hello ${i}` },
          { role: 'assistant', content: `Hi ${i}` }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const startTime = Date.now();
      const formatted = sessions.map(formatSessionForAPI);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(formatted).toHaveLength(100);
    });
  });
});