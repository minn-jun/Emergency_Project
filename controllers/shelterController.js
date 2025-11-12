const dbPool = require('../config/db');

// [공통] 대피소 조회 (메인 페이지용)
exports.getShelters = async (req, res) => {
  const type = req.query.type || 'default';
  let dbShelterTypes;

  switch (type) {
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
    default:
      dbShelterTypes = ['민방위대피시설'];
      break;
  }

  const query = `
    SELECT s.shelter_id, s.shelter_name AS name, s.address, s.latitude, s.longitude,
    GROUP_CONCAT(DISTINCT st.shelter_type SEPARATOR ', ') AS type
    FROM shelter s
    JOIN shelter_type st ON s.shelter_id = st.shelter_id
    WHERE st.shelter_type IN (?)
    GROUP BY s.shelter_id, s.shelter_name, s.address, s.latitude, s.longitude
  `;

  try {
    const [shelters] = await dbPool.query(query, [dbShelterTypes]);
    res.json(shelters);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '데이터 로드 실패' });
  }
};

// [관리자] 대피소 목록 조회 (페이징/검색)
exports.getAdminShelters = async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = 25;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const type = req.query.type || '';

    let whereClauses = [],
      params = [];
    const joinSql = `LEFT JOIN shelter_type st ON s.shelter_id = st.shelter_id`;

    if (search) {
      whereClauses.push(`(s.shelter_name LIKE ? OR s.address LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (type) {
      whereClauses.push(`st.shelter_type = ?`);
      params.push(type);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 카운트 쿼리
    const [countRows] = await dbPool.query(`SELECT COUNT(DISTINCT s.shelter_id) as total FROM shelter s ${joinSql} ${whereSql}`, params);
    const totalItems = countRows[0].total;

    // 데이터 쿼리
    const dataQuery = `
      SELECT s.*, GROUP_CONCAT(DISTINCT st.shelter_type SEPARATOR ', ') AS shelter_type
      FROM shelter s ${joinSql} ${whereSql}
      GROUP BY s.shelter_id
      ORDER BY s.shelter_id DESC LIMIT ? OFFSET ?
    `;
    const [shelters] = await dbPool.query(dataQuery, [...params, limit, offset]);

    res.json({ shelters, totalPages: Math.ceil(totalItems / limit), currentPage: page, totalItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '조회 실패' });
  }
};

// [관리자] 대피소 추가 (트랜잭션)
exports.addShelter = async (req, res) => {
  const { shelter_name, address, latitude, longitude, shelter_type } = req.body;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [res1] = await connection.query('INSERT INTO shelter (shelter_name, address, latitude, longitude) VALUES (?, ?, ?, ?)', [
      shelter_name,
      address,
      latitude,
      longitude,
    ]);
    if (shelter_type) {
      await connection.query('INSERT INTO shelter_type (shelter_id, shelter_type) VALUES (?, ?)', [res1.insertId, shelter_type]);
    }

    await connection.commit();
    res.status(201).json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: '추가 실패' });
  } finally {
    if (connection) connection.release();
  }
};

// [관리자] 대피소 삭제
exports.deleteShelter = async (req, res) => {
  try {
    await dbPool.query('DELETE FROM shelter WHERE shelter_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '삭제 실패' });
  }
};
