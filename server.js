const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

// CSV 파일 읽기 및 파싱
function parseCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`CSV 파일 없음: ${filePath}`);
      return [];
    }

    const data = fs.readFileSync(filePath, "utf8");

    // 파일을 읽은 후, 앞/뒤 공백을 제거하고 줄바꿈 문자를 정규식으로 처리
    // 이렇게 하면 다양한 OS(Windows, Mac)의 줄바꿈 형식과 파일 끝의 불필요한 공백에 모두 대응 가능
    const lines = data.trim().split(/\r?\n/);

    if (lines.length < 2) return [];    // 헤더만 있거나 비어있는 경우

    // 헤더 줄에서 BOM(Byte Order Mark) 문자 제거
    const headerLine = lines[0].replace(/^\uFEFF/, '');

    // 각 헤더의 공백 제거
    const headers = headerLine.split(",").map(h => h.trim().replace(/^"|"$/g, ''));

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      // 정규식 설명:
      // /("([^"]*)"|([^,]*))(,|$)/g
      // 1. "([^"]*)" : 따옴표로 감싸인 모든 문자열을 찾습니다 (그룹 2).
      // 2. | : 또는
      // 3. ([^,]*) : 콤마가 아닌 모든 문자열을 찾습니다 (그룹 3).
      // 4. (,|$): 콤마 또는 줄의 끝을 찾습니다.
      const regex = /("([^"]*)"|([^,]*))(,|$)/g;
      let values = [];
      let match;
      // 정규식으로 한 줄을 계속 매칭하면서 값을 추출합니다.
      while (match = regex.exec(lines[i])) {
        // 그룹 2(따옴표 안의 값)가 있으면 그것을 사용하고, 없으면 그룹 3(콤마 아닌 값)을 사용합니다.
        values.push(match[2] || match[3]);
        // 매칭된 부분에 콤마가 없으면 (줄의 끝이면) 루프를 종료합니다.
        if (match[4] === '') break;
      }

      const obj = {};
      headers.forEach((header, index) => {
        const value = values[index] ? values[index].trim() : "";
        obj[header] = value;
      });
      result.push(obj);
    }

    // 파싱 결과 확인용 로그
    console.log(`[${path.basename(filePath)}] 파싱 완료. 총 ${result.length}개 데이터.`);
    if (result.length > 0) {
      console.log('첫 번째 데이터 샘플:', {
        name: result[0]['대피소명'],
        address: result[0]['주소'],
        lat: result[0]['위도'],
        lng: result[0]['경도']
      });
    }

    return result;
  } catch (error) {
    console.error("CSV 파일 읽기 실패:", error);
    return [];
  }
}

// 대피소 데이터 API
app.get("/api/shelters", (req, res) => {
  const type = req.query.type || 'default'
  let fileName;

  // 요청된 타입에 따른 파일 이름 매핑
  switch (type) {
    case 'heatwave': fileName = 'hot_shelters.csv'; break;
    case 'coldwave': fileName = 'cold_shelters.csv'; break;
    case 'earthquake': fileName = 'eq_shelters.csv'; break;
    case 'flood': fileName = 'flood_shelters.csv'; break;
    case 'attack': fileName = 'civildef_sw_shelters.csv'; break;
    default: fileName = 'civildef_shelters.csv'; break;
  }

  const filePath = path.join(__dirname, "shelters", fileName);
  console.log(filePath)

  try {
    const shelters = parseCSV(filePath);

    // 데이터 타입 변환
    const processedShelters = shelters.map((shelter) => ({
      name: shelter['대피소명'] || '이름 없음',
      address: shelter['주소'] || '주소 없음',
      latitude: parseFloat(shelter['위도']),
      longitude: parseFloat(shelter['경도']),
      type: shelter['유형'] || '미분류',
      // '수용인원' 컬럼이 있을 경우를 대비하고, 없으면 0으로 처리
      capacity: parseInt(shelter['수용인원']) || 0, 
    }));

    res.json(processedShelters);
  } catch (error) {
    console.error(`대피소 데이터 조회 실패 (${fileName})`, error);
    res.status(500).json({ error: "대피소 데이터를 불러올 수 없습니다." });
  }
});

// 위치 검색 API (카카오 API 사용)
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "검색어를 입력해주세요." });
    }

    // KAKAO REST API KEY
    const KAKAO_API_KEY =
      process.env.KAKAO_API_KEY || "cb2690da863c1d359f5ad5ea12c7d575";

    const response = await axios.get(
      "https://dapi.kakao.com/v2/local/search/keyword.json",
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
        params: {
          query: query,
          x: 126.978, // 서울시청 기준
          y: 37.5665,
          radius: 20000,
          size: 15,
        },
      }
    );

    const places = response.data.documents.map((place) => ({
      place_name: place.place_name,
      address_name: place.address_name,
      road_address_name: place.road_address_name,
      x: place.x,
      y: place.y,
    }));

    res.json(places);
  } catch (error) {
    console.error("위치 검색 실패:", error);
    res.status(500).json({ error: "위치 검색에 실패했습니다." });
  }
});

// 루트 경로
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: "페이지를 찾을 수 없습니다." });
});
