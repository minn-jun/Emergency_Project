const express = require('express');
const path = require('path');
const session = require('express-session');

// 설정 및 라우터 불러오기
const sessionConfig = require('./config/sessionConfig');
const apiRoutes = require('./routes/api');
const { requireAdmin } = require('./middlewares/auth'); // 페이지 보호용

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 미들웨어 설정
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // 정적 파일

// 2. 세션 설정 (config에서 가져옴)
app.use(session(sessionConfig));

// 3. 라우팅 (API)
app.use('/api', apiRoutes);
// -> /api/shelters, /api/admin/login 등으로 연결됨

// 4. 페이지 라우팅 (HTML 서빙)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// 관리자 페이지 (권한 없으면 튕김)
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
