const mysql = require('mysql2/promise');

const dbPool = mysql.createPool({
  host: 'localhost', // 도커 사용 시 'mysql-container' 등으로 변경
  user: 'ming', // 또는 'ming'
  password: '1234', // [!] 실제 비밀번호로 변경하세요
  database: 'emergency',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = dbPool;
