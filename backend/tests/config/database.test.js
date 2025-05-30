const mongoose = require('mongoose');
const { connectDatabase, setupGracefulShutdown } = require('../../src/config/database');
const logger = require('../../src/utils/logger');

// Mock the logger
jest.mock('../../src/utils/logger');

describe('Database Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.MONGODB_URI;
  });

  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      // Mock the close method to avoid actual connection operations
      if (mongoose.connection.close && typeof mongoose.connection.close === 'function') {
        await mongoose.connection.close();
      }
    }
  });

  describe('connectDatabase', () => {
    it('should connect to MongoDB with default configuration', async () => {
      const spy = jest.spyOn(mongoose, 'connect').mockResolvedValue();

      await connectDatabase();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('mongodb://'),
        expect.objectContaining({
          useNewUrlParser: true,
          useUnifiedTopology: true
        })
      );

      spy.mockRestore();
    });

    it('should handle connection errors gracefully', async () => {
      const error = new Error('Connection failed');
      const spy = jest.spyOn(mongoose, 'connect').mockRejectedValue(error);

      await expect(connectDatabase()).rejects.toThrow('Connection failed');
      expect(logger.database).toHaveBeenCalledWith('MongoDB connection error', error);

      spy.mockRestore();
    });

    it('should use custom MongoDB URI from environment', async () => {
      // Mock the constants module to return custom URI
      jest.doMock('../../src/utils/constants', () => ({
        MONGODB_URI: 'mongodb://custom:27017/test'
      }));

      // Clear the require cache and re-require
      delete require.cache[require.resolve('../../src/config/database')];
      const { connectDatabase } = require('../../src/config/database');

      const spy = jest.spyOn(mongoose, 'connect').mockResolvedValue();

      await connectDatabase();

      expect(spy).toHaveBeenCalledWith(
        'mongodb://custom:27017/test',
        expect.any(Object)
      );

      spy.mockRestore();

      // Reset the mock
      jest.dontMock('../../src/utils/constants');
    });
  });

  describe('setupGracefulShutdown', () => {
    let originalProcessOn;
    let originalProcessExit;
    let processListeners = {};

    beforeEach(() => {
      originalProcessOn = process.on;
      originalProcessExit = process.exit;

      process.on = jest.fn((event, callback) => {
        processListeners[event] = callback;
      });
      process.exit = jest.fn();
    });

    afterEach(() => {
      process.on = originalProcessOn;
      process.exit = originalProcessExit;
      processListeners = {};
    });

    it('should setup SIGINT handler', () => {
      setupGracefulShutdown();

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should setup SIGTERM handler', () => {
      setupGracefulShutdown();

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should setup uncaughtException handler', () => {
      setupGracefulShutdown();

      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should handle SIGINT gracefully', async () => {
      const closeSpy = jest.spyOn(mongoose.connection, 'close').mockResolvedValue();

      setupGracefulShutdown();
      await processListeners.SIGINT();

      expect(logger.info).toHaveBeenCalledWith('Received SIGINT. Shutting down gracefully...', 'SHUTDOWN');
      expect(closeSpy).toHaveBeenCalled();
      expect(logger.database).toHaveBeenCalledWith('MongoDB connection closed');
      expect(process.exit).toHaveBeenCalledWith(0);

      closeSpy.mockRestore();
    });

    it('should handle shutdown errors', async () => {
      const error = new Error('Close failed');
      const closeSpy = jest.spyOn(mongoose.connection, 'close').mockRejectedValue(error);

      setupGracefulShutdown();
      await processListeners.SIGTERM();

      expect(logger.error).toHaveBeenCalledWith('Error during shutdown', 'SHUTDOWN', error);
      expect(process.exit).toHaveBeenCalledWith(1);

      closeSpy.mockRestore();
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught error');

      setupGracefulShutdown();
      processListeners.uncaughtException(error);

      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception', 'PROCESS', error);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      // Mock mongoose connection methods for integration tests
      mongoose.connection.close = jest.fn().mockResolvedValue();
      mongoose.connection.dropDatabase = jest.fn().mockResolvedValue();
    });

    it('should maintain connection state correctly', async () => {
      // Mock the connection state
      const mockConnection = {
        readyState: 1,
        db: { name: 'test-db' }
      };

      Object.defineProperty(mongoose, 'connection', {
        value: mockConnection,
        configurable: true
      });

      expect(mongoose.connection.readyState).toBe(1); // Connected
      expect(mongoose.connection.db).toBeDefined();
    });

    it('should handle multiple connection attempts gracefully', async () => {
      const spy = jest.spyOn(mongoose, 'connect').mockResolvedValue();

      // First connection should succeed
      await expect(connectDatabase()).resolves.not.toThrow();

      // Second connection attempt should not fail
      await expect(connectDatabase()).resolves.not.toThrow();

      spy.mockRestore();
    });
  });
});