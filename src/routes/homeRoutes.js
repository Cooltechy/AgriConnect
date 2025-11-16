const express = require('express');
const router = express.Router();
const { showHomePage } = require('../controllers/homeController');

// GET - Show home page
router.get('/', showHomePage);

module.exports = router;