const bcrypt = require('bcrypt');
const dbPool = require('../config/db');

// 로그인 처리
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await dbPool.query('SELECT * FROM admin WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' });

    const adminUser = rows[0];
    const match = await bcrypt.compare(password, adminUser.password_hash);

    if (match) {
      req.session.isAdmin = true;
      req.session.save(() => {
        res.json({ success: true });
      });
    } else {
      res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류' });
  }
};

// 로그아웃 처리
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: '로그아웃 실패' });
    res.clearCookie('secret');
    res.json({ success: true });
  });
};
