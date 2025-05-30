/**
 * Main server file for No-JS AI Chat application
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import configurations and middleware
const { connectDatabase, setupGracefulShutdown } = require('./config/database');
const {
  chatRateLimitMiddleware,
  inputValidationMiddleware,
  commonSecurityHeaders
} = require('./middleware/security');

// Import routes
const chatRoutes = require('./routes/index');
const healthRoutes = require('./routes/healthRoutes');

// Import utilities
const { PORT, NODE_ENV, PATHS } = require('./utils/constants');
const logger = require('./utils/logger');

/**
 * Configure Express application middleware
 * @param {express.Application} app - Express application instance
 */
function configureMiddleware(app) {
  // Standard middleware
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Frontend static files and views
  app.use(express.static(path.join(__dirname, PATHS.PUBLIC)));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, PATHS.VIEWS));

  // Disable template caching in development
  if (NODE_ENV !== 'production') {
    app.set('view cache', false);
  }
}

/**
 * Configure route-specific middleware
 * @param {express.Application} app - Express application instance
 */
function configureRouteMiddleware(app) {
  // Input validation for chat messages
  app.use(['/chat'], inputValidationMiddleware);

  // Rate limiting for chat functionality
  app.use('/chat', chatRateLimitMiddleware);
}

/**
 * Configure application routes
 * @param {express.Application} app - Express application instance
 */
function configureRoutes(app) {
  // Main application routes
  app.use('/', chatRoutes);
  app.use('/', healthRoutes);

  // Common security headers for all responses
  app.use(commonSecurityHeaders);
}

/**
 * Configure error handling middleware
 * @param {express.Application} app - Express application instance
 */
function configureErrorHandling(app) {
  // 404 handler
  app.use((req, res) => {
    logger.warn(`404 - Page not found: ${req.method} ${req.url}`, 'SERVER');
    res.status(404).render('error', {
      error: 'Page not found'
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', 'SERVER', err);

    // Don't expose error details in production
    const errorMessage = NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;

    res.status(err.status || 500).render('error', {
      error: errorMessage
    });
  });
}

/**
 * Create and configure Express application
 * @returns {express.Application} Configured Express app
 */
function createApp() {
  const app = express();

  // Configure middleware in order
  configureMiddleware(app);
  configureRouteMiddleware(app);
  configureRoutes(app);
  configureErrorHandling(app);

  return app;
}

/**
 * Start the server with proper error handling
 */
async function startServer() {
  try {
    // Connect to database first
    await connectDatabase();
    logger.info('Database connection established', 'SERVER');

    // Setup graceful shutdown handlers
    setupGracefulShutdown();

    // Create and configure app
    const app = createApp();

    // Start listening
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`, 'SERVER');
      logger.info(`🌐 Visit http://localhost:${PORT} to access the application`, 'SERVER');
      logger.info(`🔒 Security features: Enhanced CSP, Rate limiting, Input validation`, 'SERVER');
      logger.info(`⚡ Streaming: Real-time token streaming available`, 'SERVER');
      logger.info(`📊 Environment: ${NODE_ENV}`, 'SERVER');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${PORT} requires elevated privileges`, 'SERVER');
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`, 'SERVER');
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', 'SERVER', error);
    process.exit(1);
  }
}

// Start the application only if this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing purposes
module.exports = { createApp, startServer };