const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

// Endpoint to fetch products
app.get('/products', async(req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM products');
        res.json(results);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Endpoint to update the cart
app.post('/update_cart', async(req, res) => {
    const order_list_code = req.body.order_list_code;
    const data = {
        'order_list_status_order': '2'
    };
    const sql = 'UPDATE res_orders_list SET ? WHERE order_list_code = ?';
    try {
        await db.query(sql, [data, order_list_code]);
        res.json({ status: 'Update success' });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Example of receiving an 'order' event from the client
    socket.on('order', (data) => {
        console.log('Order received:', data);
        // Send an 'orderConfirmation' event back to the client
        socket.emit('orderConfirmation', { message: 'Order received successfully!' });
    });

    // Example of handling disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Set the port and start the server
const PORT = process.env.PORT || 8091;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});