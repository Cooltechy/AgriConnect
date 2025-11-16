const Negotiation = require('../models/Negotiation');
const Product = require('../models/Product');
const User = require('../models/User');

// Create a new negotiation (buyer initiates)
const createNegotiation = async (req, res) => {
    try {
        const { buyerId, productId, quantity, offeredPrice, message } = req.body;

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        const farmerId = product.farmerId;

        const negotiation = new Negotiation({
            productId,
            buyerId,
            farmerId,
            quantity: parseInt(quantity || 1),
            unit: product.unit,
            initialPrice: offeredPrice || product.price,
            messages: [{ senderId: buyerId, senderType: 'buyer', priceOffered: offeredPrice, message }]
        });

        await negotiation.save();

        res.json({ success: true, negotiationId: negotiation._id, negotiation });
    } catch (error) {
        console.error('Error creating negotiation:', error);
        res.status(500).json({ success: false, message: 'Failed to create negotiation' });
    }
};

// Add a message/offer to an existing negotiation (both buyer and farmer)
const addMessage = async (req, res) => {
    try {
        const { negotiationId } = req.params;
        const { senderId, senderType, priceOffered, message } = req.body;

        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) return res.status(404).json({ success: false, message: 'Negotiation not found' });

        if (negotiation.status !== 'open') {
            return res.status(400).json({ success: false, message: 'Negotiation is not open for messages' });
        }

        negotiation.messages.push({ senderId, senderType, priceOffered, message });

        // If a new price is offered, keep the latest as initialPrice is kept for reference
        if (priceOffered !== undefined && priceOffered !== null) {
            // nothing extra now; finalPrice is set only on accept
        }

        await negotiation.save();

        res.json({ success: true, negotiation });
    } catch (error) {
        console.error('Error adding message to negotiation:', error);
        res.status(500).json({ success: false, message: 'Failed to add message' });
    }
};

// Get negotiation details and messages
const getNegotiation = async (req, res) => {
    try {
        console.log('🔍 Getting negotiation details for ID:', req.params.negotiationId);
        const { negotiationId } = req.params;
        
        if (!negotiationId) {
            return res.status(400).json({ success: false, message: 'Negotiation ID is required' });
        }
        
        const negotiation = await Negotiation.findById(negotiationId)
            .populate('productId', 'name price unit')
            .populate('buyerId', 'name contact')
            .populate('farmerId', 'name contact')
            .populate('messages.senderId', 'name');

        if (!negotiation) {
            console.log('❌ Negotiation not found:', negotiationId);
            return res.status(404).json({ success: false, message: 'Negotiation not found' });
        }

        console.log('✅ Found negotiation:', negotiation._id);
        res.json({ success: true, negotiation });
    } catch (error) {
        console.error('❌ Error fetching negotiation:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch negotiation', error: error.message });
    }
};

// Farmer (or buyer) accepts a price and finalizes negotiation (marks accepted)
const acceptNegotiation = async (req, res) => {
    try {
        const { negotiationId } = req.params;
        const { accepterId, acceptedPrice } = req.body;

        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) return res.status(404).json({ success: false, message: 'Negotiation not found' });

        if (negotiation.status !== 'open') {
            return res.status(400).json({ success: false, message: 'Negotiation is not open' });
        }

        // Only farmer or buyer involved can accept
        if (![negotiation.farmerId.toString(), negotiation.buyerId.toString()].includes(accepterId)) {
            return res.status(403).json({ success: false, message: 'Not authorized to accept this negotiation' });
        }

        // Find the last price offer to validate who can accept it
        const lastPriceMessage = [...negotiation.messages].reverse().find(m => 
            m.priceOffered !== undefined && m.priceOffered !== null && m.priceOffered > 0 &&
            (!m.message || !m.message.includes('Accepted at'))
        );

        if (lastPriceMessage) {
            // Prevent users from accepting their own offers
            if (lastPriceMessage.senderId.toString() === accepterId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'You cannot accept your own offer. Wait for the other party to respond.' 
                });
            }
        }

        // Determine final price: use acceptedPrice if provided, else last offered price in messages, else initialPrice
        let final = acceptedPrice;
        if (final === undefined || final === null) {
            const lastMsgWithPrice = [...negotiation.messages].reverse().find(m => m.priceOffered !== undefined && m.priceOffered !== null);
            final = lastMsgWithPrice ? lastMsgWithPrice.priceOffered : negotiation.initialPrice;
        }

        negotiation.finalPrice = final;
        negotiation.status = 'accepted';

        // push an acceptance system message
        negotiation.messages.push({ senderId: accepterId, senderType: accepterId === negotiation.farmerId.toString() ? 'farmer' : 'buyer', message: `Accepted at ${final}`, priceOffered: final });

        await negotiation.save();

        res.json({ success: true, negotiation });
    } catch (error) {
        console.error('Error accepting negotiation:', error);
        res.status(500).json({ success: false, message: 'Failed to accept negotiation' });
    }
};

// Decline/reject negotiation (either party)
const declineNegotiation = async (req, res) => {
    try {
        const { negotiationId } = req.params;
        const { declinerId } = req.body;

        if (!declinerId) {
            return res.status(400).json({ success: false, message: 'Decliner ID is required' });
        }

        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) return res.status(404).json({ success: false, message: 'Negotiation not found' });

        if (negotiation.status !== 'open') {
            return res.status(400).json({ success: false, message: 'Negotiation is not open for declining' });
        }

        // Only farmer or buyer involved can decline
        if (![negotiation.farmerId.toString(), negotiation.buyerId.toString()].includes(declinerId)) {
            return res.status(403).json({ success: false, message: 'Not authorized to decline this negotiation' });
        }

        // Find the last price offer to validate who can decline it
        const lastPriceMessage = [...negotiation.messages].reverse().find(m => 
            m.priceOffered !== undefined && m.priceOffered !== null && m.priceOffered > 0 &&
            (!m.message || !m.message.includes('Accepted at'))
        );

        if (lastPriceMessage) {
            // Prevent users from declining their own offers
            if (lastPriceMessage.senderId.toString() === declinerId) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'You cannot decline your own offer. You can send a new counter-offer instead.' 
                });
            }
        }

        negotiation.status = 'rejected';

        // Add a decline system message
        const declinerType = declinerId === negotiation.farmerId.toString() ? 'farmer' : 'buyer';
        negotiation.messages.push({ 
            senderId: declinerId, 
            senderType: declinerType, 
            message: `Declined the negotiation - no agreement reached on price` 
        });

        await negotiation.save();

        res.json({ success: true, negotiation });
    } catch (error) {
        console.error('Error declining negotiation:', error);
        res.status(500).json({ success: false, message: 'Failed to decline negotiation' });
    }
};

// Mark negotiation as finalized (e.g., after order placed)
const finalizeNegotiation = async (req, res) => {
    try {
        const { negotiationId } = req.params;
        const negotiation = await Negotiation.findById(negotiationId);
        if (!negotiation) return res.status(404).json({ success: false, message: 'Negotiation not found' });

        negotiation.status = 'finalized';
        await negotiation.save();

        res.json({ success: true, negotiation });
    } catch (error) {
        console.error('Error finalizing negotiation:', error);
        res.status(500).json({ success: false, message: 'Failed to finalize negotiation' });
    }
};

// Render negotiation chat view
const renderNegotiationChat = async (req, res) => {
    try {
        const { negotiationId } = req.params;
        const { userId, userType } = req.query; // In real app, get from session/auth
        
        const negotiation = await Negotiation.findById(negotiationId)
            .populate('productId', 'name price unit')
            .populate('buyerId', 'name contact')
            .populate('farmerId', 'name contact')
            .populate('messages.senderId', 'name');

        if (!negotiation) {
            return res.status(404).redirect('/search?error=Negotiation not found');
        }

        // Determine current user type if not provided
        let currentUserType = userType;
        if (!currentUserType) {
            if (negotiation.buyerId._id.toString() === userId) {
                currentUserType = 'buyer';
            } else if (negotiation.farmerId._id.toString() === userId) {
                currentUserType = 'farmer';
            } else {
                return res.status(403).redirect('/search?error=Not authorized to view this negotiation');
            }
        }

        res.render('negotiation-chat', {
            negotiation,
            currentUserId: userId,
            currentUserType
        });

    } catch (error) {
        console.error('Error rendering negotiation chat:', error);
        res.status(500).redirect('/search?error=Failed to load negotiation');
    }
};

// Get negotiations for buyer (API)
const getBuyerNegotiations = async (req, res) => {
    try {
        console.log('📡 API request for buyer negotiations:', req.params.buyerId);
        const { buyerId } = req.params;
        
        if (!buyerId) {
            return res.status(400).json({ success: false, message: 'Buyer ID is required' });
        }
        
        const negotiations = await Negotiation.find({ buyerId })
            .populate('productId', 'name price unit')
            .populate('farmerId', 'name contact')
            .sort({ updatedAt: -1 })
            .limit(5);

        console.log('✅ API found negotiations:', negotiations.length);
        res.json({ success: true, negotiations });
    } catch (error) {
        console.error('❌ Error fetching buyer negotiations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch negotiations', error: error.message });
    }
};

// Get negotiations for farmer (API)
const getFarmerNegotiations = async (req, res) => {
    try {
        console.log('📡 API request for farmer negotiations:', req.params.farmerId);
        const { farmerId } = req.params;
        
        if (!farmerId) {
            return res.status(400).json({ success: false, message: 'Farmer ID is required' });
        }
        
        const negotiations = await Negotiation.find({ farmerId })
            .populate('productId', 'name price unit')
            .populate('buyerId', 'name contact')
            .sort({ updatedAt: -1 })
            .limit(5);

        console.log('✅ API found negotiations:', negotiations.length);
        res.json({ success: true, negotiations });
    } catch (error) {
        console.error('❌ Error fetching farmer negotiations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch negotiations', error: error.message });
    }
};

// Render buyer negotiation history page
const renderBuyerNegotiationHistory = async (req, res) => {
    try {
        console.log('🔍 Buyer negotiation history request:', req.query);
        let buyerId = req.query.buyerId || req.query.userId;
        
        // If no user ID provided, try to get any client user from database
        if (!buyerId) {
            const User = require('../models/User');
            const buyerUser = await User.findOne({ userType: 'client' });
            if (buyerUser) {
                buyerId = buyerUser._id.toString();
                console.log('📝 Using default client:', buyerUser.name, buyerId);
            }
        }
        
        if (!buyerId) {
            console.log('❌ No buyer ID found');
            return res.redirect('/search?error=User not found');
        }
        
        console.log('🔎 Looking for negotiations for buyer:', buyerId);
        const negotiations = await Negotiation.find({ buyerId })
            .populate('productId', 'name price unit category')
            .populate('farmerId', 'name contact')
            .sort({ updatedAt: -1 });
            
        console.log('✅ Found negotiations:', negotiations.length);
        
        res.render('buyer-negotiation-history', {
            negotiations,
            buyerId,
            currentUserType: 'buyer'
        });
        
    } catch (error) {
        console.error('❌ Error rendering buyer negotiation history:', error);
        res.status(500).json({ success: false, message: 'Failed to load negotiation history', error: error.message });
    }
};

// Render farmer negotiation history page
const renderFarmerNegotiationHistory = async (req, res) => {
    try {
        console.log('🔍 Farmer negotiation history request:', req.query);
        let farmerId = req.query.farmerId || req.query.userId;
        
        // If no user ID provided, try to get any farmer user from database
        if (!farmerId) {
            const User = require('../models/User');
            const farmerUser = await User.findOne({ userType: 'farmer' });
            if (farmerUser) {
                farmerId = farmerUser._id.toString();
                console.log('📝 Using default farmer:', farmerUser.name, farmerId);
            }
        }
        
        if (!farmerId) {
            console.log('❌ No farmer ID found');
            return res.redirect('/search?error=User not found');
        }
        
        console.log('🔎 Looking for negotiations for farmer:', farmerId);
        const negotiations = await Negotiation.find({ farmerId })
            .populate('productId', 'name price unit category')
            .populate('buyerId', 'name contact')
            .sort({ updatedAt: -1 });
            
        console.log('✅ Found negotiations:', negotiations.length);
        
        res.render('farmer-negotiation-history', {
            negotiations,
            farmerId,
            currentUserType: 'farmer'
        });
        
    } catch (error) {
        console.error('❌ Error rendering farmer negotiation history:', error);
        res.status(500).json({ success: false, message: 'Failed to load negotiation history', error: error.message });
    }
};

module.exports = {
    createNegotiation,
    addMessage,
    getNegotiation,
    acceptNegotiation,
    declineNegotiation,
    finalizeNegotiation,
    renderNegotiationChat,
    getBuyerNegotiations,
    getFarmerNegotiations,
    renderBuyerNegotiationHistory,
    renderFarmerNegotiationHistory
};
