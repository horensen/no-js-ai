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
  DEFAULT_MODEL: validateEnvVar('OLLAMA_MODEL', 'llama3.2:latest'),
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

// Rate limiting configuration with environment overrides
const RATE_LIMITS = {
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many API requests, please try again later.'
  },
  CHAT: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Stricter limit for chat messages
    message: 'Too many chat messages, please wait before sending another.'
  }
};

// Debug mode configuration
const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Error messages
const ERROR_MESSAGES = {
  MESSAGE_REQUIRED: 'Message is required',
  MESSAGE_TOO_LONG: 'Message is too long (max {maxLength} characters)',
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_FORMAT: 'Invalid format provided',
    TOO_LONG: 'Content is too long',
    EMPTY_MESSAGE: 'Message cannot be empty'
  },
  SESSION: {
    NOT_FOUND: 'Chat session not found',
    INVALID_ID: 'Invalid session ID format',
    CREATION_FAILED: 'Failed to create chat session'
  },
  AI: {
    CONNECTION_FAILED: 'Failed to connect to AI service',
    PROCESSING_ERROR: 'Error processing your request',
    TIMEOUT: 'Request timed out, please try again'
  },
  GENERAL: {
    INTERNAL_ERROR: 'An internal error occurred',
    RATE_LIMITED: 'Too many requests, please wait',
    UNAUTHORIZED: 'Unauthorized access'
  }
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

module.exports = {
  // Environment
  NODE_ENV,
  PORT,

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
  SESSION_ID_PATTERN: SESSION_CONFIG.ID_PATTERN, // Export the pattern for validation

  // Rate limiting
  RATE_LIMITS,

  // Security
  SUSPICIOUS_PATTERNS,

  // Paths
  PATHS,

  // Legacy constants for backwards compatibility
  MODEL_PREFERENCES,
  STREAMING_CONFIG,
  ERROR_MESSAGES,
  HTTP_STATUS,

  // Debug mode
  DEBUG_MODE,
};