const ollama = require('../../src/utils/ollama');
const { MODEL_PREFERENCES, STREAMING_CONFIG, ERROR_MESSAGES } = require('../../src/utils/constants');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/constants', () => ({
  MODEL_PREFERENCES: {
    DEFAULT_MODEL: 'llama2',
    FALLBACK_MODEL: 'llama2:7b'
  },
  STREAMING_CONFIG: {
    TIMEOUT: 30000,
    CHUNK_SIZE: 1024
  },
  ERROR_MESSAGES: {
    OLLAMA_UNAVAILABLE: 'Ollama service unavailable'
  },
  OLLAMA_CONFIG: {
    URL: 'http://localhost:11434',
    DEFAULT_MODEL: 'llama2',
    REQUEST_TIMEOUT: 60000
  }
}));
jest.mock('../../src/utils/logger');

describe('Ollama Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock logger methods
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.info = jest.fn();
  });

  describe('formatConversationPrompt', () => {
    it('should format single string message', () => {
      const result = ollama.formatConversationPrompt('Hello world');

      expect(result).toBe('Hello world');
    });

    it('should format string message with system prompt', () => {
      const result = ollama.formatConversationPrompt('Hello world', 'You are a helpful assistant');

      expect(result).toBe('System: You are a helpful assistant\n\nHello world');
    });

    it('should format conversation history array', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = ollama.formatConversationPrompt(messages);

      expect(result).toBe('User: Hello\n\nAssistant: Hi there!\n\nUser: How are you?\n\nAssistant:');
    });

    it('should format conversation history with system prompt', () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = ollama.formatConversationPrompt(messages, 'Be helpful');

      expect(result).toBe('System: Be helpful\n\nUser: Hello\n\nAssistant:');
    });

    it('should handle empty array', () => {
      const result = ollama.formatConversationPrompt([]);

      expect(result).toBe('');
    });

    it('should handle empty array with system prompt', () => {
      const result = ollama.formatConversationPrompt([], 'System prompt');

      expect(result).toBe('System: System prompt\n\n');
    });

    it('should handle non-string, non-array input', () => {
      const result = ollama.formatConversationPrompt(123);

      expect(result).toBe('123');
    });

    it('should trim system prompt whitespace', () => {
      const result = ollama.formatConversationPrompt('Hello', '  System prompt  ');

      expect(result).toBe('System: System prompt\n\nHello');
    });

    it('should ignore empty system prompt', () => {
      const result = ollama.formatConversationPrompt('Hello', '   ');

      expect(result).toBe('Hello');
    });
  });

  describe('getOllamaRequestConfig', () => {
    it('should create basic request config', () => {
      const result = ollama.getOllamaRequestConfig('llama2', 'Test prompt');

      expect(result).toMatchObject({
        method: 'POST',
        url: expect.stringContaining('/api/generate'),
        data: {
          model: 'llama2',
          prompt: 'Test prompt',
          stream: false
        }
      });
    });

    it('should create streaming request config', () => {
      const result = ollama.getOllamaRequestConfig('llama2', 'Test prompt', true);

      expect(result).toMatchObject({
        method: 'POST',
        url: expect.stringContaining('/api/generate'),
        data: {
          model: 'llama2',
          prompt: 'Test prompt',
          stream: true
        }
      });
    });

    it('should include timeout configuration', () => {
      const result = ollama.getOllamaRequestConfig('llama2', 'Test prompt');

      expect(result.timeout).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', () => {
      expect(() => {
        ollama.formatConversationPrompt(null);
      }).not.toThrow();
    });

    it('should handle undefined input', () => {
      const result = ollama.formatConversationPrompt(undefined);

      expect(result).toBe('undefined');
    });
  });
});