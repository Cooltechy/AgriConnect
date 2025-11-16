const express = require('express')
const path = require('path')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const homeRoutes = require('./routes/homeRoutes')
const userRoutes = require('./routes/userRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const productRoutes = require('./routes/productRoutes')
const searchRoutes = require('./routes/searchRoutes')
const orderRoutes = require('./routes/orderRoutes')
const negotiationRoutes = require('./routes/negotiationRoutes')

const app = express()

// Set view engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Trust proxy for production deployment
app.set('trust proxy', 1)

// Session middleware - must be before routes
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URL,
        touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}))

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Add user to all templates
const { addUserToLocals } = require('./middleware/auth')
app.use(addUserToLocals)

// Handle favicon.ico requests
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content
});

// Routes
app.use('/', homeRoutes)
app.use('/', userRoutes)
app.use('/', dashboardRoutes)
app.use('/', productRoutes)
app.use('/', searchRoutes)
app.use('/orders', orderRoutes)
app.use('/negotiations', negotiationRoutes)

module.exports = app;