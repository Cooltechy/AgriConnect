const express = require('express');
const router = express.Router();
const { 
    showRegisterPage, 
    showLoginPage, 
    registerUser, 
    loginUser
} = require('../controllers/userController');

// GET - Show registration page
router.get('/register', showRegisterPage);

// POST - Handle registration form submission
router.post('/register', registerUser);

// GET - Show login page
router.get('/login', showLoginPage);

// POST - Handle login form submission
router.post('/login', loginUser);

module.exports = router;