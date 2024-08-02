const mysql = require('mysql2');

const db = mysql.createConnection({
    host: '45.77.241.213',
    user: 'root',
    password: 'plc@2023*.com',
    database: 'socket_io'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to database.');
});

module.exports = db;