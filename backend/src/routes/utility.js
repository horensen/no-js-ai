const express = require('express');
const router = express.Router();

// Debug page for troubleshooting
router.get('/debug', (req, res) => {
  const theme = req.cookies.theme || 'light';
  res.render('debug', { theme });
});

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