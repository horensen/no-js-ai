/**
 * Database configuration and connection management
 */

const mongoose = require('mongoose');
const { MONGODB_URI } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB database
 */
async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.database('Connected to MongoDB');
  } catch (error) {
    logger.database('MongoDB connection error', error);
    throw error;
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`, 'SHUTDOWN');

    try {
      await mongoose.connection.close();
      logger.database('MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', 'SHUTDOWN', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', 'PROCESS', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'PROCESS');
    process.exit(1);
  });
}

/**
 * Get database connection status
 * @returns {string} - Connection status
 */
function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return states[mongoose.connection.readyState] || 'unknown';
}

/**
 * Close database connection
 */
async function closeDatabaseConnection() {
  try {
    await mongoose.connection.close();
    logger.database('Database connection closed');
  } catch (error) {
    logger.database('Error closing database connection', error);
    throw error;
  }
}

module.exports = {
  connectDatabase,
  setupGracefulShutdown,
  getDatabaseStatus,
  closeDatabaseConnection
};