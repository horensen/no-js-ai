const logger = require('../../src/utils/logger');

describe('Logger Utils', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('info logging', () => {
    test('should log info messages', () => {
      logger.info('Test info message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('INFO');
      expect(logCall).toContain('Test info message');
    });

    test('should include timestamp in log', () => {
      logger.info('Test message');

      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });

  describe('error logging', () => {
    test('should log error messages', () => {
      logger.error('Test error message');

      expect(consoleSpy.error).toHaveBeenCalled();
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('ERROR');
      expect(logCall).toContain('Test error message');
    });

    test('should handle error objects', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', 'CONTEXT', error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('ERROR');
      expect(logCall).toContain('Error occurred');
    });
  });

  describe('warn logging', () => {
    test('should log warning messages', () => {
      logger.warn('Test warning message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('WARN');
      expect(logCall).toContain('Test warning message');
    });
  });

  describe('debug logging', () => {
    test('should respect log level for debug messages', () => {
      // Default log level is INFO, so debug should not be logged
      logger.debug('Test debug message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('context-specific logging', () => {
    test('should log database messages', () => {
      logger.database('Database message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[DATABASE]');
      expect(logCall).toContain('Database message');
    });

    test('should log api messages', () => {
      logger.api('API message', 'GET', '/test');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[API:GET:/test]');
      expect(logCall).toContain('API message');
    });

    test('should log security messages', () => {
      logger.security('Security message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[SECURITY]');
      expect(logCall).toContain('Security message');
    });

    test('should log streaming messages', () => {
      logger.streaming('Streaming message', 'session123');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[STREAMING:session123]');
      expect(logCall).toContain('Streaming message');
    });

    test('should log ollama messages', () => {
      logger.ollama('Ollama message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[OLLAMA]');
      expect(logCall).toContain('Ollama message');
    });

    test('should log ollama errors', () => {
      const error = new Error('Ollama error');
      logger.ollama('Ollama error message', error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('[OLLAMA]');
      expect(logCall).toContain('Ollama error message');
    });
  });
});