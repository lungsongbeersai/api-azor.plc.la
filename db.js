const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '45.77.241.213',
    user: 'root',
    password: 'plc@2023*.com',
    database: 'azor',
    waitForConnections: true,
    connectionLimit: 10000,
    queueLimit: 0,
    connectTimeout: 10000
});

pool.on('connection', function (connection) {
    // console.log('New DB connection established');
    connection.on('error', function (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('DB connection lost:', err);
        }
    });
});

pool.on('error', function (err) {
    console.error('DB Pool error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        // Attempt to reconnect if the connection is lost
        handleDisconnect();
    } else {
        throw err;
    }
});

const promisePool = pool.promise();
module.exports = promisePool;
