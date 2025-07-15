const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// CSV 파일 읽기 및 파싱
function parseCSV(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');
        const headers = lines[0].split(',');
        
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',');
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header.trim()] = values[index] ? values[index].trim() : '';
                });
                result.push(obj);
            }
        }
        
        return result;
    } catch (error) {
        console.error('CSV 파일 읽기 실패:', error);
        return [];
    }
}

// 대피소 데이터 API
app.get('/api/shelters', (req, res) => {
    try {
        const shelters = parseCSV('./shelters.csv');
        
        // 데이터 타입 변환
        const processedShelters = shelters.map(shelter => ({
            ...shelter,
            latitude: parseFloat(shelter.latitude),
            longitude: parseFloat(shelter.longitude),
            capacity: parseInt(shelter.capacity) || 0
        }));
        
        res.json(processedShelters);
    } catch (error) {
        console.error('대피소 데이터 조회 실패:', error);
        res.status(500).json({ error: '대피소 데이터를 불러올 수 없습니다.' });
    }
});

// 위치 검색 API (카카오 API 사용)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: '검색어를 입력해주세요.' });
        }
        
        // 카카오 API 키를 환경변수나 설정파일에서 가져오세요
        const KAKAO_API_KEY = process.env.KAKAO_API_KEY || 'YOUR_KAKAO_API_KEY';
        
        const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: {
                'Authorization': `KakaoAK ${KAKAO_API_KEY}`
            },
            params: {
                query: query,
                category_group_code: '',
                x: 126.9780, // 서울시청 기준
                y: 37.5665,
                radius: 10000,
                size: 10
            }
        });
        
        const places = response.data.documents.map(place => ({
            place_name: place.place_name,
            address_name: place.address_name,
            road_address_name: place.road_address_name,
            x: place.x,
            y: place.y
        }));
        
        res.json(places);
    } catch (error) {
        console.error('위치 검색 실패:', error);
        res.status(500).json({ error: '위치 검색에 실패했습니다.' });
    }
});

// 루트 경로
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log('📁 다음 파일들을 준비해주세요:');
    console.log('   - public/index.html');
    console.log('   - public/style.css');
    console.log('   - public/script.js');
    console.log('   - shelters.csv');
    console.log('');
    console.log('⚙️  환경변수 설정:');
    console.log('   - KAKAO_API_KEY: 카카오 API 키');
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