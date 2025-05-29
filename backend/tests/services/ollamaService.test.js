const ollamaService = require('../../src/services/ollamaService');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/utils/ollama');
jest.mock('../../src/utils/constants', () => ({
  OLLAMA_URL: 'http://localhost:11434',
  DEFAULT_MODEL: 'llama3.2'
}));
jest.mock('../../src/utils/logger');

const {
  formatConversationPrompt,
  getOllamaRequestConfig,
  handleOllamaError,
  getModelPreferenceOrder
} = require('../../src/utils/ollama');
const logger = require('../../src/utils/logger');

describe('Ollama Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    formatConversationPrompt.mockImplementation((input) => {
      if (typeof input === 'string') return input;
      return input.map(msg => `${msg.role}: ${msg.content}`).join('\n') + '\nAssistant:';
    });

    getOllamaRequestConfig.mockImplementation((model, prompt, streaming) => ({
      method: 'POST',
      data: {
        model,
        prompt,
        stream: streaming
      },
      timeout: streaming ? 120000 : 60000,
      responseType: streaming ? 'stream' : 'json'
    }));

    getModelPreferenceOrder.mockReturnValue(['llama3.2', 'llama3', 'mistral']);
    handleOllamaError.mockImplementation((error) => { throw error; });
  });

  describe('getAvailableModels', () => {
    test('should return models when API responds successfully', async () => {
      const mockModels = [
        { name: 'llama3.2:latest' },
        { name: 'mistral:latest' }
      ];

      axios.get.mockResolvedValue({
        data: { models: mockModels }
      });

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual(mockModels);
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { timeout: 10000 }
      );
    });

    test('should return empty array when API fails', async () => {
      axios.get.mockRejectedValue(new Error('Connection failed'));

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
      expect(logger.ollama).toHaveBeenCalledWith('Failed to get available models', expect.any(Error));
    });

    test('should return empty array when response has no models', async () => {
      axios.get.mockResolvedValue({ data: {} });

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
    });

    test('should handle response with null models', async () => {
      axios.get.mockResolvedValue({ data: { models: null } });

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
    });
  });

  describe('findBestAvailableModel', () => {
    test('should return preferred model when available', async () => {
      const mockModels = [
        { name: 'mistral:latest' },
        { name: 'llama3.2:latest' },
        { name: 'codellama:latest' }
      ];

      axios.get.mockResolvedValue({ data: { models: mockModels } });
      axios.mockResolvedValue({ data: { response: 'test response' } });

      await ollamaService.callOllama('test');

      expect(getOllamaRequestConfig).toHaveBeenCalledWith('llama3.2:latest', 'test', false);
      expect(logger.ollama).toHaveBeenCalledWith('Using model: llama3.2:latest');
    });

    test('should throw error when no models available', async () => {
      axios.get.mockResolvedValue({ data: { models: [] } });

      await expect(ollamaService.callOllama('test')).rejects.toThrow();
      expect(handleOllamaError).toHaveBeenCalled();
    });

    test('should use first available model when no preferred model found', async () => {
      const mockModels = [
        { name: 'unknown-model:latest' },
        { name: 'another-model:latest' }
      ];

      axios.get.mockResolvedValue({ data: { models: mockModels } });
      axios.mockResolvedValue({ data: { response: 'test response' } });

      await ollamaService.callOllama('test');

      expect(getOllamaRequestConfig).toHaveBeenCalledWith('unknown-model:latest', 'test', false);
      expect(logger.ollama).toHaveBeenCalledWith('Using first available model: unknown-model:latest');
    });
  });

  describe('checkOllamaHealth', () => {
    test('should return connected when API is reachable', async () => {
      axios.get.mockResolvedValue({ status: 200 });

      const result = await ollamaService.checkOllamaHealth();

      expect(result).toBe('connected');
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { timeout: 10000 }
      );
    });

    test('should return disconnected when API fails', async () => {
      axios.get.mockRejectedValue(new Error('Connection failed'));

      const result = await ollamaService.checkOllamaHealth();

      expect(result).toBe('disconnected');
      expect(logger.ollama).toHaveBeenCalledWith('Ollama health check failed', expect.any(Error));
    });

    test('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      axios.get.mockRejectedValue(timeoutError);

      const result = await ollamaService.checkOllamaHealth();

      expect(result).toBe('disconnected');
    });
  });

  describe('callOllama (non-streaming)', () => {
    beforeEach(() => {
      // Mock getAvailableModels for model selection
      axios.get.mockResolvedValue({
        data: { models: [{ name: 'llama3.2:latest' }] }
      });
    });

    test('should handle string message input', async () => {
      axios.mockResolvedValue({
        data: { response: 'AI response here' }
      });

      const result = await ollamaService.callOllama('Hello, world!', 'llama3.2:latest');

      expect(result).toBe('AI response here');
      expect(formatConversationPrompt).toHaveBeenCalledWith('Hello, world!');
      expect(getOllamaRequestConfig).toHaveBeenCalledWith('llama3.2:latest', 'Hello, world!', false);
    });

    test('should handle conversation history input', async () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      formatConversationPrompt.mockReturnValue('User: Hello\n\nAssistant: Hi there!\n\nAssistant:');
      axios.mockResolvedValue({
        data: { response: 'AI response to conversation' }
      });

      const result = await ollamaService.callOllama(history, 'llama3.2:latest');

      expect(result).toBe('AI response to conversation');
      expect(formatConversationPrompt).toHaveBeenCalledWith(history);
    });

    test('should auto-select model when not specified', async () => {
      axios.mockResolvedValue({
        data: { response: 'Response with auto-selected model' }
      });

      const result = await ollamaService.callOllama('test');

      expect(result).toBe('Response with auto-selected model');
      expect(getOllamaRequestConfig).toHaveBeenCalledWith('llama3.2:latest', 'test', false);
    });

    test('should handle API errors', async () => {
      const error = new Error('API Error');
      axios.mockRejectedValue(error);

      await expect(ollamaService.callOllama('test', 'llama3.2:latest')).rejects.toThrow();
      expect(handleOllamaError).toHaveBeenCalledWith(error, expect.any(Function), false);
    });

    test('should handle network timeout errors', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      axios.mockRejectedValue(timeoutError);

      await expect(ollamaService.callOllama('test', 'llama3.2:latest')).rejects.toThrow();
      expect(handleOllamaError).toHaveBeenCalledWith(timeoutError, expect.any(Function), false);
    });
  });

  describe('callOllamaStreaming', () => {
    beforeEach(() => {
      // Mock getAvailableModels for model selection
      axios.get.mockResolvedValue({
        data: { models: [{ name: 'llama3.2:latest' }] }
      });
    });

    test('should handle streaming response with tokens', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": "Hello"}\n'));
              callback(Buffer.from('{"response": " world"}\n'));
              callback(Buffer.from('{"done": true}\n'));
            }, 10);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 50);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const onTokenCallback = jest.fn();
      const result = await ollamaService.callOllamaStreaming('Hello', onTokenCallback, 'llama3.2:latest');

      expect(onTokenCallback).toHaveBeenCalledWith('Hello');
      expect(onTokenCallback).toHaveBeenCalledWith(' world');
      expect(result).toBe('Hello world');
      expect(getOllamaRequestConfig).toHaveBeenCalledWith('llama3.2:latest', 'Hello', true);
    });

    test('should handle streaming without onToken callback', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": "Response"}\n'));
              callback(Buffer.from('{"done": true}\n'));
            }, 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const result = await ollamaService.callOllamaStreaming('test', null, 'llama3.2:latest');

      expect(result).toBe('Response');
    });

    test('should handle malformed JSON chunks gracefully', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('malformed json\n'));
              callback(Buffer.from('{"response": "valid"}\n'));
              callback(Buffer.from('{"done": true}\n'));
            }, 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const result = await ollamaService.callOllamaStreaming('test', jest.fn(), 'llama3.2:latest');

      expect(result).toBe('valid');
    });

    test('should handle empty response chunks', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": ""}\n'));
              callback(Buffer.from('\n'));
              callback(Buffer.from('{"response": "content"}\n'));
              callback(Buffer.from('{"done": true}\n'));
            }, 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const onToken = jest.fn();
      const result = await ollamaService.callOllamaStreaming('test', onToken, 'llama3.2:latest');

      expect(result).toBe('content');
      expect(onToken).toHaveBeenCalledWith('content');
      expect(onToken).not.toHaveBeenCalledWith('');
    });

    test('should handle stream errors', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Stream error')), 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      await expect(ollamaService.callOllamaStreaming('test', jest.fn(), 'llama3.2:latest'))
        .rejects.toThrow('Stream error');
    });

    test('should handle stream end without done signal', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": "partial"}\n'));
            }, 10);
          }
          if (event === 'end') {
            setTimeout(() => callback(), 20);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const result = await ollamaService.callOllamaStreaming('test', jest.fn(), 'llama3.2:latest');

      expect(result).toBe('partial');
    });

    test('should auto-select model when not specified', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": "auto-model"}\n'));
              callback(Buffer.from('{"done": true}\n'));
            }, 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const result = await ollamaService.callOllamaStreaming('test', jest.fn());

      expect(result).toBe('auto-model');
      expect(getOllamaRequestConfig).toHaveBeenCalledWith('llama3.2:latest', 'test', true);
    });

    test('should handle streaming API errors', async () => {
      const error = new Error('Streaming API Error');
      axios.mockRejectedValue(error);

      await expect(ollamaService.callOllamaStreaming('test', jest.fn(), 'llama3.2:latest'))
        .rejects.toThrow();
      expect(handleOllamaError).toHaveBeenCalledWith(error, expect.any(Function), true);
    });

    test('should handle conversation history in streaming', async () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];

      formatConversationPrompt.mockReturnValue('User: Hello\n\nAssistant: Hi!\n\nAssistant:');

      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": "streaming response"}\n'));
              callback(Buffer.from('{"done": true}\n'));
            }, 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const result = await ollamaService.callOllamaStreaming(history, jest.fn(), 'llama3.2:latest');

      expect(result).toBe('streaming response');
      expect(formatConversationPrompt).toHaveBeenCalledWith(history);
    });

    test('should handle multiple response chunks in single data event', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback(Buffer.from('{"response": "chunk1"}\n{"response": "chunk2"}\n{"done": true}\n'));
            }, 10);
          }
        })
      };

      axios.mockResolvedValue({
        data: mockStream
      });

      const onToken = jest.fn();
      const result = await ollamaService.callOllamaStreaming('test', onToken, 'llama3.2:latest');

      expect(result).toBe('chunk1chunk2');
      expect(onToken).toHaveBeenCalledWith('chunk1');
      expect(onToken).toHaveBeenCalledWith('chunk2');
    });
  });
});