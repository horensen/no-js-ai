/**
 * Application constants and configuration values
 */

// Environment settings
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;

// Database configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/no-js-ai-chat';

// Ollama configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// Message validation
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH) || 2000;
const MIN_SESSION_ID_LENGTH = 10;
const MAX_SESSION_ID_LENGTH = 50;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9]{10,50}$/;

// Rate limiting configuration
const RATE_LIMITS = {
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    message: 'Too many API requests'
  },
  CHAT: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // messages per window
    message: 'Too many chat messages'
  },
  STREAMING: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // streams per window
    message: 'Too many streaming requests'
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
  /expression\(/i
];

// Model preferences (in order of preference)
const MODEL_PREFERENCES = [
  'llama3.2',
  'llama3.1',
  'llama3',
  'mistral',
  'codellama',
  'phi3'
];

// Streaming configuration
const STREAMING_CONFIG = {
  THINKING_DELAY: parseInt(process.env.THINKING_DELAY) || 1500,
  TIMEOUT: 2 * 60 * 1000, // 2 minutes
  ENABLED: process.env.STREAMING_ENABLED !== 'false'
};

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

// Error messages
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

// File paths
const PATHS = {
  VIEWS: '../../frontend/views',
  PUBLIC: '../../frontend/public'
};

module.exports = {
  NODE_ENV,
  PORT,
  MONGODB_URI,
  OLLAMA_URL,
  DEFAULT_MODEL,
  MAX_MESSAGE_LENGTH,
  MIN_SESSION_ID_LENGTH,
  MAX_SESSION_ID_LENGTH,
  SESSION_ID_PATTERN,
  RATE_LIMITS,
  SUSPICIOUS_PATTERNS,
  MODEL_PREFERENCES,
  STREAMING_CONFIG,
  HTTP_STATUS,
  ERROR_MESSAGES,
  PATHS
};