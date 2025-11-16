const Product = require('../models/Product');
const User = require('../models/User');

// Show add product page
const showAddProductPage = async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).render('add-product', {
                error: 'User not authenticated. Please login again.',
                farmerId: null
            });
        }

        // Fetch farmer details from database
        const farmer = await User.findById(userId);
        
        if (!farmer) {
            return res.status(404).render('add-product', {
                error: 'Farmer not found. Please login again.',
                farmerId: null
            });
        }

        res.render('add-product', { 
            farmerId: farmer._id,
            farmerName: farmer.name,
            farmerContact: farmer.contact
        });
        
    } catch (error) {
        console.error('Error loading add product page:', error);
        res.status(500).render('add-product', {
            error: 'Failed to load page. Please try again.',
            farmerId: null
        });
    }
};

// Handle add product form submission
const addProduct = async (req, res) => {
    try {
        const {
            name, category, description, price, unit, quantity,
            farmerId, location, harvestDate, expiryDate, isOrganic
        } = req.body;

        // Fetch farmer details from database
        const farmer = await User.findById(farmerId);
        
        if (!farmer) {
            return res.status(404).render('add-product', {
                error: 'Farmer not found. Please login again.',
                formData: req.body,
                farmerId: null
            });
        }

        // Check if the same farmer already has a product with the same name and category
        const existingProduct = await Product.findOne({
            farmerId,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // Case-insensitive exact match
            category
        });

        if (existingProduct) {
            return res.status(400).render('add-product', {
                error: `You already have a product "${name}" in the ${category} category. Please use a different name or update your existing product.`,
                formData: req.body,
                farmerId: req.body.farmerId,
                farmerName: farmer.name,
                farmerContact: farmer.contact
            });
        }

        // Create new product with farmer details from database
        const newProduct = new Product({
            name,
            category,
            description,
            price: parseFloat(price),
            unit,
            quantity: parseInt(quantity),
            farmerId,
            farmerName: farmer.name,        // From database
            farmerContact: farmer.contact,  // From database
            location,
            harvestDate: harvestDate || null,
            expiryDate: expiryDate || null,
            isOrganic: isOrganic === 'on' || isOrganic === true
        });

        await newProduct.save();

        res.render('product-success', {
            product: newProduct,
            message: 'Product added successfully!'
        });

    } catch (error) {
        console.error('Error adding product:', error);
        
        // Re-render form with error and farmer details
        try {
            const farmer = await User.findById(req.body.farmerId);
            res.status(500).render('add-product', {
                error: 'Failed to add product. Please try again.',
                formData: req.body,
                farmerId: req.body.farmerId,
                farmerName: farmer ? farmer.name : '',
                farmerContact: farmer ? farmer.contact : ''
            });
        } catch (fetchError) {
            res.status(500).render('add-product', {
                error: 'Failed to add product. Please try again.',
                formData: req.body,
                farmerId: null
            });
        }
    }
};

// Show farmer's products
const showFarmerProducts = async (req, res) => {
    try {
        const { farmerId } = req.params;
        
        const products = await Product.find({ farmerId }).sort({ createdAt: -1 });
        const farmer = await User.findById(farmerId);

        res.render('farmer-products', {
            products,
            farmer,
            totalProducts: products.length,
            availableProducts: products.filter(p => p.isAvailable).length
        });

    } catch (error) {
        console.error('Error fetching farmer products:', error);
        res.status(500).render('farmer-products', {
            error: 'Failed to load products. Please try again.',
            products: [],
            farmer: null,
            totalProducts: 0,
            availableProducts: 0
        });
    }
};

// Show all products (browse)
const showAllProducts = async (req, res) => {
    try {
        const { category, location, minPrice, maxPrice, organic } = req.query;
        
        let filter = { isAvailable: true };
        
        if (category && category !== 'all') {
            filter.category = category;
        }
        
        if (location) {
            filter.location = new RegExp(location, 'i');
        }
        
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }
        
        if (organic === 'true') {
            filter.isOrganic = true;
        }

        const products = await Product.find(filter)
            .populate('farmerId', 'name contact')
            .sort({ createdAt: -1 });

        res.render('browse-products', {
            products,
            filters: req.query,
            categories: ['fruits', 'vegetables', 'grains', 'dairy', 'meat', 'herbs', 'other']
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('browse-products', {
            error: 'Failed to load products',
            products: [],
            filters: {},
            categories: []
        });
    }
};

// Delete product
const deleteProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        
        await Product.findByIdAndDelete(productId);
        
        res.json({ success: true, message: 'Product deleted successfully' });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
};

// Toggle product availability
const toggleProductAvailability = async (req, res) => {
    try {
        const { productId } = req.params;
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        product.isAvailable = !product.isAvailable;
        await product.save();
        
        res.json({ 
            success: true, 
            message: `Product ${product.isAvailable ? 'enabled' : 'disabled'} successfully`,
            isAvailable: product.isAvailable
        });

    } catch (error) {
        console.error('Error toggling product availability:', error);
        res.status(500).json({ success: false, message: 'Failed to update product' });
    }
};

module.exports = {
    showAddProductPage,
    addProduct,
    showFarmerProducts,
    showAllProducts,
    deleteProduct,
    toggleProductAvailability
};