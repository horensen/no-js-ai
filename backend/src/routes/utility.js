const express = require('express');
const router = express.Router();
const ollamaService = require('../services/ollamaService');
const { asyncHandler } = require('../utils/response');

// Debug page for troubleshooting
router.get('/debug', (req, res) => {
  const theme = req.cookies.theme || 'light';
  res.render('debug', { theme });
});

// Get available Ollama models
router.get('/models', asyncHandler(async (req, res) => {
  try {
    const models = await ollamaService.getAvailableModels();
    const formattedModels = models.map(model => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at
    }));

    res.json({
      success: true,
      models: formattedModels,
      count: formattedModels.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available models',
      details: error.message
    });
  }
}));

// Theme toggle route
router.post('/toggle-theme', (req, res) => {
  const currentTheme = req.cookies.theme || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  const returnUrl = req.body.returnUrl || '/';

  // Set theme cookie for 1 year
  res.cookie('theme', newTheme, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.redirect(returnUrl);
});

module.exports = router;