/**
 * Ollama service for AI model interactions
 */

const axios = require('axios');
const {
  formatConversationPrompt,
  getOllamaRequestConfig,
  handleOllamaError,
  getModelPreferenceOrder
} = require('../utils/ollama');
const { OLLAMA_URL, DEFAULT_MODEL } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Get available models from Ollama
 * @returns {Promise<Array>} - Array of available models
 */
async function getAvailableModels() {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 10000 });
    return response.data.models || [];
  } catch (error) {
    logger.ollama('Failed to get available models', error);
    return [];
  }
}

/**
 * Find the best available model based on preferences
 * @returns {Promise<string>} - Best available model name
 */
async function findBestAvailableModel() {
  const models = await getAvailableModels();

  if (models.length === 0) {
    throw new Error('No models available in Ollama. Please pull a model first (e.g., ollama pull llama3.2)');
  }

  // Get priority list of preferred models
  const preferredModels = getModelPreferenceOrder(DEFAULT_MODEL);

  // Find the first available preferred model
  for (const preferredModel of preferredModels) {
    const availableModel = models.find(model =>
      model.name.toLowerCase().includes(preferredModel.toLowerCase())
    );
    if (availableModel) {
      logger.ollama(`Using model: ${availableModel.name}`);
      return availableModel.name;
    }
  }

  // If no preferred model found, use the first available one
  logger.ollama(`Using first available model: ${models[0].name}`);
  return models[0].name;
}

/**
 * Call Ollama API (non-streaming)
 * @param {string|Array} messageOrHistory - Message or conversation history
 * @param {string} model - Model name (optional)
 * @param {string} systemPrompt - System prompt for context (optional)
 * @returns {Promise<string>} - AI response
 */
async function callOllama(messageOrHistory, model = null, systemPrompt = '') {
  try {
    // If no model specified, find the best available one
    if (!model) {
      model = await findBestAvailableModel();
    }

    const prompt = formatConversationPrompt(messageOrHistory, systemPrompt);
    const config = getOllamaRequestConfig(model, prompt, false);

    const response = await axios(`${OLLAMA_URL}/api/generate`, config);
    return response.data.response;

  } catch (error) {
    await handleOllamaError(error, getAvailableModels, false);
  }
}

/**
 * Health check for Ollama service
 * @returns {Promise<string>} - Connection status
 */
async function checkOllamaHealth() {
  try {
    await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 10000 });
    return 'connected';
  } catch (error) {
    logger.ollama('Ollama health check failed', error);
    return 'disconnected';
  }
}

module.exports = {
  callOllama,
  checkOllamaHealth,
  getAvailableModels
};