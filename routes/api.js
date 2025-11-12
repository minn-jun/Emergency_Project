const express = require('express');
const router = express.Router();

// 컨트롤러 및 미들웨어 가져오기
const shelterCtrl = require('../controllers/shelterController');
const authCtrl = require('../controllers/authController');
const globalCtrl = require('../controllers/globalController');
const { requireAdmin } = require('../middlewares/auth');

// --- [1] 일반 공개 API ---
router.get('/shelters', shelterCtrl.getShelters); // 대피소 조회
router.get('/search', globalCtrl.searchLocation); // 위치 검색
router.get('/get-latest-disaster', globalCtrl.getLatestDisasterMsg); // 재난문자 조회
router.post('/disaster-update', globalCtrl.updateDisasterMsg); // 재난문자 수신(크롤러)

// --- [2] 관리자 인증 API ---
router.post('/admin/login', authCtrl.login);
router.post('/admin/logout', authCtrl.logout);

// --- [3] 관리자 전용 API (requireAdmin 적용) ---
router.get('/admin/shelters', requireAdmin, shelterCtrl.getAdminShelters); // 목록 조회
router.post('/admin/shelters', requireAdmin, shelterCtrl.addShelter); // 추가
router.delete('/admin/shelters/:id', requireAdmin, shelterCtrl.deleteShelter); // 삭제

module.exports = router;
