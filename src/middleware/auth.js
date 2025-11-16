// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        // For AJAX requests
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required',
                redirectTo: '/login'
            });
        }
        // For regular requests
        return res.redirect('/login?error=Please log in to access this page');
    }
};

// Middleware to check if user is already logged in (for login/register pages)
const requireGuest = (req, res, next) => {
    if (req.session && req.session.user) {
        // Redirect based on user type
        if (req.session.user.userType === 'farmer') {
            return res.redirect('/farmer-dashboard');
        } else {
            return res.redirect('/search');
        }
    }
    return next();
};

// Middleware to check user type
const requireFarmer = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.userType === 'farmer') {
        return next();
    } else {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Farmer access required' 
            });
        }
        return res.redirect('/login?error=Farmer access required');
    }
};

const requireClient = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.userType === 'client') {
        return next();
    } else {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Client access required' 
            });
        }
        return res.redirect('/login?error=Client access required');
    }
};

// Middleware to add user to all responses
const addUserToLocals = (req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    next();
};

module.exports = {
    requireAuth,
    requireGuest,
    requireFarmer,
    requireClient,
    addUserToLocals
};