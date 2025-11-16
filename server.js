require('dotenv').config()
const app = require('./src/app')
const connectDB = require('./src/db/db')
const http = require('http')
const socketIo = require('socket.io')
const Negotiation = require('./src/models/Negotiation')

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join negotiation room
    socket.on('join-negotiation', (negotiationId) => {
        socket.join(negotiationId);
        console.log(`User ${socket.id} joined negotiation room: ${negotiationId}`);
    });

    // Handle new messages
    socket.on('send-message', async (data) => {
        try {
            const { negotiationId, senderId, senderType, priceOffered, message } = data;
            
            // Save message to database
            const negotiation = await Negotiation.findById(negotiationId);
            if (negotiation && negotiation.status === 'open') {
                negotiation.messages.push({
                    senderId,
                    senderType,
                    priceOffered: priceOffered || null,
                    message: message || null
                });
                await negotiation.save();

                // Broadcast to all users in the negotiation room
                io.to(negotiationId).emit('new-message', {
                    senderId,
                    senderType,
                    priceOffered,
                    message,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle negotiation acceptance
    socket.on('accept-negotiation', async (data) => {
        try {
            const { negotiationId, accepterId, acceptedPrice } = data;
            
            const negotiation = await Negotiation.findById(negotiationId);
            if (negotiation && negotiation.status === 'open') {
                // Determine final price
                let final = acceptedPrice;
                if (final === undefined || final === null) {
                    const lastMsgWithPrice = [...negotiation.messages].reverse().find(m => m.priceOffered !== undefined && m.priceOffered !== null);
                    final = lastMsgWithPrice ? lastMsgWithPrice.priceOffered : negotiation.initialPrice;
                }

                negotiation.finalPrice = final;
                negotiation.status = 'accepted';
                
                // Add acceptance message
                negotiation.messages.push({
                    senderId: accepterId,
                    senderType: accepterId === negotiation.farmerId.toString() ? 'farmer' : 'buyer',
                    message: `Accepted at ₹${final}`,
                    priceOffered: final
                });
                
                await negotiation.save();

                // Notify all users in the room
                io.to(negotiationId).emit('negotiation-accepted', {
                    finalPrice: final,
                    accepterId,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error accepting negotiation:', error);
            socket.emit('error', { message: 'Failed to accept negotiation' });
        }
    });

    // Handle negotiation decline
    socket.on('decline-negotiation', async (data) => {
        try {
            const { negotiationId, declinerId } = data;
            
            const negotiation = await Negotiation.findById(negotiationId);
            if (negotiation && negotiation.status === 'open') {
                negotiation.status = 'rejected';
                
                // Add decline message
                negotiation.messages.push({
                    senderId: declinerId,
                    senderType: declinerId === negotiation.farmerId.toString() ? 'farmer' : 'buyer',
                    message: 'Declined the negotiation - no agreement reached on price'
                });
                
                await negotiation.save();

                // Notify all users in the room
                io.to(negotiationId).emit('negotiation-declined', {
                    declinerId,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error declining negotiation:', error);
            socket.emit('error', { message: 'Failed to decline negotiation' });
        }
    });

    // Handle user typing indicator
    socket.on('typing', (data) => {
        socket.to(data.negotiationId).emit('user-typing', {
            userId: data.userId,
            userType: data.userType
        });
    });

    socket.on('stop-typing', (data) => {
        socket.to(data.negotiationId).emit('user-stop-typing', {
            userId: data.userId
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

connectDB()

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))