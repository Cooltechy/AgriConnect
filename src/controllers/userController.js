const User = require('../models/User');
const bcrypt = require('bcryptjs');

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

        // Check password using bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).render('login', {
                error: 'Wrong password. Please try again.',
                formData: req.body
            });
        }

        // Create session
        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            contact: user.contact
        };

        // Login successful - redirect to appropriate page based on user type
        if (user.userType === 'farmer') {
            res.redirect('/farmer-dashboard');
        } else if (user.userType === 'client') {
            res.redirect('/search');
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

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = new User({
            userType,
            name,
            email,
            password: hashedPassword,
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

// Handle user logout
const logoutUser = (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        // If AJAX request
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true, message: 'Already logged out', redirectTo: '/' });
        }
        // If regular request
        return res.redirect('/?message=Already logged out');
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            // If AJAX request
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(500).json({ success: false, message: 'Logout failed' });
            }
            // If regular request
            return res.redirect('/?error=Logout failed, please try again');
        }
        
        res.clearCookie('connect.sid'); // Clear session cookie
        
        // If AJAX request
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.json({ success: true, message: 'Logged out successfully', redirectTo: '/' });
        }
        
        // If regular request
        res.redirect('/?message=Logged out successfully');
    });
};

module.exports = {
    showRegisterPage,
    showLoginPage,
    registerUser,
    loginUser,
    logoutUser
};