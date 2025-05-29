/**
 * Centralized logging utility
 * Provides consistent logging interface across the application
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'   // Reset
};

class Logger {
  constructor() {
    this.level = this.getLogLevel();
  }

  getLogLevel() {
    const envLevel = process.env.LOG_LEVEL || 'INFO';
    return LOG_LEVELS[envLevel.toUpperCase()] || LOG_LEVELS.INFO;
  }

  formatMessage(level, message, context, error) {
    const timestamp = new Date().toISOString();
    const color = LOG_COLORS[level];
    const reset = LOG_COLORS.RESET;

    let formatted = `${color}[${timestamp}] ${level}${reset}`;

    if (context) {
      formatted += ` [${context}]`;
    }

    formatted += `: ${message}`;

    if (error && error.stack) {
      formatted += `\n${error.stack}`;
    }

    return formatted;
  }

  log(level, message, context = null, error = null) {
    if (LOG_LEVELS[level] <= this.level) {
      const formatted = this.formatMessage(level, message, context, error);

      if (level === 'ERROR') {
        console.error(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  error(message, context = null, error = null) {
    this.log('ERROR', message, context, error);
  }

  warn(message, context = null) {
    this.log('WARN', message, context);
  }

  info(message, context = null) {
    this.log('INFO', message, context);
  }

  debug(message, context = null) {
    this.log('DEBUG', message, context);
  }

  // Specialized methods for common use cases
  database(message, error = null) {
    this.log(error ? 'ERROR' : 'INFO', message, 'DATABASE', error);
  }

  api(message, method = null, endpoint = null) {
    const context = method && endpoint ? `API:${method}:${endpoint}` : 'API';
    this.info(message, context);
  }

  security(message, level = 'WARN') {
    this.log(level, message, 'SECURITY');
  }

  streaming(message, sessionId = null) {
    const context = sessionId ? `STREAMING:${sessionId}` : 'STREAMING';
    this.info(message, context);
  }

  ollama(message, error = null) {
    this.log(error ? 'ERROR' : 'INFO', message, 'OLLAMA', error);
  }
}

// Export singleton instance
const logger = new Logger();

module.exports = logger;