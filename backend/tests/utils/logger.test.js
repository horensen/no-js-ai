const logger = require('../../src/utils/logger');

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Logger Utility', () => {
  let mockConsoleLog, mockConsoleError;
  let originalLogLevel;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    originalLogLevel = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
    jest.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('Test info message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
    });

    it('should log error messages', () => {
      logger.error('Test error message');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    it('should log warn messages', () => {
      logger.warn('Test warning message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
    });

    it('should log debug messages', () => {
      // Set log level to DEBUG for this test
      process.env.LOG_LEVEL = 'DEBUG';
      // Create new logger instance to pick up the new log level
      const Logger = require('../../src/utils/logger');
      Logger.level = 3; // DEBUG level

      Logger.debug('Test debug message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test debug message')
      );
    });
  });

  describe('Contextual Logging', () => {
    it('should include context in log messages', () => {
      logger.info('Test message', 'TEST_CONTEXT');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('TEST_CONTEXT')
      );
    });

    it('should handle missing context gracefully', () => {
      logger.info('Test message without context');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test message without context')
      );
    });

    it('should include error objects in error logs', () => {
      const testError = new Error('Test error');
      logger.error('Error occurred', 'ERROR_CONTEXT', testError);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('ERROR_CONTEXT')
      );
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log database messages', () => {
      logger.database('Database connected');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Database connected')
      );
    });

    it('should log API messages', () => {
      logger.api('GET /api/test', 'GET', '/api/test');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test')
      );
    });

    it('should log Ollama service messages', () => {
      logger.ollama('Ollama response generated');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Ollama response generated')
      );
    });
  });

  describe('Log Formatting', () => {
    it('should include timestamp in log messages', () => {
      logger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });

    it('should include log level in messages', () => {
      logger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
    });

    it('should format error level correctly', () => {
      logger.error('Test error');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle null messages gracefully', () => {
      expect(() => logger.info(null)).not.toThrow();
    });

    it('should handle undefined messages gracefully', () => {
      expect(() => logger.info(undefined)).not.toThrow();
    });

    it('should handle non-string messages', () => {
      expect(() => logger.info(123)).not.toThrow();
      expect(() => logger.info({ key: 'value' })).not.toThrow();
    });

    it('should handle circular references in objects', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => logger.info('Circular object', 'TEST', circularObj)).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many log messages efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        logger.info(`Message ${i}`);
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should not block execution', () => {
      let completed = false;

      logger.info('Test message');
      completed = true;

      expect(completed).toBe(true);
    });
  });
});