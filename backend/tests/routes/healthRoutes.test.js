const request = require('supertest');
const express = require('express');
const healthRoutes = require('../../src/routes/healthRoutes');

// Mock the ollama service
jest.mock('../../src/services/ollamaService', () => ({
  checkOllamaHealth: jest.fn(),
  getAvailableModels: jest.fn()
}));

// Mock mongoose
jest.mock('mongoose', () => ({
  connection: {
    readyState: 1
  }
}));

const ollamaService = require('../../src/services/ollamaService');

describe('Health Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', healthRoutes);
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    test('should return health status when Ollama is connected', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([
        { name: 'llama3.2:1b' },
        { name: 'llama3.2:3b' }
      ]);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.database).toBe('connected');
      expect(response.body.ollama).toBe('connected');
      expect(response.body.availableModels).toEqual(['llama3.2:1b', 'llama3.2:3b']);
    });

    test('should return health status when Ollama is disconnected', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('disconnected');

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.database).toBe('connected');
      expect(response.body.ollama).toBe('disconnected');
      expect(response.body.availableModels).toEqual([]);
    });

    test('should handle service check errors', async () => {
      ollamaService.checkOllamaHealth.mockRejectedValue(new Error('Service error'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /health/ollama', () => {
    test('should return Ollama-specific health status', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([
        { name: 'llama3.2:1b' },
        { name: 'llama3.2:3b' }
      ]);

      const response = await request(app).get('/health/ollama');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'connected',
          models: ['llama3.2:1b', 'llama3.2:3b']
        }
      });
    });

    test('should handle Ollama connection errors', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('disconnected');

      const response = await request(app).get('/health/ollama');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Ollama service unavailable');
    });
  });
});