const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth, requireClient, requireFarmer } = require('../middleware/auth');

// Order management routes - all require authentication
router.get('/history', requireAuth, requireClient, orderController.getBuyerOrderHistory);
router.get('/farmer-orders', requireAuth, requireFarmer, orderController.getFarmerOrderHistory);
router.post('/place', requireAuth, orderController.placeOrder);
router.get('/place-order', requireAuth, orderController.renderPlaceOrder);

// Order-specific routes (put these after more specific routes)
router.get('/:orderId', requireAuth, orderController.getOrderDetails);
router.post('/:orderId/cancel', requireAuth, orderController.cancelOrder);
// Update order status (for farmers/admin)
router.put('/:orderId/status', requireAuth, orderController.updateOrderStatus);

module.exports = router;