const {
  formatConversationPrompt,
  getOllamaRequestConfig,
  handleOllamaError,
  getModelPreferenceOrder
} = require('../../src/utils/ollama');
const { ERROR_MESSAGES } = require('../../src/utils/constants');

describe('Ollama Utils', () => {
  describe('formatConversationPrompt', () => {
    test('should return string as-is for single message', () => {
      const result = formatConversationPrompt('Hello, world!');
      expect(result).toBe('Hello, world!');
    });

    test('should format conversation history correctly', () => {
      const conversation = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = formatConversationPrompt(conversation);

      expect(result).toBe('User: Hello\n\nAssistant: Hi there!\n\nUser: How are you?\n\nAssistant:');
    });

    test('should handle mixed roles', () => {
      const conversation = [
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Hi' }
      ];

      const result = formatConversationPrompt(conversation);

      expect(result).toBe('Assistant: Hello\n\nUser: Hi\n\nAssistant:');
    });

    test('should handle empty conversation', () => {
      const result = formatConversationPrompt([]);
      expect(result).toBe('');
    });
  });

  describe('getOllamaRequestConfig', () => {
    test('should create config for non-streaming request', () => {
      const config = getOllamaRequestConfig('llama3.2', 'test prompt', false);

      expect(config.method).toBe('POST');
      expect(config.data.model).toBe('llama3.2');
      expect(config.data.prompt).toBe('test prompt');
      expect(config.data.stream).toBe(false);
      expect(config.timeout).toBe(30000);
    });

    test('should create config for streaming request', () => {
      const config = getOllamaRequestConfig('llama3.2', 'test prompt', true);

      expect(config.method).toBe('POST');
      expect(config.data.stream).toBe(true);
      expect(config.timeout).toBe(120000);
      expect(config.responseType).toBe('stream');
    });

    test('should include proper headers', () => {
      const config = getOllamaRequestConfig('llama3.2', 'test prompt');

      expect(config.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('handleOllamaError', () => {
    const mockGetAvailableModels = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should handle connection refused error', async () => {
      const error = { code: 'ECONNREFUSED' };

      await expect(handleOllamaError(error, mockGetAvailableModels))
        .rejects.toThrow('Cannot connect to Ollama. Please ensure Ollama is running on localhost:11434');
    });

    test('should handle model not found with available models', async () => {
      const error = { response: { status: 404 }, message: 'Not found' };
      mockGetAvailableModels.mockResolvedValue([
        { name: 'llama3.2' },
        { name: 'mistral' }
      ]);

      await expect(handleOllamaError(error, mockGetAvailableModels))
        .rejects.toThrow('Model not found. Available models: llama3.2, mistral');
    });

    test('should handle model not found with no available models', async () => {
      const error = { response: { status: 404 }, message: 'Not found' };
      mockGetAvailableModels.mockResolvedValue([]);

      await expect(handleOllamaError(error, mockGetAvailableModels))
        .rejects.toThrow('Model not found and no models are available. Please pull a model first (e.g., ollama pull llama3.2)');
    });

    test('should handle timeout error for streaming', async () => {
      const error = { code: 'ECONNABORTED', message: 'timeout' };

      await expect(handleOllamaError(error, mockGetAvailableModels, true))
        .rejects.toThrow('Request timeout. The streaming request took too long to complete.');
    });

    test('should handle timeout error for non-streaming', async () => {
      const error = { code: 'ECONNABORTED', message: 'timeout' };

      await expect(handleOllamaError(error, mockGetAvailableModels, false))
        .rejects.toThrow('Request timeout. The request took too long to complete.');
    });

    test('should handle generic error', async () => {
      const error = { message: 'Generic error' };

      await expect(handleOllamaError(error, mockGetAvailableModels))
        .rejects.toThrow(`${ERROR_MESSAGES.OLLAMA_UNAVAILABLE}: Generic error`);
    });

    test('should handle generic streaming error', async () => {
      const error = { message: 'Generic error' };

      await expect(handleOllamaError(error, mockGetAvailableModels, true))
        .rejects.toThrow(`${ERROR_MESSAGES.OLLAMA_UNAVAILABLE}: Generic error`);
    });
  });

  describe('getModelPreferenceOrder', () => {
    test('should include default model first', () => {
      const result = getModelPreferenceOrder('custom-model');
      expect(result[0]).toBe('custom-model');
    });

    test('should include standard models', () => {
      const result = getModelPreferenceOrder('llama3.2');
      expect(result).toContain('llama3.2');
      expect(result).toContain('llama3.1');
      expect(result).toContain('llama3');
      expect(result).toContain('mistral');
    });

    test('should return array with proper length', () => {
      const result = getModelPreferenceOrder('test');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(5);
    });
  });
});