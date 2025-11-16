const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Negotiation = require('../models/Negotiation');
const mongoose = require('mongoose');

// Place a new order
const placeOrder = async (req, res) => {
    try {
        const {
            buyerId, buyerName, buyerEmail, buyerContact,
            productId, quantity, deliveryAddress, notes, paymentMethod,
            negotiationId
        } = req.body;

        // Get product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (!product.isAvailable) {
            return res.status(400).json({ success: false, message: 'Product is not available' });
        }

        if (product.quantity < quantity) {
            return res.status(400).json({ 
                success: false, 
                message: `Only ${product.quantity} ${product.unit} available` 
            });
        }

        // If negotiationId provided, validate negotiation and use final price
        let pricePerUnit = product.price;
        if (negotiationId) {
            const negotiation = await Negotiation.findById(negotiationId);
            if (!negotiation) {
                return res.status(404).json({ success: false, message: 'Negotiation not found' });
            }
            if (negotiation.status !== 'accepted') {
                return res.status(400).json({ success: false, message: 'Negotiation must be accepted before placing an order' });
            }
            // Check buyer matches
            if (negotiation.buyerId.toString() !== buyerId) {
                return res.status(403).json({ success: false, message: 'Buyer mismatch for negotiation' });
            }
            pricePerUnit = negotiation.finalPrice || pricePerUnit;
        }

        // Create new order
        const newOrder = new Order({
            buyerId,
            buyerName,
            buyerEmail,
            buyerContact,
            productId,
            productName: product.name,
            productCategory: product.category,
            farmerId: product.farmerId,
            farmerName: product.farmerName,
            farmerContact: product.farmerContact,
            quantity: parseInt(quantity),
            unit: product.unit,
            pricePerUnit: pricePerUnit,
            deliveryAddress,
            notes,
            paymentMethod: paymentMethod || 'cash-on-delivery'
        });

        await newOrder.save();

        // If negotiation was used, mark it finalized
        if (negotiationId) {
            try {
                const negotiation = await Negotiation.findById(negotiationId);
                if (negotiation) {
                    negotiation.status = 'finalized';
                    await negotiation.save();
                }
            } catch (e) {
                console.warn('Warning: failed to finalize negotiation:', e.message);
            }
        }

        // Update product quantity
        product.quantity -= quantity;
        if (product.quantity === 0) {
            product.isAvailable = false;
        }
        await product.save();

        res.json({ 
            success: true, 
            message: 'Order placed successfully!',
            orderNumber: newOrder.orderNumber,
            orderId: newOrder._id
        });

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: 'Failed to place order' });
    }
};

// Get buyer's order history with filtering and pagination
const getBuyerOrderHistory = async (req, res) => {
    try {
        let buyerId = req.query.buyerId || req.query.userId;
        
        // If no user ID provided, try to get any client user from database
        if (!buyerId) {
            const User = require('../models/User');
            const clientUser = await User.findOne({ userType: 'client' });
            if (clientUser) {
                buyerId = clientUser._id.toString();
            } else {
                // Create a demo client if none exists
                const demoClient = new User({
                    name: 'Demo Client',
                    email: 'client@demo.com',
                    password: 'demo123',
                    userType: 'client',
                    contact: '9876543210'
                });
                await demoClient.save();
                buyerId = demoClient._id.toString();
                console.log('Created demo client for order history:', buyerId);
            }
        }

        // Extract filter parameters
        const { status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build filter object - ensure proper ObjectId comparison
        let filter = { buyerId: buyerId };
        
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) {
                filter.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
            }
        }

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limitNum);

        // Get filtered and paginated orders
        const orders = await Order.find(filter)
            .populate('productId', 'name category')
            .populate('farmerId', 'name contact')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // Get order statistics for all orders (not just filtered)
        // Try both string and ObjectId match to handle mixed data types
        const orderStats = await Order.aggregate([
            { $match: { 
                $or: [
                    { buyerId: buyerId },
                    { buyerId: mongoose.Types.ObjectId.isValid(buyerId) ? new mongoose.Types.ObjectId(buyerId) : null }
                ]
            } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$totalAmount' },
                    pendingOrders: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['pending', 'confirmed']] },
                                1,
                                0
                            ]
                        }
                    },
                    deliveredOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
                        }
                    },
                    inTransitOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'in-transit'] }, 1, 0]
                        }
                    },
                    cancelledOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                        }
                    },
                    averageOrder: { $avg: '$totalAmount' }
                }
            }
        ]);

        const stats = orderStats[0] || {
            totalOrders: 0,
            totalSpent: 0,
            pendingOrders: 0,
            deliveredOrders: 0,
            inTransitOrders: 0,
            cancelledOrders: 0,
            averageOrder: 0
        };

        res.render('order-history', {
            orders,
            orderStats: stats,
            totalOrders: stats.totalOrders,
            pendingOrders: stats.pendingOrders,
            deliveredOrders: stats.deliveredOrders,
            inTransitOrders: stats.inTransitOrders,
            cancelledOrders: stats.cancelledOrders,
            filteredCount: orders.length,
            totalFilteredOrders: totalOrders,
            currentPage: pageNum,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            nextPage: pageNum + 1,
            prevPage: pageNum - 1,
            filters: {
                status: status || 'all',
                dateFrom: dateFrom || '',
                dateTo: dateTo || '',
                limit: limitNum
            },
            buyerId,
            error: null
        });

    } catch (error) {
        console.error('Error fetching order history:', error);
        res.render('order-history', {
            orders: [],
            orderStats: {
                totalOrders: 0,
                totalSpent: 0,
                pendingOrders: 0,
                deliveredOrders: 0,
                inTransitOrders: 0,
                cancelledOrders: 0,
                averageOrder: 0
            },
            totalOrders: 0,
            pendingOrders: 0,
            deliveredOrders: 0,
            inTransitOrders: 0,
            cancelledOrders: 0,
            filteredCount: 0,
            totalFilteredOrders: 0,
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            nextPage: 1,
            prevPage: 1,
            filters: {
                status: 'all',
                dateFrom: '',
                dateTo: '',
                limit: 10
            },
            buyerId: buyerId || 'unknown',
            error: 'Failed to load order history'
        });
    }
};

// Get order details
const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Validate ObjectId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).render('order-details', {
                error: 'Invalid order ID format'
            });
        }
        
        const order = await Order.findById(orderId)
            .populate('productId', 'name category unit')
            .populate('farmerId', 'name contact')
            .populate('buyerId', 'name');

        if (!order) {
            return res.render('order-details', {
                error: 'Order not found'
            });
        }

        // Transform order data to match the view expectations
        const orderData = {
            ...order.toObject(),
            items: [{
                product: {
                    name: order.productName,
                    unit: order.unit,
                    farmer: {
                        name: order.farmerName
                    }
                },
                quantity: order.quantity,
                price: order.pricePerUnit
            }]
        };

        res.render('order-details', {
            order: orderData
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.render('order-details', {
            error: 'Failed to load order details'
        });
    }
};

// Cancel order
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'pending' && order.status !== 'confirmed') {
            return res.status(400).json({ 
                success: false, 
                message: 'Order cannot be cancelled at this stage' 
            });
        }

        // Update order status
        order.status = 'cancelled';
        await order.save();

        // Restore product quantity
        const product = await Product.findById(order.productId);
        if (product) {
            product.quantity += order.quantity;
            product.isAvailable = true;
            await product.save();
        }

        res.json({ success: true, message: 'Order cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel order' });
    }
};

// Update order status (for farmers/admin)
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, message } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.status = status;
        
        // Add tracking update
        order.trackingUpdates.push({
            status,
            message: message || `Order status updated to ${status}`,
            timestamp: new Date()
        });

        // Set delivery date if delivered
        if (status === 'delivered') {
            order.actualDeliveryDate = new Date();
        }

        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
};

// Get farmer's order history (orders received) with filtering and pagination
const getFarmerOrderHistory = async (req, res) => {
    try {
        let farmerId = req.query.farmerId || req.query.userId;
        
        // If no user ID provided, try to get any farmer user from database
        if (!farmerId) {
            const User = require('../models/User');
            const farmerUser = await User.findOne({ userType: 'farmer' });
            if (farmerUser) {
                farmerId = farmerUser._id.toString();
            } else {
                // Create a demo farmer if none exists
                const demoFarmer = new User({
                    name: 'Demo Farmer',
                    email: 'farmer@demo.com',
                    password: 'demo123',
                    userType: 'farmer',
                    contact: '9876543210'
                });
                await demoFarmer.save();
                farmerId = demoFarmer._id.toString();
                console.log('Created demo farmer for order history:', farmerId);
            }
        }

        // Extract filter parameters
        const { status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build filter object - handle ObjectId/string mismatch
        const mongoose = require('mongoose');
        let filter = {
            $or: [
                { farmerId: farmerId },
                { farmerId: mongoose.Types.ObjectId.isValid(farmerId) ? new mongoose.Types.ObjectId(farmerId) : null }
            ]
        };
        
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) {
                filter.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
            }
        }

        // Get total count for pagination
        const totalFilteredOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalFilteredOrders / limitNum);

        // Get filtered and paginated orders
        const orders = await Order.find(filter)
            .populate('productId', 'name category')
            .populate('buyerId', 'name contact')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // Get comprehensive order statistics for all farmer orders (not just filtered)
        const orderStats = await Order.aggregate([
            { $match: {
                $or: [
                    { farmerId: farmerId },
                    { farmerId: mongoose.Types.ObjectId.isValid(farmerId) ? new mongoose.Types.ObjectId(farmerId) : null }
                ]
            } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    pendingOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
                        }
                    },
                    confirmedOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0]
                        }
                    },
                    inTransitOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'in-transit'] }, 1, 0]
                        }
                    },
                    deliveredOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
                        }
                    },
                    cancelledOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                        }
                    },
                    averageOrderValue: { $avg: '$totalAmount' }
                }
            }
        ]);

        const stats = orderStats[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            confirmedOrders: 0,
            inTransitOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            averageOrderValue: 0
        };

        res.render('farmer-orders', {
            orders,
            totalOrders: stats.totalOrders,
            totalRevenue: stats.totalRevenue,
            pendingOrders: stats.pendingOrders,
            confirmedOrders: stats.confirmedOrders,
            inTransitOrders: stats.inTransitOrders,
            deliveredOrders: stats.deliveredOrders,
            cancelledOrders: stats.cancelledOrders,
            filteredCount: orders.length,
            totalFilteredOrders: totalFilteredOrders,
            currentPage: pageNum,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
            nextPage: pageNum + 1,
            prevPage: pageNum - 1,
            filters: {
                status: status || 'all',
                dateFrom: dateFrom || '',
                dateTo: dateTo || '',
                limit: limitNum
            },
            farmerId,
            error: null
        });

    } catch (error) {
        console.error('Error fetching farmer order history:', error);
        res.render('farmer-orders', {
            orders: [],
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            confirmedOrders: 0,
            inTransitOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            filteredCount: 0,
            totalFilteredOrders: 0,
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            nextPage: 1,
            prevPage: 1,
            filters: {
                status: 'all',
                dateFrom: '',
                dateTo: '',
                limit: 10
            },
            farmerId: farmerId || 'unknown',
            error: 'Failed to load order history'
        });
    }
};

// Render place order page
const renderPlaceOrder = async (req, res) => {
    try {
        // Ensure user is properly authenticated
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login?error=Please log in to place an order');
        }
        
        const { productId, negotiationId, quantity, agreedPrice } = req.query;
        
        const product = await Product.findById(productId)
            .populate('farmerId', 'name contact');
            
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        let negotiation = null;
        let currentPrice = product.price;
        
        if (negotiationId) {
            negotiation = await Negotiation.findById(negotiationId);
            if (negotiation && negotiation.status === 'accepted') {
                currentPrice = negotiation.finalPrice;
            }
        } else if (agreedPrice) {
            currentPrice = parseFloat(agreedPrice);
        }
        
        res.render('place-order', {
            product,
            negotiation,
            negotiationId: negotiationId || null,
            currentPrice,
            defaultQuantity: parseInt(quantity) || 1,
            currentUser: req.session.user || null
        });
        
    } catch (error) {
        console.error('Error rendering place order page:', error);
        res.status(500).json({ error: 'Failed to load order page' });
    }
};



module.exports = {
    placeOrder,
    getBuyerOrderHistory,
    getFarmerOrderHistory,
    getOrderDetails,
    cancelOrder,
    updateOrderStatus,
    renderPlaceOrder
};