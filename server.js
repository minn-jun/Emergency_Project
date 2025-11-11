const express = require('express');
const path = require('path');
const axios = require('axios');
const mysql = require('mysql2/promise'); // mysql2/promise 사용
const session = require('express-session'); // 세션 관리
const bcrypt = require('bcrypt'); // (보안 강화를 위해)

const app = express();
const PORT = process.env.PORT || 3000;

// DB 연결 풀 생성 (환경 변수 사용 권장)
const dbPool = mysql.createPool({
  host: 'localhost',
  user: 'ming', // (DB 사용자)
  password: '1234', // (DB 비밀번호)
  database: 'emergency', // (DB 이름)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(
  session({
    name: 'secret',
    secret: 'your-very-secret-key-12345', // (필수: 복잡한 문자열로 변경)
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false, // (배포 시 HTTPS를 사용한다면 true로 변경)
      maxAge: 1000 * 60 * 30, // 30분
    },
  })
);

// --- 전역 변수 및 초기화 ---
let latestDisasterMsg = null;

// (요청 4) 서버 시작 시 DB에서 최신 재난 문자 1개 로드
async function loadInitialDisasterMsg() {
  try {
    // send_time 또는 created_at 기준으로 최신 1건
    const [rows] = await dbPool.query('SELECT * FROM disaster_msg ORDER BY created_at DESC LIMIT 1');
    if (rows.length > 0) {
      latestDisasterMsg = rows[0];
      console.log('서버 시작: 최신 재난 문자 로드됨', latestDisasterMsg.msg_no);
    } else {
      console.log('서버 시작: 저장된 재난 문자가 없습니다.');
    }
  } catch (error) {
    console.error('초기 재난 문자 로드 실패:', error);
  }
}

// --- 관리자 인증 미들웨어 ---
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next(); // 관리자 인증됨
  } else {
    // API 요청이면 403, 페이지 요청이면 로그인 페이지로 리다이렉트
    if (req.accepts('json', 'html') === 'json') {
      res.status(403).json({ error: '인증이 필요합니다.' });
    } else {
      res.redirect('/admin-login?error=unauthorized');
    }
  }
}

// --- 기존 API 수정 ---

// (요청 4) 크롤러가 새 메시지를 알리면 변수 업데이트 (DB 저장은 크롤러가 담당)
app.post('/api/disaster-update', (req, res) => {
  const newDisasterMsg = req.body;
  console.log('새로운 재난 문자 수신 (from Crawler):', newDisasterMsg.msg_no);
  latestDisasterMsg = newDisasterMsg; // 실시간 알림을 위해 변수 업데이트
  res.status(200).json({ status: 'success', message: 'Data received' });
});

app.get('/api/get-latest-disaster', (req, res) => {
  res.json(latestDisasterMsg);
});

// (요청 6) 대피소 데이터 API (DB에서 조회)
app.get('/api/shelters', async (req, res) => {
  const type = req.query.type || 'default';
  let dbShelterTypes;

  switch (type) {
    // ... (switch-case 부분은 동일) ...
    case 'heatwave':
      dbShelterTypes = ['기후동행쉼터', '무더위쉼터'];
      break;
    case 'coldwave':
      dbShelterTypes = ['기후동행쉼터', '한파쉼터'];
      break;
    case 'earthquake':
      dbShelterTypes = ['지진대피소'];
      break;
    case 'attack':
      dbShelterTypes = ['민방위대피시설', '비상대피시설(지하철역)'];
      break;
    default: // 'default' (기본)
      dbShelterTypes = ['민방위대피시설'];
      break;
  }

  // [수정] 쿼리에 GROUP_CONCAT 추가
  const query = `
    SELECT
      s.shelter_id,
      s.shelter_name AS name,
      s.address,
      s.latitude,
      s.longitude,
      GROUP_CONCAT(DISTINCT st.shelter_type SEPARATOR ', ') AS type
    FROM shelter s
    JOIN shelter_type st ON s.shelter_id = st.shelter_id
    WHERE st.shelter_type IN (?)
    -- [!] GROUP BY 추가
    GROUP BY s.shelter_id, s.shelter_name, s.address, s.latitude, s.longitude
  `;

  console.log(`DB 대피소 요청 (JOIN): ${dbShelterTypes.join(', ')}`);

  try {
    const [shelters] = await dbPool.query(query, [dbShelterTypes]);
    res.json(shelters);
  } catch (error) {
    console.error(`대피소 데이터 조회 실패 (${dbShelterTypes})`, error);
    res.status(500).json({ error: '대피소 데이터를 불러올 수 없습니다.' });
  }
});

// 위치 검색 API (카카오 API) - 변경 없음
app.get('/api/search', async (req, res) => {
  // ... (기존 코드와 동일) ...
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY || 'cb2690da863c1d359f5ad5ea12c7d575';
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
      params: { query: query, x: 126.978, y: 37.5665, radius: 20000, size: 15 },
    });
    const places = response.data.documents.map((place) => ({
      place_name: place.place_name,
      address_name: place.address_name,
      road_address_name: place.road_address_name,
      x: place.x,
      y: place.y,
    }));
    res.json(places);
  } catch (error) {
    console.error('위치 검색 실패:', error);
    res.status(500).json({ error: '위치 검색에 실패했습니다.' });
  }
});

// --- (요청 2) 신규 관리자 페이지 및 API ---

// 1. 관리자 로그인 페이지 서빙
// 세션이 없으면 /admin-login 으로 리다이렉트
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// 2. 관리자 메인 페이지 서빙 (인증 필요)
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 3. 로그인 API
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. DB에서 사용자 조회
    const [rows] = await dbPool.query('SELECT * FROM admin WHERE username = ?', [username]);

    if (rows.length === 0) {
      // 사용자가 존재하지 않음
      return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' });
    }

    const adminUser = rows[0];

    // 2. bcrypt로 비밀번호 비교
    const match = await bcrypt.compare(password, adminUser.password_hash);

    if (match) {
      // 비밀번호 일치! 세션 생성
      req.session.isAdmin = true;
      req.session.username = adminUser.username; // (선택) 세션에 사용자 이름 저장
      res.json({ success: true });
    } else {
      // 비밀번호 불일치
      res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다.' });
    }
  } catch (error) {
    console.error('로그인 중 서버 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 4. 로그아웃 API
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 5. [READ] 대피소 목록 조회 (인증 필요)
app.get('/api/admin/shelters', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const search = req.query.search || '';
    const type = req.query.type || '';

    let whereClauses = [];
    let params = [];

    const joinSql = `LEFT JOIN shelter_type st ON s.shelter_id = st.shelter_id`;

    if (search) {
      whereClauses.push(`(s.shelter_name LIKE ? OR s.address LIKE ?)`);
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    if (type) {
      whereClauses.push(`st.shelter_type = ?`);
      params.push(type);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 1. 데이터 총 개수 조회 (DISTINCT로 중복 제거)
    const countQuery = `
      SELECT COUNT(DISTINCT s.shelter_id) as total 
      FROM shelter s ${joinSql} ${whereSql}
    `;
    const [countRows] = await dbPool.query(countQuery, params);
    const totalItems = countRows[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // 2. 현재 페이지 데이터 조회
    // GROUP_CONCAT: 한 대피소의 여러 타입을 쉼표로 묶어서 보여줌
    const dataQuery = `
      SELECT 
        s.*, 
        GROUP_CONCAT(DISTINCT st.shelter_type SEPARATOR ', ') AS shelter_type
      FROM shelter s ${joinSql} ${whereSql}
      GROUP BY s.shelter_id
      ORDER BY s.shelter_id DESC 
      LIMIT ? OFFSET ?
    `;

    const [shelters] = await dbPool.query(dataQuery, [...params, limit, offset]);

    res.json({
      shelters,
      totalPages,
      currentPage: page,
      totalItems,
    });
  } catch (error) {
    console.error('관리자 대피소 조회 실패:', error);
    res.status(500).json({ error: '대피소 조회 실패' });
  }
});

// 6. [CREATE] 대피소 추가 (인증 필요)
app.post('/api/admin/shelters', requireAdmin, async (req, res) => {
  const { shelter_name, address, latitude, longitude, shelter_type } = req.body;

  // DB 풀에서 커넥션을 하나 빌려옴
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction(); // 트랜잭션 시작

    // 1. shelter 테이블에 기본 정보 추가
    const [shelterResult] = await connection.query('INSERT INTO shelter (shelter_name, address, latitude, longitude) VALUES (?, ?, ?, ?)', [
      shelter_name,
      address,
      latitude,
      longitude,
    ]);

    const newShelterId = shelterResult.insertId; // 방금 추가된 shelter_id

    // 2. shelter_type 테이블에 유형 정보 추가
    if (shelter_type) {
      await connection.query('INSERT INTO shelter_type (shelter_id, shelter_type) VALUES (?, ?)', [newShelterId, shelter_type]);
    }

    await connection.commit(); // 모든 쿼리 성공 시 커밋
    res.status(201).json({ success: true, id: newShelterId });
  } catch (error) {
    if (connection) await connection.rollback(); // 오류 발생 시 롤백
    console.error('대피소 추가 실패 (트랜잭션):', error);
    res.status(500).json({ error: '대피소 추가 실패' });
  } finally {
    if (connection) connection.release(); // 커넥션 반환
  }
});

// 7. [UPDATE] 대피소 수정 (인증 필요)
app.put('/api/admin/shelters/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { shelter_name, address, latitude, longitude, shelter_type } = req.body;

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. shelter 정보 업데이트
    await connection.query('UPDATE shelter SET shelter_name = ?, address = ?, latitude = ?, longitude = ? WHERE shelter_id = ?', [
      shelter_name,
      address,
      latitude,
      longitude,
      id,
    ]);

    // 2. shelter_type 정보 업데이트 (기존 것 모두 삭제 후 새로 추가)
    await connection.query('DELETE FROM shelter_type WHERE shelter_id = ?', [id]);

    if (shelter_type) {
      // (참고: UI가 여러 타입을 지원하면 여기서 반복문(loop)을 돌려야 함)
      await connection.query('INSERT INTO shelter_type (shelter_id, shelter_type) VALUES (?, ?)', [id, shelter_type]);
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('대피소 수정 실패:', error);
    res.status(500).json({ error: '대피소 수정 실패' });
  } finally {
    if (connection) connection.release();
  }
});

// 8. [DELETE] 대피소 삭제 (인증 필요)
app.delete('/api/admin/shelters/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await dbPool.query('DELETE FROM shelter WHERE shelter_id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '대피소 삭제 실패' });
  }
});

// --- 서버 시작 ---

// 루트 경로
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작 및 초기 재난 문자 로드
app.listen(PORT, async () => {
  await loadInitialDisasterMsg(); // DB에서 최신 메시지 로드
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});
