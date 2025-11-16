const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Order identification
    orderNumber: {
        type: String,
        unique: true
    },
    
    // Buyer information
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    buyerName: {
        type: String,
        required: true
    },
    buyerEmail: {
        type: String,
        required: true
    },
    buyerContact: {
        type: String,
        required: true
    },
    
    // Product information
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    productCategory: {
        type: String,
        required: true
    },
    
    // Farmer information
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    farmerName: {
        type: String,
        required: true
    },
    farmerContact: {
        type: String,
        required: true
    },
    
    // Order details
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unit: {
        type: String,
        required: true
    },
    pricePerUnit: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        min: 0
    },
    
    // Order status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-transit', 'delivered', 'cancelled'],
        default: 'pending'
    },
    
    // Delivery information
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        landmark: String
    },
    
    // Payment information
    paymentMethod: {
        type: String,
        enum: ['cash-on-delivery', 'online-payment', 'bank-transfer'],
        default: 'cash-on-delivery'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    
    // Order dates
    orderDate: {
        type: Date,
        default: Date.now
    },
    expectedDeliveryDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    },
    
    // Additional information
    notes: {
        type: String,
        maxlength: 500
    },
    
    // Order tracking
    trackingUpdates: [{
        status: String,
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', function(next) {
    if (!this.orderNumber) {
        const date = new Date();
        const timestamp = date.getFullYear().toString() + 
                         (date.getMonth() + 1).toString().padStart(2, '0') + 
                         date.getDate().toString().padStart(2, '0');
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.orderNumber = `AC${timestamp}${randomNum}`;
    }
    next();
});

// Calculate total amount before saving
orderSchema.pre('save', function(next) {
    if (!this.totalAmount) {
        this.totalAmount = this.quantity * this.pricePerUnit;
    }
    next();
});

// Index for efficient queries
orderSchema.index({ buyerId: 1, orderDate: -1 });
orderSchema.index({ farmerId: 1, orderDate: -1 });
orderSchema.index({ status: 1 });
// Note: orderNumber index is automatically created by unique: true

module.exports = mongoose.model('Order', orderSchema);