const axios = require('axios');
const ollamaService = require('../../src/services/ollamaService');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock the utility functions
jest.mock('../../src/utils/ollama', () => ({
  formatConversationPrompt: jest.fn((message) => `Formatted: ${message}`),
  getOllamaRequestConfig: jest.fn((model, prompt, streaming) => ({
    method: 'POST',
    data: { model, prompt, stream: streaming },
    timeout: 60000
  })),
  handleOllamaError: jest.fn(),
  getModelPreferenceOrder: jest.fn(() => ['llama3.2', 'llama3.1', 'mistral'])
}));

describe('Ollama Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any environment variables
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
  });

  describe('checkOllamaHealth', () => {
    it('should return "connected" when Ollama is available', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { models: [] }
      });

      const result = await ollamaService.checkOllamaHealth();

      expect(result).toBe('connected');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        { timeout: 10000 }
      );
    });

    it('should return "disconnected" when Ollama is not available', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await ollamaService.checkOllamaHealth();

      expect(result).toBe('disconnected');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const result = await ollamaService.checkOllamaHealth();

      expect(result).toBe('disconnected');
    });

    it('should use correct timeout configuration', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: { models: [] } });

      await ollamaService.checkOllamaHealth();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        { timeout: 10000 }
      );
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', async () => {
      const mockModels = [
        { name: 'llama3.2:latest' },
        { name: 'mistral:latest' },
        { name: 'codellama:latest' }
      ];

      mockedAxios.get.mockResolvedValue({
        data: {
          models: mockModels
        }
      });

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual(mockModels);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        { timeout: 10000 }
      );
    });

    it('should return empty array when no models available', async () => {
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
    });

    it('should return empty array when models property is missing', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      const result = await ollamaService.getAvailableModels();

      expect(result).toEqual([]);
    });
  });

  describe('callOllama', () => {
    const mockResponse = {
      data: {
        response: 'Hello! How can I help you today?'
      }
    };

    beforeEach(() => {
      // Mock the getAvailableModels call for model selection
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            { name: 'llama3.2:latest' },
            { name: 'mistral:latest' }
          ]
        }
      });
    });

    it('should send message and return response', async () => {
      mockedAxios.mockResolvedValue(mockResponse);

      const result = await ollamaService.callOllama('Hello, how are you?');

      expect(result).toBe('Hello! How can I help you today?');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            model: expect.any(String),
            prompt: expect.stringContaining('Hello, how are you?'),
            stream: false
          })
        })
      );
    });

    it('should handle message arrays (conversation history)', async () => {
      mockedAxios.mockResolvedValue(mockResponse);

      const history = [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' }
      ];

      const result = await ollamaService.callOllama(history);

      expect(result).toBe('Hello! How can I help you today?');
      expect(mockedAxios).toHaveBeenCalled();
    });

    it('should use specified model when provided', async () => {
      mockedAxios.mockResolvedValue(mockResponse);

      await ollamaService.callOllama('Test message', 'custom-model');

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'custom-model'
          })
        })
      );
    });

    it('should include system prompt when provided', async () => {
      mockedAxios.mockResolvedValue(mockResponse);

      await ollamaService.callOllama('User message', null, 'You are a helpful assistant');

      expect(mockedAxios).toHaveBeenCalled();
      // The system prompt is handled by formatConversationPrompt utility
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockedAxios.mockRejectedValue(connectionError);

      // The function should handle the error through handleOllamaError utility
      await ollamaService.callOllama('Test');

      // Verify that the error handling utility was called
      const { handleOllamaError } = require('../../src/utils/ollama');
      expect(handleOllamaError).toHaveBeenCalledWith(
        connectionError,
        expect.any(Function),
        false
      );
    });

    it('should automatically select best available model when none specified', async () => {
      mockedAxios.mockResolvedValue(mockResponse);

      await ollamaService.callOllama('Test message');

      // Should call getAvailableModels to find the best model
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        { timeout: 10000 }
      );
    });

    it('should handle empty response gracefully', async () => {
      mockedAxios.mockResolvedValue({ data: { response: '' } });

      const result = await ollamaService.callOllama('Test message');

      expect(result).toBe('');
    });

    it('should handle malformed response', async () => {
      mockedAxios.mockResolvedValue({ data: {} });

      const result = await ollamaService.callOllama('Test message');

      expect(result).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle the complete flow: health check -> get models -> call ollama', async () => {
      // Mock health check
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [{ name: 'llama3.2:latest' }]
        }
      });

      // Mock ollama call
      mockedAxios.mockResolvedValue({
        data: { response: 'Test response' }
      });

      // Check health
      const health = await ollamaService.checkOllamaHealth();
      expect(health).toBe('connected');

      // Get models
      const models = await ollamaService.getAvailableModels();
      expect(models).toHaveLength(1);

      // Call ollama
      const response = await ollamaService.callOllama('Test message');
      expect(response).toBe('Test response');
    });

    it('should handle service unavailable scenario', async () => {
      const serviceError = new Error('Service unavailable');
      mockedAxios.get.mockRejectedValue(serviceError);
      mockedAxios.mockRejectedValue(serviceError);

      const health = await ollamaService.checkOllamaHealth();
      expect(health).toBe('disconnected');

      const models = await ollamaService.getAvailableModels();
      expect(models).toEqual([]);

      // Call ollama should handle error through utility
      await ollamaService.callOllama('Test message');
      const { handleOllamaError } = require('../../src/utils/ollama');
      expect(handleOllamaError).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts consistently', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ECONNABORTED';

      mockedAxios.get.mockRejectedValue(timeoutError);
      mockedAxios.mockRejectedValue(timeoutError);

      const health = await ollamaService.checkOllamaHealth();
      expect(health).toBe('disconnected');

      const models = await ollamaService.getAvailableModels();
      expect(models).toEqual([]);
    });

    it('should handle HTTP error responses', async () => {
      const httpError = new Error('Request failed');
      httpError.response = {
        status: 500,
        data: 'Internal Server Error'
      };

      mockedAxios.get.mockRejectedValue(httpError);
      mockedAxios.mockRejectedValue(httpError);

      const health = await ollamaService.checkOllamaHealth();
      expect(health).toBe('disconnected');

      const models = await ollamaService.getAvailableModels();
      expect(models).toEqual([]);
    });

    it('should not throw unhandled exceptions', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Unexpected error'));
      mockedAxios.mockRejectedValue(new Error('Unexpected error'));

      // These should not throw
      await expect(ollamaService.checkOllamaHealth()).resolves.toBe('disconnected');
      await expect(ollamaService.getAvailableModels()).resolves.toEqual([]);
      await expect(ollamaService.callOllama('Test')).resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent health checks', async () => {
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });

      const promises = Array(10).fill().map(() =>
        ollamaService.checkOllamaHealth()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBe('connected');
      });
    });

    it('should handle multiple concurrent model requests', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { models: [{ name: 'test-model' }] }
      });

      const promises = Array(5).fill().map(() =>
        ollamaService.getAvailableModels()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual([{ name: 'test-model' }]);
      });
    });

    it('should respond quickly to health checks', async () => {
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });

      const startTime = Date.now();
      await ollamaService.checkOllamaHealth();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast with mocked axios
    });
  });
});