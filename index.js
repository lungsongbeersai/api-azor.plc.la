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

app.get('/products', async(req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM products');
        res.json(results);
    } catch (err) {
        res.status(500).send(err);
    }
});


app.post('/update_cart', async(req, res) => {
    const order_list_codes = req.body.order_list_codes;

    if (!Array.isArray(order_list_codes)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid order_list_codes' });
    }

    let success = true;
    let errors = [];

    for (let i = 0; i < order_list_codes.length; i++) {

        const query_order = `
            UPDATE res_orders_list 
            SET order_list_status_order = ? 
            WHERE order_list_code = ?
            AND order_list_status_cook = ?
        `;
        await db.query(query_order, ['2', order_list_codes[i], 'off']);

        const selectSql = `
            SELECT 
            order_list_code,
            order_list_pro_code_fk,
            order_list_qty
            FROM res_orders_list 
            WHERE order_list_code = ?
            AND order_list_status_order = ? 
            AND order_list_status_cook = ?
        `;

        const [results] = await db.query(selectSql, [order_list_codes[i], '1', 'on']);

        if (results.length > 0) {
            const order = results[0];
            const proidID = order.order_list_pro_code_fk;

            const sqlStock = `
                SELECT 
                pro_detail_qty,
                pro_detail_code
                FROM view_product_detail 
                WHERE pro_detail_code = ? 
                AND product_cut_stock = ? 
                AND pro_detail_qty >= ?
            `;
            const [query_stock] = await db.query(sqlStock, [proidID, 'on', order.order_list_qty]);

            if (query_stock.length > 0) {
                const item_stock = query_stock[0];
                const qty = item_stock.pro_detail_qty - order.order_list_qty;

                let sqlUpdateStock = 'UPDATE view_product_detail SET pro_detail_qty = ? WHERE pro_detail_code = ?';
                await db.query(sqlUpdateStock, [qty, item_stock.pro_detail_code]);

                let sqlOrders = 'UPDATE res_orders_list SET order_list_status_order = ? WHERE order_list_code = ?';
                await db.query(sqlOrders, ['2', order_list_codes[i]]);

            } else {

                let queryResult = `
                    SELECT 
                    pro_detail_qty,
                    pro_detail_code,
                    pro_detail_gift,
                    s_price
                    FROM view_product_detail 
                    WHERE pro_detail_code = ?
                    AND product_cut_stock = ?
                    AND pro_detail_qty >= ?
                `;
                const [result_stock] = await db.query(queryResult, [proidID, 'on', '1']);

                if (result_stock.length > 0) {
                    let item_name = result_stock[0];
                    let order_list_percented = item_name.pro_detail_gift / 100;
                    let qty_stock = item_name.pro_detail_qty;
                    let s_price = item_name.s_price;
                    let amount = s_price * qty_stock;
                    let total = amount - (amount * order_list_percented);

                    let sqlUpdateOrder = `
                        UPDATE res_orders_list 
                        SET order_list_qty = ?, 
                            order_list_amount = ?, 
                            order_list_total = ? ,
                            order_list_status_order = ?
                            WHERE order_list_code = ?
                    `;
                    await db.query(sqlUpdateOrder, [qty_stock, amount, total, '2', order_list_codes[i]]);

                    let update_qty = `
                        UPDATE view_product_detail 
                        SET pro_detail_qty = ?
                        WHERE pro_detail_code = ?
                    `;
                    await db.query(update_qty, ['0', proidID]);
                } else {
                    success = false;
                    errors.push({ order_code: order_list_codes[i], message: 'Out of stock' });
                }
            }
        } else {
            success = false;
            errors.push({ order_code: order_list_codes[i], message: 'Order not found' });
        }
    }

    if (success) {
        res.json({ status: 'success' });
    } else {
        res.status(400).json({ status: 'fail', errors });
    }
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('order', (data) => {
        console.log('Order received:', data);

        if (data.status === 'off') {
            io.emit('orderCook', { message: 'Order received for Cook!' });
        } else if (data.status === 'on') {
            io.emit('orderBar', { message: 'Order received for Bar!' });
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});


// Set the port and start the server
const PORT = process.env.PORT || 8091;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});