const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderType: { type: String, enum: ['buyer', 'farmer'], required: true },
    priceOffered: { type: Number, required: false },
    message: { type: String, required: false },
    timestamp: { type: Date, default: Date.now }
});

const negotiationSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String },
    initialPrice: { type: Number, required: true },
    finalPrice: { type: Number },
    status: { type: String, enum: ['open', 'accepted', 'rejected', 'finalized'], default: 'open' },
    messages: [messageSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Negotiation', negotiationSchema);
