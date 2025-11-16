const express = require('express')
const path = require('path')
const homeRoutes = require('./routes/homeRoutes')
const userRoutes = require('./routes/userRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const productRoutes = require('./routes/productRoutes')
const searchRoutes = require('./routes/searchRoutes')
const orderRoutes = require('./routes/orderRoutes')

const app = express()

// Set view engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))



// Routes
app.use('/', homeRoutes)
app.use('/', userRoutes)
app.use('/', dashboardRoutes)
app.use('/', productRoutes)
app.use('/', searchRoutes)
app.use('/orders', orderRoutes)

module.exports = app;