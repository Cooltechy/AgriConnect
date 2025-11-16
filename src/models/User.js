const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userType: {
        type: String,
        enum: ['farmer', 'client'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    contact: {
        type: String,
        required: true,
        trim: true
    },
    
});

module.exports = mongoose.model('User', userSchema);