const axios = require('axios'); // [필수] 이거 없으면 500 에러 남

// 재난 문자 상태 관리 (메모리)
let latestDisasterMsg = null;

// 재난 문자 업데이트 (크롤러가 호출)
exports.updateDisasterMsg = (req, res) => {
  latestDisasterMsg = req.body;
  console.log('새로운 재난 문자 수신:', latestDisasterMsg.msg_no);
  res.json({ status: 'success' });
};

// 재난 문자 조회 (브라우저가 호출)
exports.getLatestDisasterMsg = (req, res) => {
  res.json(latestDisasterMsg);
};

// 카카오 위치 검색
exports.searchLocation = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: '검색어 필요' });

    // [수정] 올바른 REST API 키로 변경 (JS 키를 쓰면 안 됩니다!)
    const KAKAO_KEY = process.env.KAKAO_API_KEY || 'cb2690da863c1d359f5ad5ea12c7d575';

    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      params: { query, x: 126.978, y: 37.5665, radius: 20000, size: 15 },
    });

    const places = response.data.documents.map((p) => ({
      place_name: p.place_name,
      address_name: p.address_name,
      x: p.x,
      y: p.y,
    }));
    res.json(places);
  } catch (error) {
    // [추가] 에러 원인을 터미널에 출력 (디버깅용)
    console.error('위치 검색 실패:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '검색 실패' });
  }
};
