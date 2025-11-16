const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['fruits', 'vegetables', 'grains', 'dairy', 'meat', 'herbs', 'other'],
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        enum: ['kg', 'gram', 'liter', 'piece', 'dozen', 'quintal', 'ton'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
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
    isAvailable: {
        type: Boolean,
        default: true
    }   
}, {
    timestamps: true
});

// Index for efficient queries
productSchema.index({ farmerId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isAvailable: 1 });
// Compound index to ensure uniqueness per farmer (case-insensitive name + category + farmerId)
productSchema.index({ farmerId: 1, name: 1, category: 1 });


module.exports = mongoose.model('Product', productSchema);