const {
  connectDatabase,
  getDatabaseStatus,
  closeDatabaseConnection,
  setupGracefulShutdown
} = require('../../src/config/database');

// Mock dependencies
jest.mock('mongoose');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/constants', () => ({
  MONGODB_URI: 'mongodb://localhost:27017/test'
}));

const mongoose = require('mongoose');
const logger = require('../../src/utils/logger');

describe('Database Config', () => {
  let originalProcessOn;
  let originalProcessExit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process methods
    originalProcessOn = process.on;
    originalProcessExit = process.exit;
    process.on = jest.fn();
    process.exit = jest.fn();

    // Setup mongoose mock
    mongoose.connect = jest.fn();
    mongoose.connection = {
      close: jest.fn(),
      readyState: 1
    };
  });

  afterEach(() => {
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  describe('connectDatabase', () => {
    test('should connect to MongoDB successfully', async () => {
      mongoose.connect.mockResolvedValue();

      await connectDatabase();

      expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      expect(logger.database).toHaveBeenCalledWith('Connected to MongoDB');
    });

    test('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mongoose.connect.mockRejectedValue(error);

      await expect(connectDatabase()).rejects.toThrow('Connection failed');
      expect(logger.database).toHaveBeenCalledWith('MongoDB connection error', error);
    });
  });

  describe('getDatabaseStatus', () => {
    test('should return connected when readyState is 1', () => {
      mongoose.connection.readyState = 1;
      expect(getDatabaseStatus()).toBe('connected');
    });

    test('should return disconnected when readyState is 0', () => {
      mongoose.connection.readyState = 0;
      expect(getDatabaseStatus()).toBe('disconnected');
    });

    test('should return connecting when readyState is 2', () => {
      mongoose.connection.readyState = 2;
      expect(getDatabaseStatus()).toBe('connecting');
    });

    test('should return disconnecting when readyState is 3', () => {
      mongoose.connection.readyState = 3;
      expect(getDatabaseStatus()).toBe('disconnecting');
    });

    test('should return unknown for invalid readyState', () => {
      mongoose.connection.readyState = 99;
      expect(getDatabaseStatus()).toBe('unknown');
    });
  });

  describe('closeDatabaseConnection', () => {
    test('should close database connection successfully', async () => {
      mongoose.connection.close.mockResolvedValue();

      await closeDatabaseConnection();

      expect(mongoose.connection.close).toHaveBeenCalled();
      expect(logger.database).toHaveBeenCalledWith('Database connection closed');
    });

    test('should handle close errors', async () => {
      const error = new Error('Close failed');
      mongoose.connection.close.mockRejectedValue(error);

      await expect(closeDatabaseConnection()).rejects.toThrow('Close failed');
      expect(logger.database).toHaveBeenCalledWith('Error closing database connection', error);
    });
  });

  describe('setupGracefulShutdown', () => {
    test('should setup process event listeners', () => {
      setupGracefulShutdown();

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    test('should handle SIGINT signal gracefully', async () => {
      mongoose.connection.close.mockResolvedValue();

      setupGracefulShutdown();

      // Get the SIGINT handler and call it
      const sigintHandler = process.on.mock.calls.find(call => call[0] === 'SIGINT')[1];
      await sigintHandler();

      expect(logger.info).toHaveBeenCalledWith('Received SIGINT. Shutting down gracefully...', 'SHUTDOWN');
      expect(mongoose.connection.close).toHaveBeenCalled();
      expect(logger.database).toHaveBeenCalledWith('MongoDB connection closed');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('should handle SIGTERM signal gracefully', async () => {
      mongoose.connection.close.mockResolvedValue();

      setupGracefulShutdown();

      // Get the SIGTERM handler and call it
      const sigtermHandler = process.on.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      await sigtermHandler();

      expect(logger.info).toHaveBeenCalledWith('Received SIGTERM. Shutting down gracefully...', 'SHUTDOWN');
      expect(mongoose.connection.close).toHaveBeenCalled();
      expect(logger.database).toHaveBeenCalledWith('MongoDB connection closed');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('should handle shutdown errors', async () => {
      const error = new Error('Shutdown failed');
      mongoose.connection.close.mockRejectedValue(error);

      setupGracefulShutdown();

      // Get the SIGINT handler and call it
      const sigintHandler = process.on.mock.calls.find(call => call[0] === 'SIGINT')[1];
      await sigintHandler();

      expect(logger.error).toHaveBeenCalledWith('Error during shutdown', 'SHUTDOWN', error);
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should handle uncaught exceptions', () => {
      setupGracefulShutdown();

      // Get the uncaughtException handler and call it
      const exceptionHandler = process.on.mock.calls.find(call => call[0] === 'uncaughtException')[1];
      const error = new Error('Uncaught error');
      exceptionHandler(error);

      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception', 'PROCESS', error);
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should handle unhandled rejections', () => {
      setupGracefulShutdown();

      // Get the unhandledRejection handler and call it
      const rejectionHandler = process.on.mock.calls.find(call => call[0] === 'unhandledRejection')[1];
      const reason = 'Promise rejected';
      const promise = Promise.resolve();
      rejectionHandler(reason, promise);

      expect(logger.error).toHaveBeenCalledWith(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'PROCESS');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});