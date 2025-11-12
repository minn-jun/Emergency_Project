// 관리자 권한 확인 미들웨어
exports.requireAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    if (req.accepts('json', 'html') === 'json') {
      res.status(403).json({ error: '인증이 필요합니다.' });
    } else {
      res.redirect('/admin-login.html?error=unauthorized');
    }
  }
};
