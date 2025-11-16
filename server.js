require('dotenv').config()
const app = require('./src/app')
const connectDB = require('./src/db/db')


const PORT = process.env.PORT || 5000;

connectDB()

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))