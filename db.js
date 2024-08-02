const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '45.77.241.213',
    user: 'root',
    password: 'plc@2023*.com',
    database: 'socket_io',
    waitForConnections: true,
    connectionLimit: 10000,
    queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;