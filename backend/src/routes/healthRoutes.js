/**
 * Health check routes for monitoring service status
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ollamaService = require('../services/ollamaService');
const logger = require('../utils/logger');

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

    // Check Ollama connection
    const ollamaStatus = await ollamaService.checkOllamaHealth();

    // Get available models if Ollama is connected
    let availableModels = [];
    if (ollamaStatus === 'connected') {
      try {
        const models = await ollamaService.getAvailableModels();
        availableModels = models.map(model => model.name);
      } catch (error) {
        logger.warn('Failed to get models for health check', 'HEALTH_ROUTES', error);
      }
    }

    res.json({
      status: 'ok',
      database: dbStatus,
      ollama: ollamaStatus,
      availableModels: availableModels,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check error', 'HEALTH_ROUTES', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ollama-specific health check endpoint
router.get('/health/ollama', async (req, res) => {
  try {
    const ollamaStatus = await ollamaService.checkOllamaHealth();

    if (ollamaStatus === 'connected') {
      const models = await ollamaService.getAvailableModels();
      res.json({
        success: true,
        data: {
          status: 'connected',
          models: models.map(model => model.name)
        }
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Ollama service unavailable'
      });
    }
  } catch (error) {
    logger.error('Ollama health check error', 'HEALTH_ROUTES', error);
    res.status(503).json({
      success: false,
      error: 'Ollama service unavailable'
    });
  }
});

module.exports = router;