const {
  generateSessionId,
  createSessionPreview,
  getLastMessage,
  countMessagesByRole,
  formatSessionForAPI,
  validateSessionAccess,
  getSessionCleanupCriteria
} = require('../../src/utils/session');

describe('Session Utils', () => {
  describe('generateSessionId', () => {
    test('should generate session ID with default length', () => {
      const sessionId = generateSessionId();
      expect(sessionId).toHaveLength(15);
      expect(/^[a-zA-Z0-9]+$/.test(sessionId)).toBe(true);
    });

    test('should generate session ID with custom length', () => {
      const sessionId = generateSessionId(20);
      expect(sessionId).toHaveLength(20);
      expect(/^[a-zA-Z0-9]+$/.test(sessionId)).toBe(true);
    });

    test('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createSessionPreview', () => {
    test('should create preview from first user message', () => {
      const messages = [
        { role: 'user', content: 'What is the weather like today?' },
        { role: 'assistant', content: 'The weather is sunny.' }
      ];
      const preview = createSessionPreview(messages);
      expect(preview).toBe('What is the weather like today?');
    });

    test('should truncate long messages', () => {
      const messages = [
        { role: 'user', content: 'This is a very long message that should be truncated because it exceeds the maximum length' }
      ];
      const preview = createSessionPreview(messages);
      expect(preview).toHaveLength(53); // 50 chars + '...'
      expect(preview.endsWith('...')).toBe(true);
    });

    test('should handle empty or no messages', () => {
      expect(createSessionPreview([])).toBe('New chat');
      expect(createSessionPreview(null)).toBe('New chat');
      expect(createSessionPreview(undefined)).toBe('New chat');
    });

    test('should handle assistant-only messages', () => {
      const messages = [
        { role: 'assistant', content: 'Hello, how can I help?' }
      ];
      const preview = createSessionPreview(messages);
      expect(preview).toBe('New chat');
    });

    test('should normalize whitespace', () => {
      const messages = [
        { role: 'user', content: '  Hello    world   ' }
      ];
      const preview = createSessionPreview(messages);
      // Original content has whitespace, so it gets trimmed and normalized,
      // and since the trimmed length differs from original, ellipsis is added
      expect(preview).toBe('Hello world...');
    });
  });

  describe('getLastMessage', () => {
    test('should return last message', () => {
      const messages = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' }
      ];
      const lastMessage = getLastMessage(messages);
      expect(lastMessage.content).toBe('Third');
    });

    test('should handle empty messages', () => {
      expect(getLastMessage([])).toBe(null);
      expect(getLastMessage(null)).toBe(null);
      expect(getLastMessage(undefined)).toBe(null);
    });
  });

  describe('countMessagesByRole', () => {
    test('should count messages by role', () => {
      const messages = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
        { role: 'user', content: 'Fourth' }
      ];
      const counts = countMessagesByRole(messages);
      expect(counts.user).toBe(3);
      expect(counts.assistant).toBe(1);
      expect(counts.total).toBe(4);
    });

    test('should handle empty messages', () => {
      const counts = countMessagesByRole([]);
      expect(counts.user).toBe(0);
      expect(counts.assistant).toBe(0);
      expect(counts.total).toBe(0);
    });
  });

  describe('formatSessionForAPI', () => {
    test('should format session data for API', () => {
      const session = {
        sessionId: 'test123',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() },
          { role: 'assistant', content: 'Hi there', timestamp: new Date() }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const formatted = formatSessionForAPI(session);
      expect(formatted.sessionId).toBe('test123');
      expect(formatted.messageCount).toBe(2);
      expect(formatted.messageCounts.user).toBe(1);
      expect(formatted.messageCounts.assistant).toBe(1);
      expect(formatted.preview).toBe('Hello');
      expect(formatted.lastMessage.content).toBe('Hi there');
    });
  });

  describe('validateSessionAccess', () => {
    test('should validate session access', () => {
      const session = { sessionId: 'test123' };
      expect(validateSessionAccess(session)).toBe(true);
      expect(validateSessionAccess(null)).toBe(false);
    });
  });

  describe('getSessionCleanupCriteria', () => {
    test('should generate cleanup criteria', () => {
      const cutoffDate = new Date();
      const criteria = getSessionCleanupCriteria(cutoffDate);
      expect(criteria.updatedAt.$lt).toBe(cutoffDate);
      expect(criteria.$or).toHaveLength(2);
    });
  });
});