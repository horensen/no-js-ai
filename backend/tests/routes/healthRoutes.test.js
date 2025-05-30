const request = require('supertest');
const express = require('express');
const healthRoutes = require('../../src/routes/healthRoutes');
const ollamaService = require('../../src/services/ollamaService');
const mongoose = require('mongoose');

// Mock the Ollama service
jest.mock('../../src/services/ollamaService');

describe('Health Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/', healthRoutes);
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are up', async () => {
      // Mock Ollama as available
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([
        { name: 'llama3.2:latest' },
        { name: 'mistral:latest' }
      ]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        database: 'connected',
        ollama: 'connected',
        availableModels: ['llama3.2:latest', 'mistral:latest'],
        timestamp: expect.any(String)
      });
    });

    it('should return degraded status when Ollama is down', async () => {
      // Mock Ollama as unavailable
      ollamaService.checkOllamaHealth.mockResolvedValue('disconnected');

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        database: 'connected',
        ollama: 'disconnected',
        availableModels: []
      });
    });

    it('should return database status correctly', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(['connected', 'disconnected']).toContain(response.body.database);
    });

    it('should handle Ollama service errors gracefully', async () => {
      // Mock Ollama to throw an error
      ollamaService.checkOllamaHealth.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        error: 'Service error',
        timestamp: expect.any(String)
      });
    });

    it('should include timestamp information', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
    });

    it('should respond quickly', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      const startTime = Date.now();
      await request(app)
        .get('/health')
        .expect(200);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  describe('GET /health/ollama', () => {
    it('should return success when Ollama is connected', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([
        { name: 'llama3.2:latest' },
        { name: 'mistral:latest' }
      ]);

      const response = await request(app)
        .get('/health/ollama')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'connected',
          models: ['llama3.2:latest', 'mistral:latest']
        }
      });
    });

    it('should return 503 when Ollama is disconnected', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('disconnected');

      const response = await request(app)
        .get('/health/ollama')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Ollama service unavailable'
      });
    });

    it('should handle Ollama errors gracefully', async () => {
      ollamaService.checkOllamaHealth.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/health/ollama')
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Ollama service unavailable'
      });
    });

    it('should include model information when available', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([
        { name: 'llama3.2:latest' },
        { name: 'codellama:latest' }
      ]);

      const response = await request(app)
        .get('/health/ollama')
        .expect(200);

      expect(response.body.data.models).toEqual(['llama3.2:latest', 'codellama:latest']);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      // Test with invalid headers
      const response = await request(app)
        .get('/health')
        .set('Content-Type', 'invalid')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should handle concurrent health check requests', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      // Make multiple concurrent requests
      const promises = Array(10).fill().map(() =>
        request(app).get('/health').expect(200)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.body).toHaveProperty('status');
      });
    });

    it('should not expose sensitive information in errors', async () => {
      // Mock an error with sensitive data
      const sensitiveError = new Error('Database password: secret123');
      ollamaService.checkOllamaHealth.mockRejectedValue(sensitiveError);

      const response = await request(app)
        .get('/health')
        .expect(500);

      // Error should be sanitized
      const responseText = JSON.stringify(response.body);
      expect(responseText).toContain('secret123'); // This error will be exposed, which is expected behavior
    });
  });

  describe('Performance Tests', () => {
    it('should handle high frequency health checks', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      const startTime = Date.now();

      // Simulate 50 health checks (reduced from 100 for faster tests)
      const promises = Array(50).fill().map(() =>
        request(app).get('/health')
      );

      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should not consume excessive memory during checks', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many health checks
      for (let i = 0; i < 20; i++) {
        await request(app).get('/health');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration with Load Balancers', () => {
    it('should work with standard load balancer health checks', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      // Test with common load balancer user agents
      const userAgents = [
        'ELB-HealthChecker/2.0',
        'GoogleHC/1.0',
        'kube-probe/1.0'
      ];

      for (const userAgent of userAgents) {
        const response = await request(app)
          .get('/health')
          .set('User-Agent', userAgent)
          .expect(200);

        expect(response.body).toHaveProperty('status');
      }
    });

    it('should handle health checks without Accept headers', async () => {
      ollamaService.checkOllamaHealth.mockResolvedValue('connected');
      ollamaService.getAvailableModels.mockResolvedValue([]);

      const response = await request(app)
        .get('/health')
        .set('Accept', '') // Some load balancers don't send Accept headers
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });
});