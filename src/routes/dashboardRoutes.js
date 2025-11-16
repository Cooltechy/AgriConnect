const express = require('express');
const router = express.Router();
const { showFarmerDashboard, showClientDashboard } = require('../controllers/dashboardController');

// GET - Show farmer dashboard
router.get('/farmer-dashboard', showFarmerDashboard);

// GET - Show client dashboard
router.get('/client-dashboard', showClientDashboard);

module.exports = router;