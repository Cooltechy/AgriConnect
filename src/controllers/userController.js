const User = require('../models/User');
const crypto = require('crypto');

// Show registration page
const showRegisterPage = (req, res) => {
    res.render('register');
};

// Show login page
const showLoginPage = (req, res) => {
    res.render('login');
};

// Handle user login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).render('login', {
                error: 'User not registered. Please sign up first.',
                formData: req.body
            });
        }

        // Check password (In production, use bcrypt to compare hashed passwords)
        if (user.password !== password) {
            return res.status(400).render('login', {
                error: 'Wrong password. Please try again.',
                formData: req.body
            });
        }

        // Login successful - redirect to appropriate page based on user type with user ID in query
        if (user.userType === 'farmer') {
            res.redirect(`/farmer-dashboard?userId=${user._id}`);
        } else if (user.userType === 'client') {
            res.redirect(`/search?userId=${user._id}`);
        } else {
            res.redirect('/');
        }

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).render('login', {
            error: 'Something went wrong. Please try again later.',
            formData: req.body
        });
    }
};

// Handle user registration
const registerUser = async (req, res) => {
    try {
        const { userType, name, email, password, contact } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).render('register', {
                error: 'User with this email already exists',
                formData: req.body
            });
        }

        // Create new user
        const newUser = new User({
            userType,
            name,
            email,
            password, // In production, you should hash this password
            contact
        });
        
        await newUser.save();

        res.status(201).render('success', {
            message: 'Registration successful!',
            userType: userType,
            name: name
        });

    } catch (error) {
        res.status(500).render('register', {
            error: 'Registration failed. Please try again.',
            formData: req.body
        });
    }
};

module.exports = {
    showRegisterPage,
    showLoginPage,
    registerUser,
    loginUser
};