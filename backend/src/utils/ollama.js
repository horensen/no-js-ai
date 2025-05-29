/**
 * Ollama utility functions for API interactions
 */

const { MODEL_PREFERENCES, STREAMING_CONFIG, ERROR_MESSAGES } = require('./constants');
const logger = require('./logger');

/**
 * Format conversation history for Ollama prompt
 * @param {string|Array} messageOrHistory - Single message or conversation history
 * @returns {string} - Formatted prompt for Ollama
 */
function formatConversationPrompt(messageOrHistory) {
  // If it's a string, return as-is
  if (typeof messageOrHistory === 'string') {
    return messageOrHistory;
  }

  // If it's an array (conversation history), format it
  if (Array.isArray(messageOrHistory)) {
    if (messageOrHistory.length === 0) {
      return '';
    }

    return messageOrHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n') + '\n\nAssistant:';
  }

  return String(messageOrHistory);
}

/**
 * Create Ollama API request configuration
 * @param {string} model - Model name
 * @param {string} prompt - Formatted prompt
 * @param {boolean} streaming - Whether to use streaming
 * @returns {object} - Axios configuration object
 */
function getOllamaRequestConfig(model, prompt, streaming = false) {
  const config = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: streaming ? STREAMING_CONFIG.TIMEOUT : 30000,
    data: {
      model: model,
      prompt: prompt,
      stream: streaming,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 2000
      }
    }
  };

  if (streaming) {
    config.responseType = 'stream';
  }

  return config;
}

/**
 * Handle Ollama API errors with appropriate error messages
 * @param {Error} error - Original error
 * @param {Function} getAvailableModels - Function to get available models
 * @param {boolean} isStreaming - Whether this is for streaming
 * @throws {Error} - Formatted error message
 */
async function handleOllamaError(error, getAvailableModels, isStreaming = false) {
  const context = isStreaming ? 'STREAMING' : 'API';
  logger.ollama(`${context} Error: ${error.message}`, error);

  if (error.code === 'ECONNREFUSED') {
    throw new Error('Cannot connect to Ollama. Please ensure Ollama is running on localhost:11434');
  }

  if (error.response && error.response.status === 404) {
    // Model not found - suggest available models
    try {
      const models = await getAvailableModels();
      if (models && models.length > 0) {
        const modelNames = models.map(m => m.name).join(', ');
        throw new Error(`Model not found. Available models: ${modelNames}`);
      } else {
        throw new Error('Model not found and no models are available. Please pull a model first (e.g., ollama pull llama3.2)');
      }
    } catch (modelError) {
      // Only catch if getAvailableModels itself failed, not if we're throwing our specific error
      if (modelError.message.includes('Model not found')) {
        throw modelError; // Re-throw our specific model error
      }
      throw new Error('Model not found and could not fetch available models.');
    }
  }

  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    throw new Error(`Request timeout. The ${isStreaming ? 'streaming ' : ''}request took too long to complete.`);
  }

  // Generic error
  throw new Error(`${ERROR_MESSAGES.OLLAMA_UNAVAILABLE}: ${error.message}`);
}

/**
 * Get model preference order based on default model
 * @param {string} defaultModel - Default model from config
 * @returns {Array} - Array of preferred model names
 */
function getModelPreferenceOrder(defaultModel) {
  const preferences = [...MODEL_PREFERENCES];

  // Move default model to front if it's not already there
  if (defaultModel && !preferences.includes(defaultModel)) {
    preferences.unshift(defaultModel);
  } else if (defaultModel && preferences.includes(defaultModel)) {
    // Remove from current position and add to front
    const index = preferences.indexOf(defaultModel);
    preferences.splice(index, 1);
    preferences.unshift(defaultModel);
  }

  return preferences;
}

module.exports = {
  formatConversationPrompt,
  getOllamaRequestConfig,
  handleOllamaError,
  getModelPreferenceOrder
};