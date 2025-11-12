module.exports = {
  name: 'secret',
  secret: 'your-very-secret-key-12345', // 강력한 비밀번호로 변경 권장
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: false, // HTTPS 적용 시 true
    maxAge: 1000 * 60 * 60 * 24, // 1일
  },
};
