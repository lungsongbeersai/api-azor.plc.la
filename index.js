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

app.post('/order_status', async (req, res) => {
    const { order_list_status_order, order_list_code } = req.body;
    try {
        const query = `UPDATE res_orders_list SET order_list_status_order = ? 
        WHERE order_list_code = ?`;
        
        const [results] = await db.query(query, [order_list_status_order, order_list_code]);
        
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "error" });
        }

        res.status(200).json({ status: "success"});
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send(err.message);
    }
});


app.post('/order_cart', async (req, res) => {
    const { order_list_branch_fk, order_list_status_cook, order_list_status_order, pro_detail_cooking_status } = req.body;

    // console.log('Received Params:', req.body);

    try {
        const query = `SELECT * FROM view_cart 
        WHERE order_list_branch_fk = ?
        AND order_list_status_cook = ?
        AND order_list_status_order = ?
        AND pro_detail_cooking_status = ? 
        Order by order_list_q ASC`;
        
        const [results] = await db.query(query, [order_list_branch_fk, order_list_status_cook, order_list_status_order, pro_detail_cooking_status]);
        
        // console.log('Query Results:', results);

        res.status(200).json(results);
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send(err.message);
    }
});

app.post('/update_cart', async(req, res) => {
    const order_list_code = req.body.order_list_code;

    if (!Array.isArray(order_list_code)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid order_list_code' });
    }

    let success = true;
    let errors = [];

    for (let i = 0; i < order_list_code.length; i++) {

        const query_order = `
            UPDATE res_orders_list 
            SET order_list_status_order = ? 
            WHERE order_list_code = ?
            AND order_list_status_cook = ?
        `;
        await db.query(query_order, [2, order_list_code[i], 'off']);

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

        const [results] = await db.query(selectSql, [order_list_code[i],1, 'on']);

        if (results.length > 0) {
            
            const order = results[0];
            const proidID = order.order_list_pro_code_fk;
            console.log("result:",proidID)
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
                await db.query(sqlOrders, ['2', order_list_code[i]]);

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

                    const sqlUpdateOrder = `
                        UPDATE res_orders_list 
                        SET order_list_qty = ?, 
                            order_list_amount = ?, 
                            order_list_total = ?,
                            order_list_status_order = ?
                        WHERE order_list_code = ?
                    `;
                    await db.query(sqlUpdateOrder, [qty_stock, amount, total, '2', order_list_code[i]]);

                    let update_qty = `
                        UPDATE view_product_detail 
                        SET pro_detail_qty = ?
                        WHERE pro_detail_code = ?
                    `;
                    await db.query(update_qty, ['0', proidID]);
                } else {
                    success = false;
                    errors.push({ order_code: order_list_code[i], message: 'Out of stock' });
                }
            }
        }
        
        // else {
        //     success = false;
        //     errors.push({ order_code: order_list_code[i], message: 'Order not found' });
        // }
    }

    if (success) {
        res.json({ status: 'success' });
    } else {
        res.status(400).json({ status: 'fail', errors });
    }
});


let whereCooking = []; // Initialize whereCooking globally

// Handle socket connections
io.on('connection', (socket) => {
    // console.log('A user connected:', socket.id);

    // Handle incoming 'order' events
    socket.on('order', (data) => {
        // console.log('Received Params:', data);

        // Directly update whereCooking from the incoming data
        if (Array.isArray(data.whereCooking)) {
            whereCooking = data.whereCooking;
        } else {
            console.error('Invalid data format for whereCooking:', data.whereCooking);
        }

        let sentOrderCook = false;
        let sentOrderBar = false;
        

        // Iterate over status values and emit events accordingly
        data.status.forEach((status) => {
            if (status === 'off' && !sentOrderCook) {
                io.emit('orderCook', { message: whereCooking.join(', ') });
                sentOrderCook = true;
            }
            if (status === 'on' && !sentOrderBar) {
                io.emit('orderBar', { message: whereCooking.join(', ') });
                sentOrderBar = true;
            }
        });

        // console.log('Updated whereCooking:', whereCooking); // Print current whereCooking for debugging
    });


    socket.on('cookConfirm', (data) => {
        console.log('Confirm orders:', data);
    
        // Check if branchCode is a string
        if (typeof data.branchCode === 'string') {
            // Emit the confirmation message for the single branch code
            io.emit('EmitCookConfirm', { message: "ຮັບອໍເດີ" });
            console.log('Show commit:', data.branchCode);
        } else {
            console.error('branchCode is not a string or is undefined:', data.branchCode);
        }
    });
    
    

    // Handle socket disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});



// Set the port and start the server
const PORT = process.env.PORT || 8091;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});