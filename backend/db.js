const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '1886031', // <-- сюда твой пароль!
  database: 'tmcdb'
});

module.exports = pool;