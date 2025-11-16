const express = require('express');
const router = express.Router();
const negotiationController = require('../controllers/negotiationController');

// Create negotiation (buyer initiates)
router.post('/create', negotiationController.createNegotiation);

// Negotiation history pages (MUST come before /:negotiationId routes)
router.get('/buyer-history', negotiationController.renderBuyerNegotiationHistory);
router.get('/farmer-history', negotiationController.renderFarmerNegotiationHistory);

// Debug routes (MUST come before /:negotiationId routes)
router.get('/debug/users', async (req, res) => {
    try {
        const User = require('../models/User');
        const users = await User.find({}).select('_id name email userType');
        const Negotiation = require('../models/Negotiation');
        const negotiations = await Negotiation.find({}).select('_id buyerId farmerId status createdAt');
        res.json({ 
            success: true, 
            users: users.length,
            userDetails: users,
            negotiations: negotiations.length,
            negotiationDetails: negotiations
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// API endpoints for getting negotiations (MUST come before /:negotiationId routes)
router.get('/api/buyer/:buyerId', negotiationController.getBuyerNegotiations);
router.get('/api/farmer/:farmerId', negotiationController.getFarmerNegotiations);

// Dynamic negotiation ID routes (MUST come AFTER specific routes)
// Add message/offer to negotiation
router.post('/:negotiationId/message', negotiationController.addMessage);

// Get negotiation details
router.get('/:negotiationId', negotiationController.getNegotiation);

// Accept negotiation (either party)
router.post('/:negotiationId/accept', negotiationController.acceptNegotiation);

// Decline negotiation (either party)
router.post('/:negotiationId/decline', negotiationController.declineNegotiation);

// Finalize negotiation (after order placed)
router.post('/:negotiationId/finalize', negotiationController.finalizeNegotiation);

// Render negotiation chat view
router.get('/:negotiationId/chat', negotiationController.renderNegotiationChat);

module.exports = router;
