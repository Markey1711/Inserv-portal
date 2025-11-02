const mysql = require('mysql2/promise');

// Позволяем переопределять параметры через переменные окружения или .env
const host = process.env.MYSQL_HOST || 'localhost';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || '1886031';
const database = process.env.MYSQL_DATABASE || 'tmcdb';
const port = Number(process.env.MYSQL_PORT || 3306);

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;