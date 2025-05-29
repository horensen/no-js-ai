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
  streamingRateLimitMiddleware,
  inputValidationMiddleware,
  streamingSecurityMiddleware,
  commonSecurityHeaders
} = require('./middleware/security');

// Import routes
const chatRoutes = require('./routes/chatRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Import utilities
const { PORT, NODE_ENV, PATHS } = require('./utils/constants');
const logger = require('./utils/logger');

const app = express();

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

// Apply specific middleware to routes
// Input validation for chat messages
app.use(['/chat'], inputValidationMiddleware);

// Rate limiting for chat functionality
app.use('/chat', chatRateLimitMiddleware);

// Enhanced rate limiting and security for streaming
app.use('/stream', streamingRateLimitMiddleware);
app.use('/stream', streamingSecurityMiddleware);

// Routes
app.use('/', chatRoutes);
app.use('/', healthRoutes);

// Common security headers for all responses
app.use(commonSecurityHeaders);

// Error handling middleware
app.use((req, res) => {
  res.status(404).render('error', {
    error: 'Page not found'
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', 'SERVER', err);

  // Don't expose error details in production
  const errorMessage = NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  res.status(500).render('error', {
    error: errorMessage
  });
});

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Setup graceful shutdown
    setupGracefulShutdown();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`, 'SERVER');
      logger.info(`🌐 Visit http://localhost:${PORT} to access the application`, 'SERVER');
      logger.info(`🔒 Security features: Enhanced CSP, Rate limiting, Input validation`, 'SERVER');
      logger.info(`⚡ Streaming: Real-time token streaming available`, 'SERVER');
    });
  } catch (error) {
    logger.error('Failed to start server', 'SERVER', error);
    process.exit(1);
  }
};

// Start the application
startServer();