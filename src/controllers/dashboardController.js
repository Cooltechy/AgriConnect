// Show farmer dashboard
const showFarmerDashboard = async (req, res) => {
    try {
        const User = require('../models/User');
        let user = req.user;
        
        // Try to get user from userId query parameter if available
        if (!user && req.query.userId) {
            console.log(`🧑‍🌾 Farmer Dashboard: Looking for user with ID: ${req.query.userId}`);
            try {
                user = await User.findById(req.query.userId);
                if (user) {
                    console.log(`🆔 Farmer Dashboard: Using specified user - ${user.name} (${user.email}) [ID: ${req.query.userId}]`);
                }
            } catch (err) {
                console.error('Error fetching user by ID:', err);
            }
        }
        
        // If no user found by ID, try to get any farmer user from database
        if (!user) {
            user = await User.findOne({ userType: 'farmer' }).sort({ createdAt: -1 });
            if (user) {
                console.log(`👨‍🌾 Farmer Dashboard: Using farmer user - ${user.name} (${user.email})`);
            }
        }
        
        // If still no user found, create a default farmer user
        if (!user) {
            user = new User({
                name: 'Demo Farmer',
                email: 'farmer@demo.com',
                password: 'demo123',
                userType: 'farmer',
                contact: '9876543210'
            });
            await user.save();
            console.log('Created demo farmer user:', user._id);
        }

        const Order = require('../models/Order');
        const Product = require('../models/Product');
        const mongoose = require('mongoose');
        const userId = user._id.toString();

        // Get farmer's products statistics
        const productStats = await Product.aggregate([
            { $match: {
                $or: [
                    { farmerId: userId },
                    { farmerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
                ]
            } },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    availableProducts: {
                        $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] }
                    },
                    organicProducts: {
                        $sum: { $cond: [{ $eq: ['$isOrganic', true] }, 1, 0] }
                    },
                    totalQuantity: { $sum: '$quantity' },
                    averagePrice: { $avg: '$price' }
                }
            }
        ]);

        // Get order statistics for the farmer (orders received)
        const orderStats = await Order.aggregate([
            { $match: {
                $or: [
                    { farmerId: userId },
                    { farmerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
                ]
            } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    pendingOrders: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['pending', 'confirmed']] },
                                1,
                                0
                            ]
                        }
                    },
                    completedOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
                        }
                    },
                    averageOrderValue: { $avg: '$totalAmount' }
                }
            }
        ]);



        // Get recent orders (last 5 orders received)
        const recentOrders = await Order.find({
            $or: [
                { farmerId: userId },
                { farmerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('productId', 'name category')
            .populate('buyerId', 'name contact');

        // Get category breakdown of farmer's products
        const categoryStats = await Product.aggregate([
            { $match: {
                $or: [
                    { farmerId: userId },
                    { farmerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
                ]
            } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                    averagePrice: { $avg: '$price' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get monthly revenue for chart
        const monthlyRevenue = await Order.aggregate([
            { $match: {
                $and: [
                    { $or: [
                        { farmerId: userId },
                        { farmerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
                    ]},
                    { status: 'delivered' }
                ]
            } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    revenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
        ]);

        // Get top-selling products
        const topProducts = await Order.aggregate([
            { $match: {
                $or: [
                    { farmerId: userId },
                    { farmerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
                ]
            } },
            {
                $group: {
                    _id: '$productId',
                    productName: { $first: '$productName' },
                    totalQuantitySold: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 }
        ]);

        const finalOrderStats = orderStats[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            completedOrders: 0,
            averageOrderValue: 0
        };
        


        res.render('farmer-dashboard', { 
            user,
            productStats: productStats[0] || {
                totalProducts: 0,
                availableProducts: 0,
                organicProducts: 0,
                totalQuantity: 0,
                averagePrice: 0
            },
            orderStats: finalOrderStats,
            recentOrders,
            categoryStats,
            monthlyRevenue,
            topProducts
        });
    } catch (error) {
        console.error('Error loading farmer dashboard:', error);
        // Fallback to basic dashboard if there's an error
        const user = req.user || {
            _id: '507f1f77bcf86cd799439011',
            name: 'Farmer User',
            email: 'farmer@example.com',
            userType: 'farmer',
            contact: '1234567890'
        };
        res.render('farmer-dashboard', { 
            user,
            productStats: {
                totalProducts: 0,
                availableProducts: 0,
                organicProducts: 0,
                totalQuantity: 0,
                averagePrice: 0
            },
            orderStats: {
                totalOrders: 0,
                totalRevenue: 0,
                pendingOrders: 0,
                completedOrders: 0,
                averageOrderValue: 0
            },
            recentOrders: [],
            categoryStats: [],
            monthlyRevenue: [],
            topProducts: []
        });
    }
};

// Show client dashboard - enhanced with product search and recommendations
const showClientDashboard = async (req, res) => {
    try {
        const User = require('../models/User');
        let user = req.user;
        
        // Try to get user from userId query parameter if available
        if (!user && req.query.userId) {
    
            try {
                user = await User.findById(req.query.userId);
                if (user) {
                    console.log(`🆔 Client Dashboard: Using specified user - ${user.name} (${user.email}) [ID: ${req.query.userId}]`);
                } else {
                    console.log(`❌ Client Dashboard: No user found with ID: ${req.query.userId}`);
                }
            } catch (err) {
                console.error('Error fetching user by ID:', err);
            }
        }
        
        // If no user found by ID, try to get any client user from database
        if (!user) {
            user = await User.findOne({ userType: 'client' }).sort({ createdAt: -1 });
            if (user) {
                console.log(`📱 Client Dashboard: Using client user - ${user.name} (${user.email})`);
            }
        }
        
        // If still no user found, create a default client user
        if (!user) {
            user = new User({
                name: 'Demo Client',
                email: 'client@demo.com',
                password: 'demo123',
                userType: 'client',
                contact: '9876543210'
            });
            await user.save();
            console.log('Created demo client user:', user._id);
        }

        const Order = require('../models/Order');
        const Product = require('../models/Product');

        // Get order statistics for the buyer  
        // Handle both string and ObjectId formats for buyerId
        const mongoose = require('mongoose');
        const userId = user._id.toString();
        
        const orderStats = await Order.aggregate([
            { $match: { 
                $or: [
                    { buyerId: userId },
                    { buyerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
                ]
            } },
            {
                $group: {
                    _id: null,
                    totalSpent: { $sum: '$totalAmount' },
                    totalOrders: { $sum: 1 },
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



        // Get recent orders (last 5)
        const recentOrders = await Order.find({ 
            $or: [
                { buyerId: userId },
                { buyerId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('productId', 'name category');

        // Get featured products (latest 6 available products)
        const featuredProducts = await Product.find({ isAvailable: true })
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('farmerId', 'name contact');

        // Get category statistics for quick categories
        const categoryStats = await Product.aggregate([
            { $match: { isAvailable: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);

        // Get monthly spending for chart
        const monthlySpending = await Order.aggregate([
            { $match: { buyerId: user._id, status: 'delivered' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalSpent: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
        ]);

        res.render('client-dashboard', { 
            user, 
            orderStats: orderStats[0] || {
                totalSpent: 0,
                totalOrders: 0,
                pendingOrders: 0,
                deliveredOrders: 0,
                averageOrder: 0
            },
            recentOrders,
            featuredProducts,
            categoryStats,
            monthlySpending
        });
    } catch (error) {
        console.error('Error loading client dashboard:', error);
        // Fallback to basic dashboard if there's an error
        let user = req.user;
        
        if (!user && req.query.userId) {
            try {
                const User = require('../models/User');
                user = await User.findById(req.query.userId);
            } catch (userError) {
                console.error('Error fetching user in fallback:', userError);
            }
        }
        
        if (!user) {
            user = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Client User',
                email: 'client@example.com',
                userType: 'client',
                contact: '0987654321'
            };
        }
        res.render('client-dashboard', { 
            user, 
            orderStats: {
                totalSpent: 0,
                totalOrders: 0,
                pendingOrders: 0,
                deliveredOrders: 0,
                averageOrder: 0
            },
            recentOrders: [],
            featuredProducts: [],
            categoryStats: [],
            monthlySpending: []
        });
    }
};

module.exports = {
    showFarmerDashboard,
    showClientDashboard
};