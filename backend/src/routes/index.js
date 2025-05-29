const express = require('express');
const router = express.Router();

// Import route modules
const chatRoutes = require('./chat');
const sessionRoutes = require('./sessions');
const utilityRoutes = require('./utility');

// Mount route modules
router.use('/', chatRoutes);
router.use('/', sessionRoutes);
router.use('/', utilityRoutes);

module.exports = router;