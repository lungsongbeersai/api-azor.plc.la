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

// app.post('/update_cart', async(req, res) => {
//     const order_list_codes = req.body.order_list_code;

//     // console.log('Received order_list_code:', order_list_codes);

//     if (!order_list_codes || !Array.isArray(order_list_codes)) {
//         console.log('Invalid order_list_code:', order_list_codes);
//         return res.status(400).json({ status: 'fail', message: 'Invalid order_list_code' });
//     }

//     const orderListCodesString = order_list_codes.map(code => `'${code}'`).join(',');

//     let selectSql = `
//         SELECT 
//         order_list_code,
//         order_list_pro_code_fk,
//         order_list_qty
//         FROM res_orders_list 
//         WHERE order_list_code IN (${orderListCodesString}) 
//         AND order_list_status_order = ? 
//         AND order_list_status_cook = ?
//     `;

//     try {
//         let sqlOrdersCook = `
//             UPDATE res_orders_list 
//             SET order_list_status_order = ? 
//             WHERE order_list_code IN (${orderListCodesString}) 
//             AND order_list_status_cook = ?
//         `;
//         await db.query(sqlOrdersCook, ['2', 'off']);

//         const [results] = await db.query(selectSql, ['1', 'on']);

//         if (results.length > 0) {
//             const order = results[0];
//             let sqlStock = `
//                 SELECT 
//                 pro_detail_qty,
//                 pro_detail_code
//                 FROM view_product_detail 
//                 WHERE pro_detail_code = ? 
//                 AND product_cut_stock = ? 
//                 AND pro_detail_qty >= ?
//             `;
//             const [queryStock] = await db.query(sqlStock, [order.order_list_pro_code_fk, 'on', order.order_list_qty]);

//             if (queryStock.length > 0) {
//                 const item_stock = queryStock[0];
//                 const qty = item_stock.pro_detail_qty - order.order_list_qty;

//                 let sqlUpdateStock = "UPDATE view_product_detail SET pro_detail_qty = ? WHERE pro_detail_code = ?";
//                 await db.query(sqlUpdateStock, [qty, order.order_list_pro_code_fk]);

//                 let sqlOrders = "UPDATE res_orders_list SET order_list_status_order = ? WHERE order_list_code = ?";
//                 await db.query(sqlOrders, ['2', order.order_list_code]);
//                 res.json({ status: 'success' });
//             } else {
//                 let queryResult = `
//                     SELECT 
//                     pro_detail_qty,
//                     pro_detail_code,
//                     pro_detail_gift,
//                     s_price
//                     FROM view_product_detail 
//                     WHERE pro_detail_code = ? 
//                     AND product_cut_stock = ?
//                     AND pro_detail_qty >= ?
//                 `;
//                 const [result_stock] = await db.query(queryResult, [order.order_list_pro_code_fk, 'on', '1']);

//                 if (result_stock.length > 0) {
//                     let item_name = result_stock[0];
//                     let order_list_percented = item_name.pro_detail_gift / 100;
//                     let qty_stock = item_name.pro_detail_qty;
//                     let s_price = item_name.s_price;
//                     let amount = s_price * qty_stock;
//                     let total = amount - (amount * order_list_percented);

//                     let sqlUpdateOrder = `
//                         UPDATE res_orders_list 
//                         SET order_list_qty = ?, 
//                             order_list_amount = ?, 
//                             order_list_total = ? ,
//                             order_list_status_order = ?
//                         WHERE order_list_code = ?
//                     `;
//                     await db.query(sqlUpdateOrder, [qty_stock, amount, total, '2', order.order_list_code]);

//                     let update_qty = `
//                         UPDATE view_product_detail 
//                         SET pro_detail_qty = ?
//                         WHERE pro_detail_code = ?
//                     `;
//                     await db.query(update_qty, ['0', order.order_list_pro_code_fk]);

//                     res.json({ status: 'success' });
//                 } else {
//                     res.json({ status: 'Out of Stock' });
//                 }
//             }
//         } else {
//             res.json({ status: 'success' });
//         }
//     } catch (err) {
//         console.error('Error:', err);
//         res.status(500).send(err);
//     }
// });



app.post('/update_cart:order_list_code', async(req, res) => {
    const order_list_codes = req.body.order_list_code;

    if (!order_list_codes || !Array.isArray(order_list_codes)) {
        console.log('Invalid order_list_code:', order_list_codes);
        return res.status(400).json({ status: 'fail', message: 'Invalid order_list_code' });
    }

    const orderListCodesString = order_list_codes.map(code => `'${code}'`).join(',');

    let selectSql = `
        SELECT 
        order_list_code,
        order_list_pro_code_fk,
        order_list_qty
        FROM res_orders_list 
        WHERE order_list_code IN (${orderListCodesString}) 
        AND order_list_status_order = ? 
        AND order_list_status_cook = ?
    `;

    try {
        let sqlOrdersCook = `
            UPDATE res_orders_list 
            SET order_list_status_order = ? 
            WHERE order_list_code IN (${orderListCodesString}) 
            AND order_list_status_cook = ?
        `;
        await db.query(sqlOrdersCook, ['2', 'off']);

        const [results] = await db.query(selectSql, ['1', 'on']);

        if (results.length > 0) {
            const order = results[0];
            let proDetailCodesString = order_list_codes.map(code => `'${code}'`).join(',');
            let sqlStock = `
                SELECT 
                pro_detail_qty,
                pro_detail_code
                FROM view_product_detail 
                WHERE pro_detail_code IN (${proDetailCodesString}) 
                AND product_cut_stock = ? 
                AND pro_detail_qty >= ?
            `;
            const [queryStock] = await db.query(sqlStock, ['on', order.order_list_qty]);

            if (queryStock.length > 0) {
                const item_stock = queryStock[0];
                const qty = item_stock.pro_detail_qty - order.order_list_qty;

                let sqlUpdateStock = "UPDATE view_product_detail SET pro_detail_qty = ? WHERE pro_detail_code = ?";
                await db.query(sqlUpdateStock, [qty, order.order_list_pro_code_fk]);

                let sqlOrders = "UPDATE res_orders_list SET order_list_status_order = ? WHERE order_list_code = ?";
                await db.query(sqlOrders, ['2', order.order_list_code]);
                res.json({ status: 'success' });
            } else {
                let queryResult = `
                    SELECT 
                    pro_detail_qty,
                    pro_detail_code,
                    pro_detail_gift,
                    s_price
                    FROM view_product_detail 
                    WHERE pro_detail_code IN (${proDetailCodesString}) 
                    AND product_cut_stock = ?
                    AND pro_detail_qty >= ?
                `;
                const [result_stock] = await db.query(queryResult, ['on', '1']);

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
                    await db.query(sqlUpdateOrder, [qty_stock, amount, total, '2', order.order_list_code]);

                    let update_qty = `
                        UPDATE view_product_detail 
                        SET pro_detail_qty = ?
                        WHERE pro_detail_code = ?
                    `;
                    await db.query(update_qty, ['0', order.order_list_pro_code_fk]);

                    res.json({ status: 'success' });
                } else {
                    res.json({ status: 'Out of Stock' });
                }
            }
        } else {
            res.json({ status: 'success' });
        }
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send(err);
    }
});




io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('order', (data) => {
        console.log('Order received:', data);

        // Handle status and send the appropriate notification
        if (data.status === '1') {
            io.emit('orderCook', { message: 'Order received for Cook!' });
        } else if (data.status === '2') {
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