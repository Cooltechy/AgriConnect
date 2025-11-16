const express = require('express');
const router = express.Router();
const {
    showAddProductPage,
    addProduct,
    showFarmerProducts,
    showAllProducts,
    deleteProduct,
    toggleProductAvailability
} = require('../controllers/productController');

// GET - Show add product page
router.get('/add-product', showAddProductPage);

// POST - Handle add product form submission
router.post('/add-product', addProduct);

// GET - Show farmer's products
router.get('/farmer/:farmerId/products', showFarmerProducts);

// GET - Show all products (browse)
router.get('/products', showAllProducts);

// DELETE - Delete product
router.delete('/products/:productId', deleteProduct);

// PUT - Toggle product availability
router.put('/products/:productId/toggle', toggleProductAvailability);

module.exports = router;