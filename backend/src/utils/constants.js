/**
 * Application constants and configuration values
 */

// Environment validation helper
function validateEnvVar(name, defaultValue, validator = null) {
  const value = process.env[name] || defaultValue;

  if (validator && !validator(value)) {
    throw new Error(`Invalid environment variable ${name}: ${value}`);
  }

  return value;
}

// Number validation helper
function parsePositiveInt(value, defaultValue) {
  const parsed = parseInt(value);
  return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
}

// Boolean validation helper
function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return defaultValue;
}

// Environment settings with validation
const NODE_ENV = validateEnvVar('NODE_ENV', 'development',
  (val) => ['development', 'production', 'test'].includes(val)
);

const PORT = parsePositiveInt(process.env.PORT, 3000);

// Database configuration
const DATABASE_CONFIG = {
  MONGODB_URI: validateEnvVar('MONGODB_URI', 'mongodb://localhost:27017/no-js-ai-chat'),
  CONNECTION_TIMEOUT: parsePositiveInt(process.env.DB_CONNECTION_TIMEOUT, 10000),
  MAX_POOL_SIZE: parsePositiveInt(process.env.DB_MAX_POOL_SIZE, 10),
  MIN_POOL_SIZE: parsePositiveInt(process.env.DB_MIN_POOL_SIZE, 2)
};

// Ollama configuration
const OLLAMA_CONFIG = {
  URL: validateEnvVar('OLLAMA_URL', 'http://localhost:11434'),
  DEFAULT_MODEL: validateEnvVar('OLLAMA_MODEL', 'llama3.2'),
  REQUEST_TIMEOUT: parsePositiveInt(process.env.OLLAMA_TIMEOUT, 60000),
  STREAMING_TIMEOUT: parsePositiveInt(process.env.OLLAMA_STREAMING_TIMEOUT, 120000),
  MAX_RETRIES: parsePositiveInt(process.env.OLLAMA_MAX_RETRIES, 3)
};

// Legacy exports for backwards compatibility
const OLLAMA_URL = OLLAMA_CONFIG.URL;
const DEFAULT_MODEL = OLLAMA_CONFIG.DEFAULT_MODEL;

// Message validation
const MESSAGE_CONFIG = {
  MAX_LENGTH: parsePositiveInt(process.env.MAX_MESSAGE_LENGTH, 2000),
  MIN_LENGTH: parsePositiveInt(process.env.MIN_MESSAGE_LENGTH, 1),
  MAX_HISTORY_LENGTH: parsePositiveInt(process.env.MAX_HISTORY_LENGTH, 50)
};

// Legacy export for backwards compatibility
const MAX_MESSAGE_LENGTH = MESSAGE_CONFIG.MAX_LENGTH;

// Session validation
const SESSION_CONFIG = {
  MIN_ID_LENGTH: 10,
  MAX_ID_LENGTH: 50,
  ID_PATTERN: /^[a-zA-Z0-9]{10,50}$/,
  MAX_SESSIONS_PER_USER: parsePositiveInt(process.env.MAX_SESSIONS_PER_USER, 10),
  SESSION_TIMEOUT_HOURS: parsePositiveInt(process.env.SESSION_TIMEOUT_HOURS, 24),
  CLEANUP_INTERVAL_HOURS: parsePositiveInt(process.env.CLEANUP_INTERVAL_HOURS, 24)
};

// Legacy exports for backwards compatibility
const MIN_SESSION_ID_LENGTH = SESSION_CONFIG.MIN_ID_LENGTH;
const MAX_SESSION_ID_LENGTH = SESSION_CONFIG.MAX_ID_LENGTH;
const SESSION_ID_PATTERN = SESSION_CONFIG.ID_PATTERN;

// Rate limiting configuration with environment overrides
const RATE_LIMITS = {
  API: {
    windowMs: parsePositiveInt(process.env.API_RATE_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
    max: parsePositiveInt(process.env.API_RATE_MAX, 100), // requests per window
    message: 'Too many API requests'
  },
  CHAT: {
    windowMs: parsePositiveInt(process.env.CHAT_RATE_WINDOW_MS, 60 * 1000), // 1 minute
    max: parsePositiveInt(process.env.CHAT_RATE_MAX, 10), // messages per window
    message: 'Too many chat messages'
  },
  STREAMING: {
    windowMs: parsePositiveInt(process.env.STREAMING_RATE_WINDOW_MS, 5 * 60 * 1000), // 5 minutes
    max: parsePositiveInt(process.env.STREAMING_RATE_MAX, 5), // streams per window
    message: 'Too many streaming requests'
  }
};

// Security configuration
const SECURITY_CONFIG = {
  // Content Security Policy
  CSP_DIRECTIVES: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: NODE_ENV === 'development' ? ["'self'", "'unsafe-eval'"] : ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  },

  // HTTPS enforcement
  FORCE_HTTPS: parseBoolean(process.env.FORCE_HTTPS, NODE_ENV === 'production'),

  // Session security
  SECURE_COOKIES: parseBoolean(process.env.SECURE_COOKIES, NODE_ENV === 'production'),

  // CORS settings
  CORS_ORIGIN: process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? false : '*')
};

// Security patterns for input validation
const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /vbscript:/i,
  /onload=/i,
  /onerror=/i,
  /onclick=/i,
  /eval\(/i,
  /expression\(/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /document\.cookie/i,
  /window\.location/i
];

// File paths configuration
const PATHS = {
  PUBLIC: process.env.PUBLIC_PATH || '../../frontend/public',
  VIEWS: process.env.VIEWS_PATH || '../../frontend/views',
  LOGS: process.env.LOGS_PATH || './logs',
  UPLOADS: process.env.UPLOADS_PATH || './uploads'
};

// Logging configuration
const LOGGING_CONFIG = {
  LEVEL: validateEnvVar('LOG_LEVEL', 'info',
    (val) => ['error', 'warn', 'info', 'debug'].includes(val)
  ),
  FORMAT: validateEnvVar('LOG_FORMAT', 'json',
    (val) => ['json', 'simple', 'detailed'].includes(val)
  ),
  MAX_FILE_SIZE: parsePositiveInt(process.env.LOG_MAX_FILE_SIZE, 10 * 1024 * 1024), // 10MB
  MAX_FILES: parsePositiveInt(process.env.LOG_MAX_FILES, 5),
  ENABLE_CONSOLE: parseBoolean(process.env.LOG_ENABLE_CONSOLE, NODE_ENV !== 'production'),
  ENABLE_FILE: parseBoolean(process.env.LOG_ENABLE_FILE, true)
};

// Performance monitoring
const PERFORMANCE_CONFIG = {
  ENABLE_METRICS: parseBoolean(process.env.ENABLE_METRICS, false),
  METRICS_INTERVAL: parsePositiveInt(process.env.METRICS_INTERVAL, 60000), // 1 minute
  SLOW_QUERY_THRESHOLD: parsePositiveInt(process.env.SLOW_QUERY_THRESHOLD, 1000), // 1 second
  MEMORY_USAGE_THRESHOLD: parsePositiveInt(process.env.MEMORY_USAGE_THRESHOLD, 500 * 1024 * 1024) // 500MB
};

// Model preferences (in order of preference) - Legacy support
const MODEL_PREFERENCES = [
  'llama3.2',
  'llama3.1',
  'llama3',
  'mistral',
  'codellama',
  'phi3'
];

// Streaming configuration - Legacy support
const STREAMING_CONFIG = {
  THINKING_DELAY: parsePositiveInt(process.env.THINKING_DELAY, 1500),
  TIMEOUT: parsePositiveInt(process.env.STREAMING_TIMEOUT, 2 * 60 * 1000), // 2 minutes
  ENABLED: parseBoolean(process.env.STREAMING_ENABLED, true)
};

// Error messages - Legacy support
const ERROR_MESSAGES = {
  SESSION_INVALID: 'Invalid session format.',
  MESSAGE_REQUIRED: 'Message is required',
  MESSAGE_TOO_LONG: 'Message too long. Please keep it under {maxLength} characters.',
  MESSAGE_UNSAFE: 'Message contains potentially unsafe content.',
  DATABASE_ERROR: 'Database operation failed',
  OLLAMA_UNAVAILABLE: 'AI service is currently unavailable',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  UNAUTHORIZED_REQUEST: 'Request must originate from this application.'
};

// HTTP status codes - Legacy support
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

// Validation functions
const VALIDATORS = {
  isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  isValidSessionId: (id) => typeof id === 'string' && SESSION_CONFIG.ID_PATTERN.test(id),
  isValidMessageLength: (content) =>
    typeof content === 'string' &&
    content.length >= MESSAGE_CONFIG.MIN_LENGTH &&
    content.length <= MESSAGE_CONFIG.MAX_LENGTH
};

// Environment info for debugging
const ENV_INFO = {
  NODE_ENV,
  PORT,
  TIMESTAMP: new Date().toISOString(),
  NODE_VERSION: process.version,
  PLATFORM: process.platform,
  ARCH: process.arch
};

module.exports = {
  // Environment
  NODE_ENV,
  PORT,
  ENV_INFO,

  // Database
  DATABASE_CONFIG,
  MONGODB_URI: DATABASE_CONFIG.MONGODB_URI, // Legacy

  // Ollama
  OLLAMA_CONFIG,
  OLLAMA_URL, // Legacy
  DEFAULT_MODEL, // Legacy

  // Messages
  MESSAGE_CONFIG,
  MAX_MESSAGE_LENGTH, // Legacy

  // Sessions
  SESSION_CONFIG,
  MIN_SESSION_ID_LENGTH, // Legacy
  MAX_SESSION_ID_LENGTH, // Legacy
  SESSION_ID_PATTERN, // Legacy

  // Rate limiting
  RATE_LIMITS,

  // Security
  SECURITY_CONFIG,
  SUSPICIOUS_PATTERNS,

  // Paths
  PATHS,

  // Logging
  LOGGING_CONFIG,

  // Performance
  PERFORMANCE_CONFIG,

  // Legacy constants for backwards compatibility
  MODEL_PREFERENCES,
  STREAMING_CONFIG,
  ERROR_MESSAGES,
  HTTP_STATUS,

  // Validators
  VALIDATORS
};