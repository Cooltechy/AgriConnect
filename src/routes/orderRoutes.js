const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Order management routes
router.get('/history', orderController.getBuyerOrderHistory);
router.get('/farmer-orders', orderController.getFarmerOrderHistory);
router.get('/:orderId', orderController.getOrderDetails);
router.post('/:orderId/cancel', orderController.cancelOrder);
router.post('/place', orderController.placeOrder);
router.put('/:orderId/status', orderController.updateOrderStatus);

module.exports = router;